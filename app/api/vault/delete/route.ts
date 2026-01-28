/**
 * POST /api/vault/delete
 *
 * Delete a document from the vault
 * Using POST instead of DELETE for simpler body parsing
 * This is a server-side proxy to avoid CORS issues with case.dev API
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClient } from '@/lib/case-dev/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, vaultId, objectId } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!vaultId || !objectId) {
      return NextResponse.json(
        { error: 'vaultId and objectId are required' },
        { status: 400 }
      );
    }

    const client = new CaseDevClient(apiKey);

    await client.deleteVaultObject({ vaultId, objectId });

    console.log('[Vault Delete] Deleted:', objectId);

    return NextResponse.json({
      success: true,
      deletedObjectId: objectId,
    });
  } catch (error: any) {
    console.error('[Vault Delete] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
