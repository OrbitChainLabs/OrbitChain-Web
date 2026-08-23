import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/auth/requireAdmin';
import { listUsers, createUser } from '@/lib/server/adminStore';

export async function GET(request: NextRequest) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    return NextResponse.json(listUsers());
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminResponse(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const newUser = createUser(body);
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
