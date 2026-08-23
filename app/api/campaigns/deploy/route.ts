import { NextRequest, NextResponse } from 'next/server';
import {
  deployCampaign,
  type AcceptedAssetInput,
} from '@/lib/server/campaignDeployer';

interface DeployRequestBody {
  title?: unknown;
  goalAmount?: unknown;
  campaignDurationDays?: unknown;
  acceptedAssets?: unknown;
  minDonationAmount?: unknown;
}

/**
 * POST /api/campaigns/deploy
 * Deploys a campaign to the Stellar ledger and registers it with the backend.
 * Every response value is real; every failure carries a specific message.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeployRequestBody;
    const creatorToken = request.cookies.get('token')?.value;

    const acceptedAssets = Array.isArray(body.acceptedAssets)
      ? (body.acceptedAssets as AcceptedAssetInput[])
      : [];

    const result = await deployCampaign({
      title: typeof body.title === 'string' ? body.title : '',
      goalAmount: typeof body.goalAmount === 'number' ? body.goalAmount : Number(body.goalAmount),
      campaignDurationDays:
        typeof body.campaignDurationDays === 'number'
          ? body.campaignDurationDays
          : Number(body.campaignDurationDays),
      acceptedAssets,
      minDonationAmount:
        typeof body.minDonationAmount === 'number'
          ? body.minDonationAmount
          : body.minDonationAmount === undefined
            ? undefined
            : Number(body.minDonationAmount),
      creatorToken,
    });

    return NextResponse.json({ data: result, status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Campaign deployment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
