/**
 * Database provisioning for Evidence Triage
 * Each API key gets its own database for data isolation
 * Database naming convention: evd_triageOSS__{timestamp}_{random}
 */

import { CaseDevClient } from './client';

const DATABASE_PROJECT_ID_KEY = 'case-dev-database-project-id';
const DATABASE_NAME_PREFIX = 'evd_triageOSS__';

export interface DatabaseInfo {
  projectId: string;
  name: string;
  status: 'existing' | 'created' | 'error';
  connectionUri?: string;
}

/**
 * Find a database with the app's unique prefix
 */
export async function findDatabaseWithPrefix(client: CaseDevClient): Promise<{
  id: string;
  name: string;
} | null> {
  try {
    const databases = await client.listDatabaseProjects();
    const matching = databases.find(db => db.name.startsWith(DATABASE_NAME_PREFIX));
    return matching ? { id: matching.id, name: matching.name } : null;
  } catch (error) {
    console.error('[Database] Error listing databases:', error);
    return null;
  }
}

/**
 * Generate a unique database name with the app prefix
 */
function generateDatabaseName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${DATABASE_NAME_PREFIX}${timestamp}_${random}`;
}

/**
 * Get or create a database for this app
 * 1. Check localStorage for stored project ID
 * 2. If not found, list all databases and find one with our prefix
 * 3. If still not found, create a new one
 */
export async function getOrCreateDatabase(client: CaseDevClient): Promise<DatabaseInfo> {
  // Check if we already have a database project ID in localStorage
  const storedProjectId = getStoredDatabaseProjectId();

  if (storedProjectId) {
    try {
      // Verify the database still exists
      const project = await client.getDatabaseProject(storedProjectId);
      console.log('[Database] Using stored database:', storedProjectId, project.name);
      return {
        projectId: storedProjectId,
        name: project.name,
        status: 'existing',
      };
    } catch (error) {
      console.warn('[Database] Stored database not found, searching for existing...', error);
      clearStoredDatabaseProjectId();
    }
  }

  // Search for existing database with our prefix
  console.log('[Database] Searching for database with prefix:', DATABASE_NAME_PREFIX);
  const existingDb = await findDatabaseWithPrefix(client);

  if (existingDb) {
    console.log('[Database] Found existing database:', existingDb.id, existingDb.name);
    storeDatabaseProjectId(existingDb.id);
    return {
      projectId: existingDb.id,
      name: existingDb.name,
      status: 'existing',
    };
  }

  // Create a new database
  console.log('[Database] Creating new database...');
  const projectName = generateDatabaseName();

  try {
    const project = await client.createDatabaseProject({
      name: projectName,
      region: 'aws-us-east-1',
    });

    console.log('[Database] Database created:', project.id, project.name);
    storeDatabaseProjectId(project.id);

    return {
      projectId: project.id,
      name: project.name,
      status: 'created',
    };
  } catch (error) {
    console.error('[Database] Failed to create database:', error);
    return {
      projectId: '',
      name: '',
      status: 'error',
    };
  }
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
export function storeDatabaseProjectId(projectId: string): void {
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

/**
 * Get database connection string for the stored project
 */
export async function getDatabaseConnectionString(client: CaseDevClient): Promise<string | null> {
  const projectId = getStoredDatabaseProjectId();
  if (!projectId) return null;

  try {
    const connection = await client.getDatabaseConnection(projectId);
    return connection.connectionUri;
  } catch (error) {
    console.error('[Database] Failed to get connection string:', error);
    return null;
  }
}

export { DATABASE_NAME_PREFIX };
