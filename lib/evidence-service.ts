/**
 * Evidence Service - Vault-based document storage
 *
 * This service integrates with case.dev Vaults for document storage with
 * automatic OCR, vectorization, and semantic search.
 *
 * Architecture:
 * - Vault: Document content + AI search (OCR, vectors, semantic search)
 * - Database: Persistent metadata storage (tags, categories, summaries)
 * - LocalStorage: Cache for quick synchronous reads
 *
 * All vault operations go through server-side API routes to avoid CORS issues.
 * Vault documents are the source of truth for document content.
 * Database is the source of truth for metadata.
 * LocalStorage provides fast synchronous access for UI rendering.
 */

import {
  EvidenceItem,
  EvidenceCategory,
  FilterState,
} from './types/evidence';
import { getStoredApiKey } from '@/components/case-dev/api-key-input';
import { getStoredDatabaseProjectId } from './case-dev/database';

const VAULT_ID_KEY = 'case-dev-vault-id';
const EVIDENCE_METADATA_KEY = 'evidence-metadata';

export interface VaultDocumentRef {
  vaultId: string;
  objectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
}

export interface EvidenceMetadata {
  id: string;
  vaultDocRef: VaultDocumentRef;
  category: EvidenceCategory;
  tags: string[];
  relevanceScore: number;
  summary?: string;
  dateDetected?: string;
  extractedText?: string;
  thumbnailDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultSearchResult {
  objectId: string;
  filename: string;
  score: number;
  matchedText?: string;
  metadata?: Record<string, any>;
}

/**
 * Get stored vault ID from localStorage
 */
export function getStoredVaultId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VAULT_ID_KEY);
}

/**
 * Store vault ID in localStorage
 */
function storeVaultId(vaultId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VAULT_ID_KEY, vaultId);
}

/**
 * Clear stored vault ID
 */
export function clearStoredVaultId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(VAULT_ID_KEY);
}

/**
 * Get all evidence metadata from localStorage
 */
export function getAllEvidenceMetadata(): EvidenceMetadata[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(EVIDENCE_METADATA_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as EvidenceMetadata[];
  } catch (error) {
    console.error('[EvidenceService] Failed to get metadata:', error);
    return [];
  }
}

/**
 * Save all evidence metadata to localStorage
 */
function saveAllEvidenceMetadata(items: EvidenceMetadata[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EVIDENCE_METADATA_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('[EvidenceService] Failed to save metadata:', error);
    // If storage is full, try to clear thumbnails
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const itemsWithoutThumbnails = items.map(item => ({
        ...item,
        thumbnailDataUrl: undefined,
      }));
      localStorage.setItem(EVIDENCE_METADATA_KEY, JSON.stringify(itemsWithoutThumbnails));
    }
  }
}

/**
 * Add evidence metadata (to localStorage cache)
 * For persistent storage, also call saveMetadataToDatabase
 */
export function addEvidenceMetadata(metadata: EvidenceMetadata): void {
  const items = getAllEvidenceMetadata();
  items.push(metadata);
  saveAllEvidenceMetadata(items);
}

/**
 * Save metadata to database (async, for persistent storage)
 */
export async function saveMetadataToDatabase(metadata: EvidenceMetadata): Promise<boolean> {
  const apiKey = getStoredApiKey();
  const projectId = getStoredDatabaseProjectId();

  if (!apiKey || !projectId) {
    console.warn('[EvidenceService] Cannot save to database: missing apiKey or projectId');
    return false;
  }

  try {
    const response = await fetch('/api/database/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        projectId,
        metadata: {
          id: metadata.id,
          vaultId: metadata.vaultDocRef.vaultId,
          objectId: metadata.vaultDocRef.objectId,
          filename: metadata.vaultDocRef.filename,
          contentType: metadata.vaultDocRef.contentType,
          sizeBytes: metadata.vaultDocRef.sizeBytes,
          category: metadata.category,
          tags: metadata.tags,
          summary: metadata.summary,
          dateDetected: metadata.dateDetected,
          thumbnailDataUrl: metadata.thumbnailDataUrl,
        },
      }),
    });

    if (!response.ok) {
      console.error('[EvidenceService] Failed to save metadata to database');
      return false;
    }

    console.log('[EvidenceService] Saved metadata to database:', metadata.vaultDocRef.filename);
    return true;
  } catch (error) {
    console.error('[EvidenceService] Error saving metadata to database:', error);
    return false;
  }
}

