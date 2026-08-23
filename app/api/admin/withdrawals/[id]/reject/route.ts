import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { getWithdrawalById, rejectWithdrawal } from '@/lib/server/adminStore';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const withdrawal = getWithdrawalById(params.id);
    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending withdrawals can be rejected' },
        { status: 400 }
      );
    }

    const rejected = rejectWithdrawal(params.id, reason.trim());

    return NextResponse.json({
      message: 'Withdrawal rejected successfully',
      withdrawal: rejected
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to reject withdrawal' },
      { status: 500 }
    );
  }
}
