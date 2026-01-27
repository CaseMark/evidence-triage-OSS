/**
 * Database provisioning for Evidence Triage
 * Each API key gets its own database for data isolation
 */

import { CaseDevClient } from './client';

const DATABASE_PROJECT_ID_KEY = 'case-dev-database-project-id';

/**
 * Get or create a database for the current API key
 * Returns the database project ID
 */
export async function getOrCreateDatabase(client: CaseDevClient): Promise<string> {
  // Check if we already have a database project ID in localStorage
  const storedProjectId = getStoredDatabaseProjectId();

  if (storedProjectId) {
    try {
      // Verify the database still exists
      await client.getDatabaseProject(storedProjectId);
      console.log('[Database] Using existing database:', storedProjectId);
      return storedProjectId;
    } catch (error) {
      console.warn('[Database] Stored database not found, creating new one:', error);
      // Clear invalid project ID
      clearStoredDatabaseProjectId();
    }
  }

  // Create a new database
  console.log('[Database] Creating new database...');
  const projectName = generateDatabaseName();

  try {
    const project = await client.createDatabaseProject({
      name: projectName,
      region: 'aws-us-east-1',
    });

    console.log('[Database] Database created:', project.id);

    // Store the project ID for future use
    storeDatabaseProjectId(project.id);

    return project.id;
  } catch (error) {
    console.error('[Database] Failed to create database:', error);
    throw new Error('Failed to create database. Please try again.');
  }
}

/**
 * Generate a unique database name for evidence triage
 */
function generateDatabaseName(): string {
  const timestamp = Date.now().toString(36); // Base-36 timestamp
  const random = Math.random().toString(36).substring(2, 8); // Random suffix
  return `evidence-triage-${timestamp}-${random}`.toLowerCase();
}

/**
 * Get stored database project ID from localStorage
 */
export function getStoredDatabaseProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DATABASE_PROJECT_ID_KEY);
}

/**
 * Store database project ID in localStorage
 */
function storeDatabaseProjectId(projectId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DATABASE_PROJECT_ID_KEY, projectId);
}

/**
 * Clear stored database project ID
 */
export function clearStoredDatabaseProjectId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DATABASE_PROJECT_ID_KEY);
}

/**
 * Check if database is provisioned
 */
export async function isDatabaseProvisioned(client: CaseDevClient): Promise<boolean> {
  const projectId = getStoredDatabaseProjectId();
  if (!projectId) return false;

  try {
    await client.getDatabaseProject(projectId);
    return true;
  } catch (error) {
    return false;
  }
}
