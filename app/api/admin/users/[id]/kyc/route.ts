import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { setUserKycStatus, type AdminKycStatus } from '@/lib/server/adminStore';

const VALID_STATUSES: AdminKycStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid KYC status. Must be PENDING, APPROVED, or REJECTED' },
        { status: 400 }
      );
    }

    const user = setUserKycStatus(params.id, status);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'User KYC status updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user KYC status:', error);
    return NextResponse.json(
      { error: 'Failed to update user KYC status' },
      { status: 500 }
    );
  }
}
