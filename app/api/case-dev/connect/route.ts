/**
 * POST /api/case-dev/connect
 *
 * Verify case.dev API key, provision database and vault
 * Workflow:
 * 1. Validate API key format
 * 2. Verify key works by making test API call
 * 3. List all databases and find one with our prefix (evd_triageOSS__)
 * 4. If found, use it; if not, create one with the prefix
 * 5. Initialize or get the evidence vault
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClientManager, CaseDevClient } from '@/lib/case-dev/client';
import { findDatabaseWithPrefix, DATABASE_NAME_PREFIX } from '@/lib/case-dev/database';

const VAULT_NAME = 'evd_triageOSS_evidence';

function validateApiKeyFormat(key: string): boolean {
  return key.startsWith('sk_case_') && key.length >= 20;
}

function getLast4(key: string): string {
  return key.slice(-4);
}

/**
 * Generate a unique database name with the app prefix
 */
function generateDatabaseName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${DATABASE_NAME_PREFIX}${timestamp}_${random}`;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate format
    if (!validateApiKeyFormat(apiKey)) {
      return NextResponse.json(
        {
          error: 'Invalid API key format. Key should start with sk_case_ and be at least 20 characters',
        },
        { status: 400 }
      );
    }

    // Verify key works by making test API call
    const verification = await CaseDevClientManager.verifyApiKey(apiKey);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Failed to verify API key' },
        { status: 400 }
      );
    }

    // Database discovery workflow
    let databaseStatus: 'existing' | 'created' | 'error' = 'error';
    let projectId: string | undefined;
    let projectName: string | undefined;

    try {
      const client = new CaseDevClient(apiKey);

      // Check if user provided an existing database project ID
      const { existingProjectId } = body;

      if (existingProjectId) {
        // Verify the existing project belongs to this API key
        try {
          const project = await client.getDatabaseProject(existingProjectId);
          databaseStatus = 'existing';
          projectId = existingProjectId;
          projectName = project.name;
          console.log('[Database] Using provided existing database:', existingProjectId);
        } catch (error) {
          console.warn('[Database] Provided project not found, searching for existing...');
        }
      }

      // If no valid existing project, search for one with our prefix
      if (!projectId) {
        console.log('[Database] Searching for database with prefix:', DATABASE_NAME_PREFIX);
        const existingDb = await findDatabaseWithPrefix(client);

        if (existingDb) {
          databaseStatus = 'existing';
          projectId = existingDb.id;
          projectName = existingDb.name;
          console.log('[Database] Found existing database:', existingDb.id, existingDb.name);
        }
      }

      // Create new database if none found
      if (!projectId) {
        const newProjectName = generateDatabaseName();
        console.log('[Database] Creating new database:', newProjectName);

        const project = await client.createDatabaseProject({
          name: newProjectName,
          region: 'aws-us-east-1',
        });

        databaseStatus = 'created';
        projectId = project.id;
        projectName = project.name;
        console.log('[Database] Created new database:', projectId, projectName);
      }
    } catch (dbError) {
      console.error('[Database] Database provisioning failed:', dbError);
      databaseStatus = 'error';
      // Don't fail the API key verification if database provisioning fails
    }

    // Vault initialization workflow (similar to database discovery)
    let vaultStatus: 'existing' | 'created' | 'error' = 'error';
    let vaultId: string | undefined;
    let vaultName: string | undefined;

    try {
      const client = new CaseDevClient(apiKey);
      const { existingVaultId } = body;

      // Step 1: Check if user provided an existing vault ID
      if (existingVaultId) {
        try {
          const vault = await client.getVault(existingVaultId);
          vaultStatus = 'existing';
          vaultId = existingVaultId;
          vaultName = vault.name;
          console.log('[Vault] Using provided existing vault:', existingVaultId, vault.name);
        } catch (error) {
          console.warn('[Vault] Provided vault not found, searching for existing...');
        }
      }

      // Step 2: Search for existing vault by prefix (like database discovery)
      if (!vaultId) {
        console.log('[Vault] Searching for vault with prefix:', VAULT_NAME);
        const existingVault = await client.findVaultByPrefix(VAULT_NAME);

        if (existingVault) {
          vaultStatus = 'existing';
          vaultId = existingVault.id;
          vaultName = existingVault.name;
          console.log('[Vault] Found existing vault:', existingVault.id, existingVault.name);
        }
      }

      // Step 3: Create new vault if none found
      if (!vaultId) {
        console.log('[Vault] Creating new vault:', VAULT_NAME);
        const vault = await client.createVault({
          name: VAULT_NAME,
          description: 'Evidence Triage Document Storage',
          enableIndexing: true,
        });

        vaultStatus = 'created';
        vaultId = vault.id;
        vaultName = vault.name;
        console.log('[Vault] Created new vault:', vault.id, vault.name);
      }
    } catch (vaultError) {
      console.error('[Vault] Vault provisioning failed:', vaultError);
      vaultStatus = 'error';
      // Don't fail the API key verification if vault provisioning fails
    }

    return NextResponse.json({
      success: true,
      message: 'case.dev API key verified successfully',
      last4: getLast4(apiKey),
      database: {
        status: databaseStatus,
        projectId,
        projectName,
      },
      vault: {
        status: vaultStatus,
        vaultId,
        vaultName,
      },
    });
  } catch (error) {
    console.error('[case-dev/connect] Error verifying:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify case.dev API key. Please try again.',
      },
      { status: 500 }
    );
  }
}
