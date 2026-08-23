/**
 * lib/server/campaignDeployer.ts
 *
 * Real campaign deployment: builds and submits the `initialize` invocation
 * against the canonical `orbitchain-campaign` contract
 * (OrbitChain-Contracts/campaign) with server-side admin signing, then
 * registers the campaign with the OrbitChain-API so the returned id is real.
 *
 * The previous flow fabricated a campaign id and transaction hash after two
 * fixed delays; nothing was signed or submitted. This module is the
 * replacement: every value it returns comes from the ledger and the API, and
 * every configuration gap or rejected transaction surfaces as a specific
 * error — nothing is fabricated.
 *
 * Configuration (all from env, never literals):
 *   - contract id:    NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID
 *   - network:        NEXT_PUBLIC_STELLAR_NETWORK / ..._PASSPHRASE
 *   - Soroban RPC:    NEXT_PUBLIC_SOROBAN_RPC_URL
 *   - signing key:    STELLAR_ADMIN_SECRET_KEY (server-side admin signing)
 *
 * Contract entry point (from OrbitChain-Contracts campaign/src/lib.rs):
 *   initialize(creator: Address, goal_amount: i128, end_time: u64,
 *              accepted_assets: Vec<StellarAsset>, milestones: Vec<MilestoneData>,
 *              min_donation_amount: i128) -> Result<(), Error>
 *   where StellarAsset = { asset_code: String, issuer: Option<Address> } and
 *   MilestoneData = { index: u32, target_amount: i128, released_amount: i128,
 *                     description_hash: BytesN<32>, status: MilestoneStatus,
 *                     released_at: Option<u64> }.
 */

import { createHash } from 'crypto';
import {
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { env } from '@/lib/env';

export interface AcceptedAssetInput {
  /** IETF-style asset code, e.g. 'XLM', 'USDC'. 'XLM' is native. */
  code: string;
  /** Token contract address — required for non-native assets. */
  contractId?: string;
}

export interface DeployCampaignInput {
  title: string;
  goalAmount: number; // XLM
  campaignDurationDays: number;
  acceptedAssets: AcceptedAssetInput[];
  minDonationAmount?: number; // XLM
  /** Creator's backend JWT, forwarded to POST /campaigns for registration. */
  creatorToken?: string | null;
}

export interface DeployCampaignResult {
  campaignId: string;
  txHash: string;
  contractId: string;
  network: string;
}

const STROOPS_PER_XLM = 10_000_000;

function stroops(amountXlm: number): bigint {
  return BigInt(Math.round(amountXlm * STROOPS_PER_XLM));
}

/** SHA-256 hash used for the milestone description document (32 bytes). */
function descriptionHash(title: string): Buffer {
  return createHash('sha256')
    .update(`orbitchain-campaign:${title}`)
    .digest();
}

/**
 * Builds a Soroban map scval with symbol keys from [key, value] entries.
 * Symbol keys match the serialization that `#[derive(Serialize)]` contract
 * structs expect on-chain; plain string keys would not deserialize. Keys are
 * sorted, matching the SDK's own map conversion (the Soroban runtime expects
 * sorted map keys).
 */
function scMap(entries: Array<[string, xdr.ScVal]>): xdr.ScVal {
  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));
  return xdr.ScVal.scvMap(
    sorted.map(
      ([key, value]) =>
        new xdr.ScMapEntry({
          key: nativeToScVal(key, { type: 'symbol' }),
          val: value,
        }),
    ),
  );
}

function requireConfig(value: string | undefined, name: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(
      `Campaign deployment is not configured: ${name} is not set. ` +
        `Set it in the environment before deploying.`,
    );
  }
  return trimmed;
}

/**
 * Deploys a campaign: submits the signed `initialize` invocation to the
 * Soroban RPC, then registers the campaign with the API. Throws a specific
 * Error for every failure; the transaction hash is included when the
 * on-chain step succeeded but registration did not, so the caller is never
 * misled about what happened.
 */
