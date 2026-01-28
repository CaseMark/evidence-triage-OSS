/**
 * POST /api/vault/ingest
 *
 * Trigger (re-)ingestion of a vault object
 * This processes the document for OCR, text extraction, and search indexing
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

    console.log('[Vault Ingest] Triggering ingestion for:', objectId);
    const result = await client.ingestObject({ vaultId, objectId });
    console.log('[Vault Ingest] Result:', result);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[Vault Ingest] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ingest object' },
      { status: 500 }
    );
  }
}
