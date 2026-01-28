/**
 * GET /api/database/stats
 *
 * Get category counts and tags for a vault
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCategoryCounts, getAllTags } from '@/lib/case-dev/evidence-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const projectId = searchParams.get('projectId');
    const vaultId = searchParams.get('vaultId');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!vaultId) {
      return NextResponse.json(
        { error: 'Vault ID is required' },
        { status: 400 }
      );
    }

    const [categoryCounts, allTags] = await Promise.all([
      getCategoryCounts(apiKey, projectId, vaultId),
      getAllTags(apiKey, projectId, vaultId),
    ]);

    return NextResponse.json({
      success: true,
      categoryCounts,
      tags: allTags,
    });
  } catch (error: any) {
    console.error('[Database Stats] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
