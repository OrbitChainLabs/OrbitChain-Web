import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { listWithdrawals, createWithdrawal } from '@/lib/server/adminStore';

export async function GET(request: NextRequest) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    let filteredWithdrawals = listWithdrawals();

    if (status) {
      filteredWithdrawals = filteredWithdrawals.filter(w => w.status === status);
    }

    if (date) {
      const filterDate = new Date(date);
      filteredWithdrawals = filteredWithdrawals.filter(w => {
        const requestDate = new Date(w.requestDate);
        return requestDate.toDateString() === filterDate.toDateString();
      });
    }

    return NextResponse.json(filteredWithdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const newWithdrawal = createWithdrawal(body);
    return NextResponse.json(newWithdrawal, { status: 201 });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to create withdrawal' },
      { status: 500 }
    );
  }
}
