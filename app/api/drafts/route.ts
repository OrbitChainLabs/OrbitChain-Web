import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/verifyToken';
import {
  listDrafts,
  saveDraft,
  validateDraftPayload,
  draftSerializedSizeBytes,
  MAX_DRAFT_SIZE_BYTES,
} from '@/lib/server/draftStore';

// Helper to extract a verified user ID from the token cookie.
// The token is validated against the API (signature + expiry); the decoded
// payload is never trusted on its own.
async function getVerifiedUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;

  const verified = await verifyToken(token);
  return verified?.userId ?? null;
}

// GET /api/drafts - List all drafts for the current user
export async function GET(request: NextRequest) {
  try {
    const userId = await getVerifiedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userDrafts = await listDrafts(userId);
    return NextResponse.json(userDrafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/drafts - Create or update a draft
export async function POST(request: NextRequest) {
  try {
    const userId = await getVerifiedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();

    if (!validateDraftPayload(body)) {
      return NextResponse.json(
        {
          error:
            'Invalid draft payload. Expected { id, title, currentStep, formData }',
        },
        { status: 400 }
      );
    }

    if (draftSerializedSizeBytes(body) > MAX_DRAFT_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Draft is too large to save' },
        { status: 413 }
      );
    }

    const saved = await saveDraft(userId, body);

    return NextResponse.json(saved);
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
