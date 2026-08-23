import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { getWithdrawalById, approveWithdrawal } from '@/lib/server/adminStore';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const withdrawal = getWithdrawalById(params.id);
    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending withdrawals can be approved' },
        { status: 400 }
      );
    }

    const approved = approveWithdrawal(params.id);

    return NextResponse.json({
      message: 'Withdrawal approved successfully',
      withdrawal: approved
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to approve withdrawal' },
      { status: 500 }
    );
  }
}
