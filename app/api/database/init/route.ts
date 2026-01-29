/**
 * POST /api/database/init
 *
 * Initialize the database (create tables if not exist)
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/case-dev/evidence-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, projectId } = body;

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

    const success = await initializeDatabase(apiKey, projectId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Database initialized successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to initialize database' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Database Init] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize database' },
      { status: 500 }
    );
  }
}
