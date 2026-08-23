import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { toggleUserSuspension } from '@/lib/server/adminStore';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const user = toggleUserSuspension(params.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `User ${user.isSuspended ? 'suspended' : 'unsuspended'} successfully`,
      user
    });
  } catch (error) {
    console.error('Error updating user suspension status:', error);
    return NextResponse.json(
      { error: 'Failed to update user suspension status' },
      { status: 500 }
    );
  }
}