export async function deployCampaign(
  input: DeployCampaignInput,
): Promise<DeployCampaignResult> {
  // ── Configuration (from env, never literals) ────────────────────────────
  const contractId = requireConfig(
    env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID,
    'NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID',
  );
  const adminSecret = requireConfig(
    env.STELLAR_ADMIN_SECRET_KEY,
    'STELLAR_ADMIN_SECRET_KEY',
  );
  const sorobanRpcUrl = requireConfig(
    env.NEXT_PUBLIC_SOROBAN_RPC_URL,
    'NEXT_PUBLIC_SOROBAN_RPC_URL',
  );
  const networkPassphrase = requireConfig(
    env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    'NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE',
  );
  const network = requireConfig(
    env.NEXT_PUBLIC_STELLAR_NETWORK,
    'NEXT_PUBLIC_STELLAR_NETWORK',
  );

  // ── Input validation ─────────────────────────────────────────────────────
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('Campaign title is required to deploy');
  }
  if (!Number.isFinite(input.goalAmount) || input.goalAmount <= 0) {
    throw new Error('A funding goal greater than 0 is required to deploy');
  }
  if (!Number.isFinite(input.campaignDurationDays) || input.campaignDurationDays <= 0) {
    throw new Error('A campaign duration greater than 0 days is required to deploy');
  }
  if (!Array.isArray(input.acceptedAssets) || input.acceptedAssets.length === 0) {
    throw new Error('At least one accepted asset is required to deploy');
  }

  const adminKeypair = Keypair.fromSecret(adminSecret);
  const creatorAddress = adminKeypair.publicKey();
  const goalStroops = stroops(input.goalAmount);
  const endTime = Math.floor(Date.now() / 1000) + Math.floor(input.campaignDurationDays * 86400);
  const minDonationStroops = stroops(input.minDonationAmount ?? 0.001);

  // ── Build contract arguments (per the canonical campaign contract) ───────
  const acceptedAssetsScVal = nativeToScVal(
    input.acceptedAssets.map((asset) => {
      const code = asset.code.trim().toUpperCase();
      if (code !== 'XLM' && !asset.contractId) {
        throw new Error(
          `Asset "${code}" needs its token contract address to be deployed ` +
            `(the contract's StellarAsset.issuer is the token contract). ` +
            `Only native XLM has no issuer.`,
        );
      }
      return scMap([
        ['asset_code', nativeToScVal(code)],
        [
          'issuer',
          asset.contractId
            ? nativeToScVal(new Address(asset.contractId), { type: 'address' })
            : nativeToScVal(undefined),
        ],
      ]);
    }),
  );

  const milestoneScVal = scMap([
    ['index', nativeToScVal(0, { type: 'u32' })],
    ['target_amount', nativeToScVal(goalStroops, { type: 'i128' })],
    ['released_amount', nativeToScVal(0n, { type: 'i128' })],
    ['description_hash', nativeToScVal(descriptionHash(input.title))],
    ['status', nativeToScVal(0, { type: 'u32' })], // MilestoneStatus::Locked
    ['released_at', nativeToScVal(undefined)],
  ]);
  const milestonesScVal = nativeToScVal([milestoneScVal]);

  const invokeArgs = [
    nativeToScVal(new Address(creatorAddress), { type: 'address' }),
    nativeToScVal(goalStroops, { type: 'i128' }),
    nativeToScVal(BigInt(endTime), { type: 'u64' }),
    acceptedAssetsScVal,
    milestonesScVal,
    nativeToScVal(minDonationStroops, { type: 'i128' }),
  ];

  // ── Submit to Soroban RPC ────────────────────────────────────────────────
  const server = new rpc.Server(sorobanRpcUrl);

  let account;
  try {
    account = await server.getAccount(creatorAddress);
  } catch {
    throw new Error(
      `The admin account ${creatorAddress} was not found on the ${network} ` +
        `network. Fund it before deploying.`,
    );
  }

  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: 'initialize',
        args: invokeArgs,
      }),
    )
    .setTimeout(0)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Soroban simulation rejected the deployment: ${simulation.error}`);
  }

  const assembled = rpc.assembleTransaction(transaction, simulation).build();
  assembled.sign(adminKeypair);
  const sendResult = await server.sendTransaction(assembled);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Soroban rejected the deployment transaction: ${sendResult.errorResult?.toXDR('base64') ?? sendResult.status}`);
  }

  const txHash = sendResult.hash;

  // Wait for the transaction to finalize.
  const deadline = Date.now() + 30_000;
  let finalStatus;
  for (;;) {
    const txResult = await server.getTransaction(txHash);
    if (txResult.status === 'SUCCESS' || txResult.status === 'FAILED') {
      finalStatus = txResult.status;
      break;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Deployment transaction ${txHash} was submitted but did not finalize within 30s.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (finalStatus === 'FAILED') {
    throw new Error(`Deployment transaction ${txHash} failed on the ledger.`);
  }

  // ── Register with the backend so the returned campaign id is real ───────
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  let campaignId: string;

  try {
    const response = await fetch(`${apiUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.creatorToken ? { Authorization: `Bearer ${input.creatorToken}` } : {}),
      },
      body: JSON.stringify({
        title: input.title,
        description: '',
        goalAmount: String(input.goalAmount),
        endDate: new Date(endTime * 1000).toISOString(),
        acceptedAssets: input.acceptedAssets.map((a) => a.code.trim().toUpperCase()),
        contractId,
        milestones: [
          {
            title: 'Final Payout',
            description: 'Full campaign goal payout on completion',
            targetAmount: String(input.goalAmount),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `backend registration failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const campaign = (await response.json()) as { id?: string };
    if (typeof campaign.id !== 'string' || !campaign.id) {
      throw new Error('backend registration returned no campaign id');
    }
    campaignId = campaign.id;
  } catch (error) {
    throw new Error(
      `Campaign was deployed on-chain (txHash ${txHash}, contract ${contractId}) ` +
        `but ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    campaignId,
    txHash,
    contractId,
    network,
  };
}
