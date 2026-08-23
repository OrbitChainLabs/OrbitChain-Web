import { NextRequest, NextResponse } from 'next/server';
import type { CampaignShareStats, ApiResponse } from '@/types/api';
import { getShareStats } from '@/lib/server/shareStore';

/**
 * GET /api/campaigns/[id]/shares/stats
 * Gets share statistics for a campaign from the shared durable store.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const stats = await getShareStats(campaignId);

    return NextResponse.json<ApiResponse<CampaignShareStats>>(
      {
        data: stats,
        status: 200,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching share stats:', error);
    return NextResponse.json(
      { message: 'Failed to fetch share stats' },
      { status: 500 }
    );
  }
}
