/**
 * Evidence Database Client
 *
 * Handles PostgreSQL operations for evidence metadata storage.
 * Uses Neon serverless driver for database connections.
 * Auto-creates the evidence_metadata table on first use.
 */

import { neon } from '@neondatabase/serverless';
import { CaseDevClient } from './client';
import { EvidenceCategory } from '../types/evidence';

// Table schema for evidence metadata
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS evidence_metadata (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  object_id TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  category TEXT NOT NULL DEFAULT 'other',
  tags TEXT[] DEFAULT '{}',
  summary TEXT,
  date_detected TEXT,
  thumbnail_data_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_metadata_vault_id ON evidence_metadata(vault_id);
CREATE INDEX IF NOT EXISTS idx_evidence_metadata_object_id ON evidence_metadata(object_id);
CREATE INDEX IF NOT EXISTS idx_evidence_metadata_category ON evidence_metadata(category);
`;

export interface EvidenceMetadataRow {
  id: string;
  vault_id: string;
  object_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  category: string;
  tags: string[];
  summary: string | null;
  date_detected: string | null;
  thumbnail_data_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceMetadataInput {
  id: string;
  vaultId: string;
  objectId: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  category: EvidenceCategory;
  tags: string[];
  summary?: string;
  dateDetected?: string;
  thumbnailDataUrl?: string;
}

/**
 * Get a database SQL executor for a project
 */
async function getSql(apiKey: string, projectId: string) {
  const client = new CaseDevClient(apiKey);
  const connection = await client.getDatabaseConnection(projectId);
  return neon(connection.connectionUri);
}

/**
 * Initialize the database (create tables if not exist)
 */
export async function initializeDatabase(apiKey: string, projectId: string): Promise<boolean> {
  try {
    const sql = await getSql(apiKey, projectId);

    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS evidence_metadata (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        object_id TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT,
        size_bytes INTEGER,
        category TEXT NOT NULL DEFAULT 'other',
        tags TEXT[] DEFAULT '{}',
        summary TEXT,
        date_detected TEXT,
        thumbnail_data_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_evidence_metadata_vault_id ON evidence_metadata(vault_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_evidence_metadata_object_id ON evidence_metadata(object_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_evidence_metadata_category ON evidence_metadata(category)`;

    return true;
  } catch (error) {
    console.error('[EvidenceDB] Failed to initialize database:', error);
    return false;
  }
}

/**
 * Save evidence metadata to database
 */
export async function saveEvidenceMetadata(
  apiKey: string,
  projectId: string,
  metadata: EvidenceMetadataInput
): Promise<boolean> {
  try {
    const sql = await getSql(apiKey, projectId);

    await sql`
      INSERT INTO evidence_metadata (
        id, vault_id, object_id, filename, content_type, size_bytes,
        category, tags, summary, date_detected, thumbnail_data_url,
        created_at, updated_at
      ) VALUES (
        ${metadata.id},
        ${metadata.vaultId},
        ${metadata.objectId},
        ${metadata.filename},
        ${metadata.contentType || null},
        ${metadata.sizeBytes || null},
        ${metadata.category},
        ${metadata.tags},
        ${metadata.summary || null},
        ${metadata.dateDetected || null},
        ${metadata.thumbnailDataUrl || null},
        NOW(),
        NOW()
      )
      ON CONFLICT (object_id) DO UPDATE SET
        filename = EXCLUDED.filename,
        content_type = EXCLUDED.content_type,
        size_bytes = EXCLUDED.size_bytes,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        summary = EXCLUDED.summary,
        date_detected = EXCLUDED.date_detected,
        thumbnail_data_url = EXCLUDED.thumbnail_data_url,
        updated_at = NOW()
    `;

    return true;
  } catch (error) {
    console.error('[EvidenceDB] Failed to save metadata:', error);
    return false;
  }
}

/**
 * Get all evidence metadata for a vault
 */
export async function getAllEvidenceMetadata(
  apiKey: string,
  projectId: string,
  vaultId: string
): Promise<EvidenceMetadataRow[]> {
  try {
    const sql = await getSql(apiKey, projectId);

    const rows = await sql`
      SELECT * FROM evidence_metadata
      WHERE vault_id = ${vaultId}
      ORDER BY created_at DESC
    `;

    return rows as EvidenceMetadataRow[];
  } catch (error) {
    console.error('[EvidenceDB] Failed to get all metadata:', error);
    return [];
  }
}

/**
 * Get evidence metadata by object ID
 */
export async function getEvidenceMetadataByObjectId(
  apiKey: string,
  projectId: string,
  objectId: string
): Promise<EvidenceMetadataRow | null> {
  try {
    const sql = await getSql(apiKey, projectId);

    const rows = await sql`
      SELECT * FROM evidence_metadata
      WHERE object_id = ${objectId}
      LIMIT 1
    `;

    return rows.length > 0 ? (rows[0] as EvidenceMetadataRow) : null;
  } catch (error) {
    console.error('[EvidenceDB] Failed to get metadata by objectId:', error);
    return null;
  }
}