/**
 * Update metadata in database (async, for persistent storage)
 */
export async function updateMetadataInDatabase(
  id: string,
  updates: Partial<Omit<EvidenceMetadata, 'id' | 'vaultDocRef'>>
): Promise<boolean> {
  const apiKey = getStoredApiKey();
  const projectId = getStoredDatabaseProjectId();

  if (!apiKey || !projectId) {
    console.warn('[EvidenceService] Cannot update database: missing apiKey or projectId');
    return false;
  }

  try {
    const response = await fetch('/api/database/metadata', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        projectId,
        id,
        updates: {
          category: updates.category,
          tags: updates.tags,
          summary: updates.summary,
          dateDetected: updates.dateDetected,
          thumbnailDataUrl: updates.thumbnailDataUrl,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[EvidenceService] Error updating metadata in database:', error);
    return false;
  }
}

/**
 * Delete metadata from database (async)
 */
export async function deleteMetadataFromDatabase(id: string): Promise<boolean> {
  const apiKey = getStoredApiKey();
  const projectId = getStoredDatabaseProjectId();

  if (!apiKey || !projectId) {
    console.warn('[EvidenceService] Cannot delete from database: missing apiKey or projectId');
    return false;
  }

  try {
    const response = await fetch('/api/database/metadata', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        projectId,
        id,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[EvidenceService] Error deleting metadata from database:', error);
    return false;
  }
}

/**
 * Initialize database tables (call on first connect)
 */
export async function initializeDatabase(): Promise<boolean> {
  const apiKey = getStoredApiKey();
  const projectId = getStoredDatabaseProjectId();

  if (!apiKey || !projectId) {
    console.warn('[EvidenceService] Cannot initialize database: missing apiKey or projectId');
    return false;
  }

  try {
    const response = await fetch('/api/database/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, projectId }),
    });

    if (response.ok) {
      console.log('[EvidenceService] Database initialized successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[EvidenceService] Error initializing database:', error);
    return false;
  }
}

/**
 * Load metadata from database into localStorage cache
 */
export async function loadMetadataFromDatabase(): Promise<EvidenceMetadata[]> {
  const apiKey = getStoredApiKey();
  const projectId = getStoredDatabaseProjectId();
  const vaultId = getStoredVaultId();

  if (!apiKey || !projectId || !vaultId) {
    console.warn('[EvidenceService] Cannot load from database: missing credentials');
    return [];
  }

  try {
    const response = await fetch(
      `/api/database/metadata?apiKey=${encodeURIComponent(apiKey)}&projectId=${encodeURIComponent(projectId)}&vaultId=${encodeURIComponent(vaultId)}`
    );

    if (!response.ok) {
      console.error('[EvidenceService] Failed to load metadata from database');
      return [];
    }

    const data = await response.json();
    const dbRows = data.metadata || [];

    // Convert database rows to EvidenceMetadata format
    const metadata: EvidenceMetadata[] = dbRows.map((row: any) => ({
      id: row.id,
      vaultDocRef: {
        vaultId: row.vault_id,
        objectId: row.object_id,
        filename: row.filename,
        contentType: row.content_type || 'application/octet-stream',
        sizeBytes: row.size_bytes || 0,
        uploadedAt: row.created_at,
        status: 'ready' as const,
      },
      category: row.category as EvidenceCategory,
      tags: row.tags || [],
      relevanceScore: 50, // Default score, not stored in DB
      summary: row.summary,
      dateDetected: row.date_detected,
      thumbnailDataUrl: row.thumbnail_data_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Update localStorage cache
    saveAllEvidenceMetadata(metadata);

    console.log('[EvidenceService] Loaded', metadata.length, 'items from database');
    return metadata;
  } catch (error) {
    console.error('[EvidenceService] Error loading metadata from database:', error);
    return [];
  }
}

/**
 * Update evidence metadata
 */
export function updateEvidenceMetadata(
  id: string,
  updates: Partial<EvidenceMetadata>
): EvidenceMetadata | undefined {
  const items = getAllEvidenceMetadata();
  const index = items.findIndex(item => item.id === id);

  if (index === -1) return undefined;

  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveAllEvidenceMetadata(items);
  return items[index];
}

/**
 * Delete evidence metadata
 */
export function deleteEvidenceMetadata(id: string): boolean {
  const items = getAllEvidenceMetadata();
  const filtered = items.filter(item => item.id !== id);

  if (filtered.length === items.length) return false;

  saveAllEvidenceMetadata(filtered);
  return true;
}

/**
 * Get evidence metadata by ID
 */
export function getEvidenceMetadata(id: string): EvidenceMetadata | undefined {
  const items = getAllEvidenceMetadata();
  return items.find(item => item.id === id);
}

/**
 * Get or create the evidence vault via server-side API
 * This avoids CORS issues by proxying through our API route
 */
export async function getOrCreateVault(): Promise<{ vaultId: string } | null> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    console.error('[EvidenceService] No API key available');
    return null;
  }

  // Check for stored vault ID first
  const storedVaultId = getStoredVaultId();

  try {
    const response = await fetch('/api/vault/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        existingVaultId: storedVaultId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[EvidenceService] Vault init failed:', error);
      return null;
    }

    const data = await response.json();

    if (data.vaultId) {
      storeVaultId(data.vaultId);
      console.log('[EvidenceService] Vault ready:', data.vaultId, data.status);
      return { vaultId: data.vaultId };
    }

    return null;
  } catch (error) {
    console.error('[EvidenceService] Failed to initialize vault:', error);
    return null;
  }
}

/**
 * Upload a document to the vault via server-side API
 * Returns the vault document reference and triggers processing
 */
export async function uploadDocument(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{
  success: boolean;
  docRef?: VaultDocumentRef;
  error?: string
}> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key available' };
  }

  const vaultId = getStoredVaultId();

  onProgress?.('Preparing upload...', 10);

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('apiKey', apiKey);
    if (vaultId) {
      formData.append('vaultId', vaultId);
    }

    onProgress?.('Uploading to vault...', 30);

    const response = await fetch('/api/vault/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || 'Upload failed' };
    }

    const data = await response.json();

    onProgress?.('Processing document...', 70);

    // Store vault ID if we got one
    if (data.vaultId) {
      storeVaultId(data.vaultId);
    }

    const docRef: VaultDocumentRef = {
      vaultId: data.vaultId,
      objectId: data.objectId,
      filename: data.filename || file.name,
      contentType: data.contentType || file.type || 'application/octet-stream',
      sizeBytes: data.sizeBytes || file.size,
      uploadedAt: new Date().toISOString(),
      status: 'processing',
    };

    onProgress?.('Upload complete', 100);

    return { success: true, docRef };
  } catch (error: any) {
    console.error('[EvidenceService] Upload failed:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Get extracted text from a vault document via server-side API
 */
export async function getDocumentText(
  vaultId: string,
  objectId: string
): Promise<string | null> {
  const apiKey = getStoredApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch('/api/vault/document-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, vaultId, objectId }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.text || null;
  } catch (error) {
    console.error('[EvidenceService] Failed to get document text:', error);
    return null;
  }
}

/**
 * Search documents in the vault using semantic search via server-side API
 */
export async function searchVault(
  query: string,
  options?: {
    method?: 'hybrid' | 'fast' | 'local' | 'global';
    limit?: number;
    minScore?: number;
  }
): Promise<VaultSearchResult[]> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    console.log('[EvidenceService] searchVault: No API key');
    return [];
  }

  const vaultId = getStoredVaultId();
  if (!vaultId) {
    console.log('[EvidenceService] searchVault: No vault ID');
    return [];
  }

  console.log('[EvidenceService] searchVault: Searching vault', vaultId, 'for query:', query);

  try {
    const response = await fetch('/api/vault/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        vaultId,
        query,
        method: options?.method || 'hybrid',
        limit: options?.limit || 20,
        minScore: options?.minScore || 0.3,
      }),
    });

    if (!response.ok) {
      console.log('[EvidenceService] searchVault: Response not ok:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('[EvidenceService] searchVault: Got response:', JSON.stringify(data, null, 2));
    return data.results || [];
  } catch (error) {
    console.error('[EvidenceService] Search failed:', error);
    return [];
  }
}

/**
 * Delete a document from the vault via server-side API
 */
export async function deleteVaultDocument(
  vaultId: string,
  objectId: string
): Promise<boolean> {
  const apiKey = getStoredApiKey();
  if (!apiKey) return false;

  try {
    const response = await fetch('/api/vault/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, vaultId, objectId }),
    });

    return response.ok;
  } catch (error) {
    console.error('[EvidenceService] Failed to delete document:', error);
    return false;
  }
}

