/**
 * GET /api/vault/list-objects
 *
 * List all objects in a vault
 * This is a server-side proxy to avoid CORS issues with case.dev API
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClient } from '@/lib/case-dev/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const vaultId = searchParams.get('vaultId');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!vaultId) {
      return NextResponse.json(
        { error: 'Vault ID is required' },
        { status: 400 }
      );
    }

    const client = new CaseDevClient(apiKey);

    const objects = await client.listVaultObjects(vaultId);

    return NextResponse.json({
      success: true,
      objects,
      count: objects.length,
    });
  } catch (error: any) {
    console.error('[Vault List Objects] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list vault objects' },
      { status: 500 }
    );
  }
}
