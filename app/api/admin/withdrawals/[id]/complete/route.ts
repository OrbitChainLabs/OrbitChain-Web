import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { getWithdrawalById, completeWithdrawal } from '@/lib/server/adminStore';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { transactionHash } = body;

    if (!transactionHash || transactionHash.trim().length === 0) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
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

    if (withdrawal.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved withdrawals can be completed' },
        { status: 400 }
      );
    }

    const completed = completeWithdrawal(params.id, transactionHash.trim());

    return NextResponse.json({
      message: 'Withdrawal completed successfully',
      withdrawal: completed
    });
  } catch (error) {
    console.error('Error completing withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to complete withdrawal' },
      { status: 500 }
    );
  }
}
