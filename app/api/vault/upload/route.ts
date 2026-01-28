/**
 * POST /api/vault/upload
 *
 * Upload a file to the vault with OCR and semantic indexing
 * This is a server-side proxy to avoid CORS issues with case.dev API
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClient } from '@/lib/case-dev/client';

const VAULT_NAME = 'evd_triageOSS_evidence';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const apiKey = formData.get('apiKey') as string | null;
    const vaultId = formData.get('vaultId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const client = new CaseDevClient(apiKey);

    // Get vault ID - prefer provided ID, then search existing, then create
    let targetVaultId = vaultId;
    if (!targetVaultId) {
      // First try to find existing vault by prefix
      console.log('[Vault Upload] No vault ID provided, searching for existing vault...');
      const existingVault = await client.findVaultByPrefix(VAULT_NAME);

      if (existingVault) {
        targetVaultId = existingVault.id;
        console.log('[Vault Upload] Found existing vault:', existingVault.id, existingVault.name);
      } else {
        // Create new vault if none found
        console.log('[Vault Upload] Creating new vault:', VAULT_NAME);
        const newVault = await client.createVault({
          name: VAULT_NAME,
          description: 'Evidence Triage Document Storage',
          enableIndexing: true,
        });
        targetVaultId = newVault.id;
        console.log('[Vault Upload] Created new vault:', newVault.id, newVault.name);
      }
    }

    console.log('[Vault Upload] Uploading to vault:', targetVaultId, 'File:', file.name);

    // Get upload URL
    const uploadInfo = await client.getUploadUrl({
      vaultId: targetVaultId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      metadata: {
        originalFilename: file.name,
        contentType: file.type,
        uploadedAt: new Date().toISOString(),
        enableOCR: true,
      },
    });

    // Upload file to S3
    const fileBuffer = await file.arrayBuffer();
    const uploadResponse = await fetch(uploadInfo.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file to storage: ${uploadResponse.status}`);
    }

    // Trigger ingestion (OCR, indexing)
    await client.ingestObject({
      vaultId: targetVaultId,
      objectId: uploadInfo.objectId,
    });

    console.log('[Vault Upload] Upload complete:', uploadInfo.objectId);

    return NextResponse.json({
      success: true,
      objectId: uploadInfo.objectId,
      vaultId: targetVaultId,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
  } catch (error: any) {
    console.error('[Vault Upload] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