/**
 * Get evidence metadata by ID
 */
export async function getEvidenceMetadataById(
  apiKey: string,
  projectId: string,
  id: string
): Promise<EvidenceMetadataRow | null> {
  try {
    const sql = await getSql(apiKey, projectId);

    const rows = await sql`
      SELECT * FROM evidence_metadata
      WHERE id = ${id}
      LIMIT 1
    `;

    return rows.length > 0 ? (rows[0] as EvidenceMetadataRow) : null;
  } catch (error) {
    console.error('[EvidenceDB] Failed to get metadata by id:', error);
    return null;
  }
}

/**
 * Update evidence metadata
 */
export async function updateEvidenceMetadata(
  apiKey: string,
  projectId: string,
  id: string,
  updates: Partial<Omit<EvidenceMetadataInput, 'id' | 'vaultId' | 'objectId'>>
): Promise<boolean> {
  try {
    const sql = await getSql(apiKey, projectId);

    // Build dynamic update - only update provided fields
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.filename !== undefined) {
      setClauses.push(`filename = $${paramIndex++}`);
      values.push(updates.filename);
    }
    if (updates.contentType !== undefined) {
      setClauses.push(`content_type = $${paramIndex++}`);
      values.push(updates.contentType);
    }
    if (updates.sizeBytes !== undefined) {
      setClauses.push(`size_bytes = $${paramIndex++}`);
      values.push(updates.sizeBytes);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}`);
      values.push(updates.tags);
    }
    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(updates.summary);
    }
    if (updates.dateDetected !== undefined) {
      setClauses.push(`date_detected = $${paramIndex++}`);
      values.push(updates.dateDetected);
    }
    if (updates.thumbnailDataUrl !== undefined) {
      setClauses.push(`thumbnail_data_url = $${paramIndex++}`);
      values.push(updates.thumbnailDataUrl);
    }

    // Use tagged template for simple update
    await sql`
      UPDATE evidence_metadata
      SET
        category = COALESCE(${updates.category}, category),
        tags = COALESCE(${updates.tags}, tags),
        summary = COALESCE(${updates.summary}, summary),
        date_detected = COALESCE(${updates.dateDetected}, date_detected),
        thumbnail_data_url = COALESCE(${updates.thumbnailDataUrl}, thumbnail_data_url),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    return true;
  } catch (error) {
    console.error('[EvidenceDB] Failed to update metadata:', error);
    return false;
  }
}

/**
 * Delete evidence metadata
 */
export async function deleteEvidenceMetadata(
  apiKey: string,
  projectId: string,
  id: string
): Promise<boolean> {
  try {
    const sql = await getSql(apiKey, projectId);

    await sql`
      DELETE FROM evidence_metadata
      WHERE id = ${id}
    `;

    return true;
  } catch (error) {
    console.error('[EvidenceDB] Failed to delete metadata:', error);
    return false;
  }
}

/**
 * Delete evidence metadata by object ID
 */
export async function deleteEvidenceMetadataByObjectId(
  apiKey: string,
  projectId: string,
  objectId: string
): Promise<boolean> {
  try {
    const sql = await getSql(apiKey, projectId);

    await sql`
      DELETE FROM evidence_metadata
      WHERE object_id = ${objectId}
    `;

    return true;
  } catch (error) {
    console.error('[EvidenceDB] Failed to delete metadata:', error);
    return false;
  }
}

/**
 * Get category counts for a vault
 */
export async function getCategoryCounts(
  apiKey: string,
  projectId: string,
  vaultId: string
): Promise<Record<string, number>> {
  try {
    const sql = await getSql(apiKey, projectId);

    const rows = await sql`
      SELECT category, COUNT(*) as count
      FROM evidence_metadata
      WHERE vault_id = ${vaultId}
      GROUP BY category
    `;

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.category as string] = Number(row.count);
    }
    return counts;
  } catch (error) {
    console.error('[EvidenceDB] Failed to get category counts:', error);
    return {};
  }
}

/**
 * Get all unique tags for a vault
 */
export async function getAllTags(
  apiKey: string,
  projectId: string,
  vaultId: string
): Promise<string[]> {
  try {
    const sql = await getSql(apiKey, projectId);

    const rows = await sql`
      SELECT DISTINCT unnest(tags) as tag
      FROM evidence_metadata
      WHERE vault_id = ${vaultId}
      ORDER BY tag
    `;

    return rows.map(row => row.tag as string);
  } catch (error) {
    console.error('[EvidenceDB] Failed to get all tags:', error);
    return [];
  }
}

/**
 * Check if database table exists
 */
export async function checkTableExists(
  apiKey: string,
  projectId: string
): Promise<boolean> {
  try {
    const sql = await getSql(apiKey, projectId);

    const rows = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'evidence_metadata'
      ) as exists
    `;

    return rows[0]?.exists === true;
  } catch (error) {
    console.error('[EvidenceDB] Failed to check table existence:', error);
    return false;
  }
}
