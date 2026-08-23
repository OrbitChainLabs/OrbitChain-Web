import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { getWithdrawalById, deleteWithdrawalById } from '@/lib/server/adminStore';

export async function GET(
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

    return NextResponse.json(withdrawal);
  } catch (error) {
    console.error('Error fetching withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    if (!deleteWithdrawalById(params.id)) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Withdrawal deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to delete withdrawal' },
      { status: 500 }
    );
  }
}
