/**
 * POST /api/vault/init
 *
 * Initialize or get the evidence vault
 * This is a server-side proxy to avoid CORS issues with case.dev API
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClient } from '@/lib/case-dev/client';

const VAULT_NAME = 'evd_triageOSS_evidence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, existingVaultId } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const client = new CaseDevClient(apiKey);

    // Step 1: If existing vault ID provided, verify it exists
    if (existingVaultId) {
      try {
        const vault = await client.getVault(existingVaultId);
        console.log('[Vault Init] Using existing vault:', existingVaultId, vault.name);
        return NextResponse.json({
          success: true,
          vaultId: existingVaultId,
          vaultName: vault.name,
          status: 'existing',
        });
      } catch (error) {
        console.warn('[Vault Init] Existing vault not found, searching for existing...');
      }
    }

    // Step 2: Search for existing vault by prefix
    console.log('[Vault Init] Searching for vault with prefix:', VAULT_NAME);
    const existingVault = await client.findVaultByPrefix(VAULT_NAME);

    if (existingVault) {
      console.log('[Vault Init] Found existing vault:', existingVault.id, existingVault.name);
      return NextResponse.json({
        success: true,
        vaultId: existingVault.id,
        vaultName: existingVault.name,
        status: 'existing',
      });
    }

    // Step 3: Create new vault if none found
    console.log('[Vault Init] Creating new vault:', VAULT_NAME);
    const vault = await client.createVault({
      name: VAULT_NAME,
      description: 'Evidence Triage Document Storage',
      enableIndexing: true,
    });

    console.log('[Vault Init] Created new vault:', vault.id, vault.name);

    return NextResponse.json({
      success: true,
      vaultId: vault.id,
      vaultName: vault.name,
      status: 'created',
    });
  } catch (error: any) {
    console.error('[Vault Init] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize vault' },
      { status: 500 }
    );
  }
}