/**
 * Convert EvidenceMetadata to EvidenceItem for UI compatibility
 */
export function metadataToEvidenceItem(metadata: EvidenceMetadata): EvidenceItem {
  return {
    id: metadata.id,
    filename: metadata.vaultDocRef.filename,
    contentType: metadata.vaultDocRef.contentType,
    sizeBytes: metadata.vaultDocRef.sizeBytes,
    category: metadata.category,
    tags: metadata.tags,
    relevanceScore: metadata.relevanceScore,
    extractedText: metadata.extractedText,
    summary: metadata.summary,
    dateDetected: metadata.dateDetected,
    status: metadata.vaultDocRef.status === 'ready' ? 'completed' :
            metadata.vaultDocRef.status === 'failed' ? 'failed' : 'processing',
    createdAt: metadata.createdAt,
    thumbnailDataUrl: metadata.thumbnailDataUrl,
  };
}

/**
 * Get all evidence as EvidenceItem (for UI compatibility)
 */
export function getAllEvidence(): EvidenceItem[] {
  const metadata = getAllEvidenceMetadata();
  return metadata.map(metadataToEvidenceItem);
}

/**
 * Filter evidence based on filter state
 */
export function filterEvidence(filters: FilterState): EvidenceItem[] {
  let items = getAllEvidence();

  // Filter by categories
  if (filters.categories.length > 0) {
    items = items.filter(item => filters.categories.includes(item.category));
  }

  // Filter by tags
  if (filters.tags.length > 0) {
    items = items.filter(item =>
      filters.tags.some(tag => item.tags.includes(tag))
    );
  }

  // Filter by date range
  if (filters.dateRange.start) {
    items = items.filter(item => {
      const itemDate = item.dateDetected || item.createdAt;
      return itemDate >= filters.dateRange.start!;
    });
  }
  if (filters.dateRange.end) {
    items = items.filter(item => {
      const itemDate = item.dateDetected || item.createdAt;
      return itemDate <= filters.dateRange.end!;
    });
  }

  // Filter by search query (local text search)
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    items = items.filter(item =>
      item.filename.toLowerCase().includes(query) ||
      item.summary?.toLowerCase().includes(query) ||
      item.extractedText?.toLowerCase().includes(query) ||
      item.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Sort
  items.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'date':
        const dateA = a.dateDetected || a.createdAt;
        const dateB = b.dateDetected || b.createdAt;
        comparison = dateA.localeCompare(dateB);
        break;
      case 'relevance':
        comparison = a.relevanceScore - b.relevanceScore;
        break;
      case 'name':
        comparison = a.filename.localeCompare(b.filename);
        break;
    }
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return items;
}

