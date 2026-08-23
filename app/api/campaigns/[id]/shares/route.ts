import { NextRequest, NextResponse } from 'next/server';
import { StrKey } from '@stellar/stellar-sdk';
import type { ShareRecord, ApiResponse } from '@/types/api';
import {
  recordShare,
  SHARE_PLATFORMS,
  type SharePlatform,
} from '@/lib/server/shareStore';

interface ShareRequestBody {
  platform?: unknown;
  walletAddress?: unknown;
}

/**
 * POST /api/campaigns/[id]/shares
 * Records a share event for a campaign. Requires the sharer's wallet address
 * so repeated shares from the same wallet within a bounded window are not
 * double-counted.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const body = (await request.json()) as ShareRequestBody;

    if (
      typeof body.platform !== 'string' ||
      !SHARE_PLATFORMS.includes(body.platform as SharePlatform)
    ) {
      return NextResponse.json(
        { message: 'Invalid platform' },
        { status: 400 }
      );
    }

    if (
      typeof body.walletAddress !== 'string' ||
      !StrKey.isValidEd25519PublicKey(body.walletAddress.trim())
    ) {
      return NextResponse.json(
        { message: 'A valid wallet address is required to record a share' },
        { status: 400 }
      );
    }

    const platform = body.platform as SharePlatform;
    const walletAddress = body.walletAddress.trim();

    const { recorded, record } = await recordShare(
      campaignId,
      walletAddress,
      platform
    );

    return NextResponse.json<ApiResponse<ShareRecord>>(
      {
        data: record,
        status: recorded ? 201 : 200,
        message: recorded
          ? 'Share recorded successfully'
          : 'Share already recorded for this wallet',
      },
      { status: recorded ? 201 : 200 }
    );
  } catch (error) {
    console.error('Error recording share:', error);
    return NextResponse.json(
      { message: 'Failed to record share' },
      { status: 500 }
    );
  }
}
