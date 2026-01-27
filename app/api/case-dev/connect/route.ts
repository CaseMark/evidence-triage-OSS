/**
 * POST /api/case-dev/connect
 *
 * Verify case.dev API key and provision database if needed
 * Validates format and verifies key works
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClientManager, CaseDevClient } from '@/lib/case-dev/client';

function validateApiKeyFormat(key: string): boolean {
  return key.startsWith('sk_case_') && key.length >= 20;
}

function getLast4(key: string): string {
  return key.slice(-4);
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

    // Provision database (non-blocking)
    let databaseStatus = 'provisioning';
    let projectId: string | undefined;

    try {
      const client = new CaseDevClient(apiKey);

      // Check if user provided an existing database project ID
      const { existingProjectId } = body;

      if (existingProjectId) {
        // Verify the existing project belongs to this API key
        try {
          await client.getDatabaseProject(existingProjectId);
          databaseStatus = 'existing';
          projectId = existingProjectId;
          console.log('[Database] Using existing database:', existingProjectId);
        } catch (error) {
          console.warn('[Database] Existing project not found, will create new one');
          // Fall through to create new database
        }
      }

      // Create new database if no existing one
      if (!projectId) {
        const projectName = `evidence-triage-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
        const project = await client.createDatabaseProject({
          name: projectName,
          region: 'aws-us-east-1',
        });

        databaseStatus = 'created';
        projectId = project.id;
        console.log('[Database] Created new database:', projectId);
      }
    } catch (dbError) {
      console.error('[Database] Database provisioning failed:', dbError);
      databaseStatus = 'error';
      // Don't fail the API key verification if database provisioning fails
    }

    return NextResponse.json({
      success: true,
      message: 'case.dev API key verified successfully',
      last4: getLast4(apiKey),
      database: {
        status: databaseStatus,
        projectId,
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
