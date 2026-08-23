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
  SorobanRpc,
  TransactionBuilder,
  scval,
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
  const acceptedAssetsScVal = scval.toVec(
    input.acceptedAssets.map((asset) => {
      const code = asset.code.trim().toUpperCase();
      if (code !== 'XLM' && !asset.contractId) {
        throw new Error(
          `Asset "${code}" needs its token contract address to be deployed ` +
            `(the contract's StellarAsset.issuer is the token contract). ` +
            `Only native XLM has no issuer.`,
        );
      }
      return scval.toMap([
        [scval.toSymbol('asset_code'), scval.toString(code)],
        [
          scval.toSymbol('issuer'),
          asset.contractId
            ? scval.toAddress(new Address(asset.contractId))
            : scval.toVoid(),
        ],
      ]);
    }),
  );

  const milestoneScVal = scval.toMap([
    [scval.toSymbol('index'), scval.toU32(0)],
    [scval.toSymbol('target_amount'), scval.toI128(goalStroops)],
    [scval.toSymbol('released_amount'), scval.toI128(0n)],
    [scval.toSymbol('description_hash'), scval.toBytes(descriptionHash(input.title))],
    [scval.toSymbol('status'), scval.toU32(0)], // MilestoneStatus::Locked
    [scval.toSymbol('released_at'), scval.toVoid()],
  ]);
  const milestonesScVal = scval.toVec([milestoneScVal]);

  const invokeArgs = [
    scval.toAddress(new Address(creatorAddress)),
    scval.toI128(goalStroops),
    scval.toU64(BigInt(endTime)),
    acceptedAssetsScVal,
    milestonesScVal,
    scval.toI128(minDonationStroops),
  ];

  // ── Submit to Soroban RPC ────────────────────────────────────────────────
  const server = new SorobanRpc.Server(sorobanRpcUrl);

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
  if (SorobanRpc.isSimulationError(simulation)) {
    throw new Error(`Soroban simulation rejected the deployment: ${simulation.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(transaction, simulation).sign(adminKeypair);
  const sendResult = await server.sendTransaction(assembled);
  if (sendResult.status === 'ERROR' || sendResult.status === 'FAILED') {
    throw new Error(`Soroban rejected the deployment transaction: ${sendResult.errorResult?.resultXdr ?? sendResult.status}`);
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
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
