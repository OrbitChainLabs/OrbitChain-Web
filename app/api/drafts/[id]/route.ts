import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/verifyToken';

// In-memory store for drafts (same as route.ts)
const draftsStore = new Map<string, any[]>();

// Helper to extract a verified user ID from the token cookie.
// The token is validated against the API (signature + expiry); the decoded
// payload is never trusted on its own.
async function getVerifiedUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;

  const verified = await verifyToken(token);
  return verified?.userId ?? null;
}

// GET /api/drafts/[id] - Get a specific draft
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getVerifiedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userDrafts = draftsStore.get(userId) || [];
    const draft = userDrafts.find((d: any) => d.id === params.id);

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/drafts/[id] - Delete a draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getVerifiedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userDrafts = draftsStore.get(userId) || [];
    const filteredDrafts = userDrafts.filter((d: any) => d.id !== params.id);

    if (filteredDrafts.length === userDrafts.length) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    draftsStore.set(userId, filteredDrafts);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
