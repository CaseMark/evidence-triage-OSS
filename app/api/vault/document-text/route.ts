/**
 * POST /api/vault/document-text
 *
 * Get extracted text (OCR results) from a vault document
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

    const result = await client.getVaultObjectText({ vaultId, objectId });

    return NextResponse.json({
      success: true,
      text: result.text || '',
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[Vault Document Text] Error:', error);

    // Check if it's a "not ready" error (document still processing)
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return NextResponse.json({
        success: false,
        text: null,
        error: 'Document text not ready yet',
        status: 'processing',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to get document text' },
      { status: 500 }
    );
  }
}