/**
 * Get all unique tags from evidence
 */
export function getAllTags(): string[] {
  const items = getAllEvidenceMetadata();
  const tagSet = new Set<string>();
  items.forEach(item => {
    item.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

/**
 * Get category counts
 */
export function getCategoryCounts(): Record<EvidenceCategory, number> {
  const items = getAllEvidenceMetadata();
  const counts: Record<EvidenceCategory, number> = {
    contract: 0,
    email: 0,
    photo: 0,
    handwritten_note: 0,
    medical_record: 0,
    financial_document: 0,
    legal_filing: 0,
    correspondence: 0,
    report: 0,
    other: 0,
  };

  items.forEach(item => {
    counts[item.category]++;
  });

  return counts;
}

/**
 * Combined search: semantic search in vault + metadata filtering
 * Now returns unmatched vault results with needsSync flag so users can see all documents
 */
export async function hybridSearch(
  query: string,
  filters?: {
    categories?: EvidenceCategory[];
    tags?: string[];
  }
): Promise<{ item: EvidenceItem; score: number }[]> {
  console.log('[EvidenceService] hybridSearch: Starting search for:', query);

  // Get semantic search results from vault via API
  // Using 'hybrid' method which combines vector + BM25 keyword search
  const vaultResults = await searchVault(query, {
    limit: 50,
    minScore: 0.01,
    method: 'hybrid'
  });
  console.log('[EvidenceService] hybridSearch: Got', vaultResults.length, 'vault results');

  // Get all metadata
  const allMetadata = getAllEvidenceMetadata();
  console.log('[EvidenceService] hybridSearch: Have', allMetadata.length, 'metadata records');

  // Map vault results to evidence items with scores
  const results: { item: EvidenceItem; score: number }[] = [];

  for (const result of vaultResults) {
    console.log('[EvidenceService] hybridSearch: Processing vault result:', {
      objectId: result.objectId,
      filename: result.filename,
      rawScore: result.score,
    });

    // Find matching metadata
    const metadata = allMetadata.find(
      m => m.vaultDocRef.objectId === result.objectId
    );
    console.log('[EvidenceService] hybridSearch: Metadata match found:', !!metadata);

    if (metadata) {
      // Apply metadata filters
      if (filters?.categories?.length && !filters.categories.includes(metadata.category)) {
        continue;
      }
      if (filters?.tags?.length && !filters.tags.some(tag => metadata.tags.includes(tag))) {
        continue;
      }

      results.push({
        item: metadataToEvidenceItem(metadata),
        score: Math.round(result.score * 100),
      });
    } else {
      // Create temporary item for unmatched vault document
      // This allows users to see documents that exist in vault but not in local metadata
      const tempItem: EvidenceItem = {
        id: `vault-${result.objectId}`,
        filename: result.filename || 'Unknown document',
        contentType: result.metadata?.contentType || 'application/octet-stream',
        sizeBytes: result.metadata?.size || 0,
        category: 'other',
        tags: [],
        relevanceScore: Math.round(result.score * 100),
        status: 'completed',
        createdAt: result.metadata?.createdAt || new Date().toISOString(),
        needsSync: true, // Flag indicating this needs to be synced
      };

      // Skip filter checks for unmatched documents if filters are applied
      // (they have default 'other' category and no tags)
      if (filters?.categories?.length && !filters.categories.includes('other')) {
        continue;
      }
      if (filters?.tags?.length) {
        continue; // Unmatched documents have no tags
      }

      results.push({
        item: tempItem,
        score: Math.round(result.score * 100),
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  console.log('[EvidenceService] hybridSearch: Final results count:', results.length);
  if (results.length > 0) {
    console.log('[EvidenceService] hybridSearch: First result:', {
      id: results[0].item.id,
      filename: results[0].item.filename,
      score: results[0].score,
    });
  }

  return results;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clear all evidence data
 */
export function clearAllEvidence(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EVIDENCE_METADATA_KEY);
}

/**
 * Sync metadata from database and vault
 * 1. Initialize database tables if needed
 * 2. Load metadata from database into localStorage cache
 * 3. Check vault for any documents not in database
 * 4. Create entries for missing documents in both database and localStorage
 */
export async function syncFromVault(): Promise<{
  synced: number;
  skipped: number;
  fromDatabase: number;
  errors: string[];
}> {
  const result = { synced: 0, skipped: 0, fromDatabase: 0, errors: [] as string[] };

  const apiKey = getStoredApiKey();
  if (!apiKey) {
    result.errors.push('No API key available');
    return result;
  }

  const vaultId = getStoredVaultId();
  if (!vaultId) {
    result.errors.push('No vault ID available');
    return result;
  }

  const projectId = getStoredDatabaseProjectId();

  console.log('[EvidenceService] Starting sync for vault:', vaultId);

  // Step 1: Initialize database if we have project ID
  if (projectId) {
    await initializeDatabase();
  }

  // Step 2: Load existing metadata from database
  let existingMetadata: EvidenceMetadata[] = [];
  if (projectId) {
    console.log('[EvidenceService] Loading metadata from database...');
    existingMetadata = await loadMetadataFromDatabase();
    result.fromDatabase = existingMetadata.length;
    console.log('[EvidenceService] Loaded', existingMetadata.length, 'items from database');
  } else {
    // Fall back to localStorage if no database
    existingMetadata = getAllEvidenceMetadata();
    console.log('[EvidenceService] No database available, using localStorage cache');
  }

  const existingObjectIds = new Set(existingMetadata.map(m => m.vaultDocRef.objectId));

  // Step 3: Fetch all vault objects via API
  try {
    const response = await fetch(`/api/vault/list-objects?apiKey=${encodeURIComponent(apiKey)}&vaultId=${encodeURIComponent(vaultId)}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      result.errors.push(error.error || 'Failed to list vault objects');
      return result;
    }

    const data = await response.json();
    const vaultObjects = data.objects || [];

    console.log('[EvidenceService] Found', vaultObjects.length, 'objects in vault');

    // Step 4: Create metadata for vault objects not in database
    for (const vaultObject of vaultObjects) {
      if (existingObjectIds.has(vaultObject.id)) {
        result.skipped++;
        continue;
      }

      // Create minimal metadata for this vault document
      const metadata: EvidenceMetadata = {
        id: generateId(),
        vaultDocRef: {
          vaultId: vaultId,
          objectId: vaultObject.id,
          filename: vaultObject.filename || 'Unknown',
          contentType: vaultObject.contentType || 'application/octet-stream',
          sizeBytes: vaultObject.size || 0,
          uploadedAt: vaultObject.createdAt || new Date().toISOString(),
          status: vaultObject.status === 'ready' ? 'ready' :
                  vaultObject.status === 'failed' ? 'failed' : 'processing',
        },
        category: 'other', // Default category - can re-classify later
        tags: ['synced-from-vault'],
        relevanceScore: 50, // Default middle score
        createdAt: vaultObject.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to localStorage cache
      addEvidenceMetadata(metadata);

      // Save to database if available
      if (projectId) {
        await saveMetadataToDatabase(metadata);
      }

      result.synced++;
      console.log('[EvidenceService] Synced document:', vaultObject.filename);
    }

    console.log('[EvidenceService] Sync complete:', result);
    return result;
  } catch (error: any) {
    console.error('[EvidenceService] Sync failed:', error);
    result.errors.push(error.message || 'Sync failed');
    return result;
  }
}

/**
 * Debug function to check vault status and document indexing
 * Call from browser console: await window.debugVault()
 */
export async function debugVault(): Promise<void> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    console.error('[Debug] No API key found');
    return;
  }

  const vaultId = getStoredVaultId();
  if (!vaultId) {
    console.error('[Debug] No vault ID found');
    return;
  }

  console.log('[Debug] === VAULT DIAGNOSTIC ===');
  console.log('[Debug] Vault ID:', vaultId);

  try {
    // Get all vault objects
    const listResponse = await fetch(`/api/vault/list-objects?apiKey=${encodeURIComponent(apiKey)}&vaultId=${encodeURIComponent(vaultId)}`);
    const listData = await listResponse.json();

    console.log('[Debug] Vault objects:', listData.objects?.length || 0);

    if (listData.objects && listData.objects.length > 0) {
      for (const obj of listData.objects) {
        console.log('[Debug] ---');
        console.log('[Debug] Object ID:', obj.id);
        console.log('[Debug] Filename:', obj.filename);
        console.log('[Debug] Status:', obj.status);
        console.log('[Debug] Content Type:', obj.contentType);
        console.log('[Debug] Size:', obj.size);

        // Try to get text for this object
        try {
          const textResponse = await fetch('/api/vault/document-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, vaultId, objectId: obj.id }),
          });
          const textData = await textResponse.json();

          if (textData.text) {
            console.log('[Debug] Text extracted: YES (' + textData.text.length + ' chars)');
            console.log('[Debug] Text preview:', textData.text.substring(0, 200) + '...');
          } else {
            console.log('[Debug] Text extracted: NO (still processing or failed)');
          }
        } catch (textError) {
          console.log('[Debug] Text extraction error:', textError);
        }
      }
    }

    // Check local metadata
    const metadata = getAllEvidenceMetadata();
    console.log('[Debug] ---');
    console.log('[Debug] Local metadata records:', metadata.length);
    metadata.forEach(m => {
      console.log('[Debug] - ', m.vaultDocRef.filename, '| objectId:', m.vaultDocRef.objectId, '| status:', m.vaultDocRef.status);
    });

  } catch (error) {
    console.error('[Debug] Error:', error);
  }
}

/**
 * Re-ingest all documents in the vault to trigger reprocessing
 * Call from browser console: await window.reIngestAll()
 */
export async function reIngestAll(): Promise<void> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    console.error('[ReIngest] No API key found');
    return;
  }

  const vaultId = getStoredVaultId();
  if (!vaultId) {
    console.error('[ReIngest] No vault ID found');
    return;
  }

  console.log('[ReIngest] Starting re-ingestion for vault:', vaultId);

  try {
    // Get all vault objects
    const listResponse = await fetch(`/api/vault/list-objects?apiKey=${encodeURIComponent(apiKey)}&vaultId=${encodeURIComponent(vaultId)}`);
    const listData = await listResponse.json();

    if (!listData.objects || listData.objects.length === 0) {
      console.log('[ReIngest] No objects found in vault');
      return;
    }

    console.log('[ReIngest] Found', listData.objects.length, 'objects to re-ingest');

    for (const obj of listData.objects) {
      console.log('[ReIngest] Re-ingesting:', obj.filename, '(', obj.id, ')');

      try {
        const response = await fetch('/api/vault/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, vaultId, objectId: obj.id }),
        });

        if (response.ok) {
          console.log('[ReIngest] ✓ Triggered re-ingestion for:', obj.filename);
        } else {
          const error = await response.json();
          console.log('[ReIngest] ✗ Failed to re-ingest:', obj.filename, error);
        }
      } catch (err) {
        console.log('[ReIngest] ✗ Error re-ingesting:', obj.filename, err);
      }
    }

    console.log('[ReIngest] Done. Documents will be reprocessed in the background.');
    console.log('[ReIngest] Wait a minute and try searching again.');
  } catch (error) {
    console.error('[ReIngest] Error:', error);
  }
}

// Expose debug functions on window for console access
if (typeof window !== 'undefined') {
  (window as any).debugVault = debugVault;
  (window as any).reIngestAll = reIngestAll;
}

/**
 * Get vault object count (for sync status checks)
 */
export async function getVaultObjectCount(): Promise<number> {
  const apiKey = getStoredApiKey();
  if (!apiKey) return 0;

  const vaultId = getStoredVaultId();
  if (!vaultId) return 0;

  try {
    const response = await fetch(`/api/vault/list-objects?apiKey=${encodeURIComponent(apiKey)}&vaultId=${encodeURIComponent(vaultId)}`);

    if (!response.ok) return 0;

    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('[EvidenceService] Failed to get vault object count:', error);
    return 0;
  }
}
