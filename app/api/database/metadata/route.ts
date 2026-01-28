/**
 * /api/database/metadata
 *
 * CRUD operations for evidence metadata in the database
 *
 * GET - Get all metadata for a vault (or single by objectId)
 * POST - Save metadata
 * PUT - Update metadata
 * DELETE - Delete metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllEvidenceMetadata,
  getEvidenceMetadataByObjectId,
  saveEvidenceMetadata,
  updateEvidenceMetadata,
  deleteEvidenceMetadata,
  deleteEvidenceMetadataByObjectId,
  EvidenceMetadataInput,
} from '@/lib/case-dev/evidence-db';

/**
 * GET /api/database/metadata
 * Query params: apiKey, projectId, vaultId, objectId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const projectId = searchParams.get('projectId');
    const vaultId = searchParams.get('vaultId');
    const objectId = searchParams.get('objectId');

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

    // If objectId provided, get single metadata
    if (objectId) {
      const metadata = await getEvidenceMetadataByObjectId(apiKey, projectId, objectId);
      return NextResponse.json({
        success: true,
        metadata,
      });
    }

    // Otherwise get all metadata for vault
    if (!vaultId) {
      return NextResponse.json(
        { error: 'Vault ID is required when not querying by objectId' },
        { status: 400 }
      );
    }

    const metadata = await getAllEvidenceMetadata(apiKey, projectId, vaultId);
    return NextResponse.json({
      success: true,
      metadata,
      count: metadata.length,
    });
  } catch (error: any) {
    console.error('[Database Metadata GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get metadata' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/database/metadata
 * Body: { apiKey, projectId, metadata: EvidenceMetadataInput }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, projectId, metadata } = body;

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

    if (!metadata) {
      return NextResponse.json(
        { error: 'Metadata is required' },
        { status: 400 }
      );
    }

    const success = await saveEvidenceMetadata(apiKey, projectId, metadata as EvidenceMetadataInput);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Metadata saved successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to save metadata' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Database Metadata POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save metadata' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/database/metadata
 * Body: { apiKey, projectId, id, updates }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, projectId, id, updates } = body;

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

    if (!id) {
      return NextResponse.json(
        { error: 'Metadata ID is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'Updates are required' },
        { status: 400 }
      );
    }

    const success = await updateEvidenceMetadata(apiKey, projectId, id, updates);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Metadata updated successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to update metadata' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Database Metadata PUT] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update metadata' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/database/metadata
 * Body: { apiKey, projectId, id?, objectId? }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, projectId, id, objectId } = body;

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

    if (!id && !objectId) {
      return NextResponse.json(
        { error: 'Either ID or objectId is required' },
        { status: 400 }
      );
    }

    let success: boolean;
    if (objectId) {
      success = await deleteEvidenceMetadataByObjectId(apiKey, projectId, objectId);
    } else {
      success = await deleteEvidenceMetadata(apiKey, projectId, id);
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Metadata deleted successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete metadata' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Database Metadata DELETE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete metadata' },
      { status: 500 }
    );
  }
}
