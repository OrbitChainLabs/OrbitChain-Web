import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { setUserRole, type AdminUserRole } from '@/lib/server/adminStore';

const VALID_ROLES: AdminUserRole[] = ['USER', 'CREATOR', 'ADMIN'];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be USER, CREATOR, or ADMIN' },
        { status: 400 }
      );
    }

    const user = setUserRole(params.id, role);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}
