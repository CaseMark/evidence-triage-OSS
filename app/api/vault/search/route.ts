/**
 * POST /api/vault/search
 *
 * Semantic search in vault documents
 * This is a server-side proxy to avoid CORS issues with case.dev API
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClient } from '@/lib/case-dev/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, vaultId, query, method, limit, minScore } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!vaultId) {
      return NextResponse.json(
        { error: 'vaultId is required' },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    const client = new CaseDevClient(apiKey);

    const results = await client.searchVault({
      vaultId,
      query,
      method: method || 'hybrid',
      limit: limit || 20,
      minScore: minScore || 0.3,
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('[Vault Search] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search vault' },
      { status: 500 }
    );
  }
}
