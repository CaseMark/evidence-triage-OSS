'use client';

import {
  EvidenceItem,
  EvidenceCategory,
  FilterState,
  SessionStats,
} from '@/lib/types/evidence';

const STORAGE_KEY = 'evidence-triage-items';
const STATS_KEY = 'evidence-triage-stats';

// Get all evidence from localStorage
export function getAllEvidence(): EvidenceItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as EvidenceItem[];
  } catch (error) {
    console.error('[Storage] Failed to get evidence:', error);
    return [];
  }
}

// Save all evidence to localStorage
function saveAllEvidence(items: EvidenceItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('[Storage] Failed to save evidence:', error);
    // If storage is full, try to clear old items
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[Storage] Quota exceeded, clearing thumbnails...');
      const itemsWithoutThumbnails = items.map(item => ({
        ...item,
        thumbnailDataUrl: undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsWithoutThumbnails));
    }
  }
}

// Add a new evidence item
export function addEvidence(evidence: EvidenceItem): void {
  const items = getAllEvidence();
  items.push(evidence);
  saveAllEvidence(items);
}

// Get a single evidence item by ID
export function getEvidence(id: string): EvidenceItem | undefined {
  const items = getAllEvidence();
  return items.find(item => item.id === id);
}

// Update an evidence item
export function updateEvidence(id: string, updates: Partial<EvidenceItem>): EvidenceItem | undefined {
  const items = getAllEvidence();
  const index = items.findIndex(item => item.id === id);

  if (index === -1) return undefined;

  items[index] = { ...items[index], ...updates };
  saveAllEvidence(items);
  return items[index];
}

// Delete an evidence item
export function deleteEvidence(id: string): boolean {
  const items = getAllEvidence();
  const filtered = items.filter(item => item.id !== id);

  if (filtered.length === items.length) return false;

  saveAllEvidence(filtered);
  return true;
}

// Clear all evidence
export function clearAllEvidence(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// Filter evidence based on filter state
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

// Get all unique tags from evidence
export function getAllTags(): string[] {
  const items = getAllEvidence();
  const tagSet = new Set<string>();
  items.forEach(item => {
    item.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

// Get category counts
export function getCategoryCounts(): Record<EvidenceCategory, number> {
  const items = getAllEvidence();
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

// Group evidence by date for timeline view
export function getEvidenceByDate(): Map<string, EvidenceItem[]> {
  const items = getAllEvidence();
  const grouped = new Map<string, EvidenceItem[]>();

  items.forEach(item => {
    const date = (item.dateDetected || item.createdAt).split('T')[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(item);
  });

  // Sort by date descending
  const sortedEntries = Array.from(grouped.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  );

  return new Map(sortedEntries);
}

// Helper function to get session reset time
function getSessionResetTime(sessionHours: number = 24): string {
  const resetTime = new Date();
  resetTime.setHours(resetTime.getHours() + sessionHours);
  return resetTime.toISOString();
}

// Session statistics
export function getSessionStats(): SessionStats {
  const defaultStats: SessionStats = {
    documentsUploaded: 0,
    classificationsUsed: 0,
    totalStorageUsed: 0,
    sessionPrice: 0,
    sessionStartAt: new Date().toISOString(),
    sessionResetAt: getSessionResetTime(24),
  };

  if (typeof window === 'undefined') {
    return defaultStats;
  }

  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) {
      return defaultStats;
    }

    const stats = JSON.parse(stored) as SessionStats;

    // Initialize price fields if they don't exist (backward compatibility)
    if (stats.sessionPrice === undefined) {
      stats.sessionPrice = 0;
      stats.sessionStartAt = new Date().toISOString();
      stats.sessionResetAt = getSessionResetTime(24);
    }

    // Check if session reset needed
    const now = new Date();
    if (now >= new Date(stats.sessionResetAt)) {
      const resetStats: SessionStats = {
        documentsUploaded: 0,
        classificationsUsed: 0,
        totalStorageUsed: calculateStorageUsed(),
        sessionPrice: 0,
        sessionStartAt: now.toISOString(),
        sessionResetAt: getSessionResetTime(24),
      };
      localStorage.setItem(STATS_KEY, JSON.stringify(resetStats));
      return resetStats;
    }

    return stats;
  } catch {
    return defaultStats;
  }
}

export function updateSessionStats(updates: Partial<SessionStats>): void {
  if (typeof window === 'undefined') return;

  const current = getSessionStats();
  const updated = { ...current, ...updates };
  localStorage.setItem(STATS_KEY, JSON.stringify(updated));
}

export function incrementDocumentsUploaded(): void {
  const stats = getSessionStats();
  updateSessionStats({ documentsUploaded: stats.documentsUploaded + 1 });
}

export function decrementDocumentsUploaded(): void {
  const stats = getSessionStats();
  updateSessionStats({ documentsUploaded: Math.max(0, stats.documentsUploaded - 1) });
}

export function incrementClassificationsUsed(): void {
  const stats = getSessionStats();
  updateSessionStats({ classificationsUsed: stats.classificationsUsed + 1 });
}

export function incrementSessionPrice(price: number): void {
  const stats = getSessionStats();
  updateSessionStats({ sessionPrice: stats.sessionPrice + price });
}

// Calculate total storage used
export function calculateStorageUsed(): number {
  const items = getAllEvidence();
  return items.reduce((total, item) => total + item.sizeBytes, 0);
}

// Search evidence with relevance scoring (client-side)
export function searchEvidence(query: string): { item: EvidenceItem; score: number }[] {
  const items = getAllEvidence();
  const queryLower = query.toLowerCase();
  const results: { item: EvidenceItem; score: number }[] = [];

  // Maximum raw score possible is 110 (50 + 30 + 20 + 10)
  const MAX_RAW_SCORE = 110;

  items.forEach(item => {
    let rawScore = 0;

    // Filename match (highest weight)
    if (item.filename.toLowerCase().includes(queryLower)) {
      rawScore += 50;
    }

    // Summary match
    if (item.summary?.toLowerCase().includes(queryLower)) {
      rawScore += 30;
    }

    // Tag match
    if (item.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
      rawScore += 20;
    }

    // Extracted text match
    if (item.extractedText?.toLowerCase().includes(queryLower)) {
      rawScore += 10;
    }

    if (rawScore > 0) {
      // Normalize score to 0-100 range
      const normalizedScore = Math.round((rawScore / MAX_RAW_SCORE) * 100);
      results.push({ item, score: normalizedScore });
    }
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Calculate time remaining until session reset
export function calculateTimeRemaining(resetAt: string): string {
  const now = new Date();
  const reset = new Date(resetAt);
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return '0h 0m';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// Semantic search using embeddings (RAG search)
export function semanticSearch(
  queryEmbedding: number[],
  minScore: number = 0.3
): { item: EvidenceItem; score: number }[] {
  const items = getAllEvidence();
  const results: { item: EvidenceItem; score: number }[] = [];

  items.forEach(item => {
    if (!item.embedding || item.embedding.length === 0) return;

    const similarity = cosineSimilarity(queryEmbedding, item.embedding);

    // Convert similarity (0-1) to percentage score (0-100)
    const score = Math.round(similarity * 100);

    if (similarity >= minScore) {
      results.push({ item, score });
    }
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

// Hybrid search: combines keyword and semantic search
export function hybridSearch(
  query: string,
  queryEmbedding?: number[],
  keywordWeight: number = 0.3,
  semanticWeight: number = 0.7
): { item: EvidenceItem; score: number }[] {
  const keywordResults = searchEvidence(query);
  const semanticResults = queryEmbedding
    ? semanticSearch(queryEmbedding, 0.2)
    : [];

  // Create a map to combine scores
  const scoreMap = new Map<string, { item: EvidenceItem; keywordScore: number; semanticScore: number }>();

  // Add keyword results
  keywordResults.forEach(({ item, score }) => {
    scoreMap.set(item.id, { item, keywordScore: score, semanticScore: 0 });
  });

  // Add/merge semantic results
  semanticResults.forEach(({ item, score }) => {
    const existing = scoreMap.get(item.id);
    if (existing) {
      existing.semanticScore = score;
    } else {
      scoreMap.set(item.id, { item, keywordScore: 0, semanticScore: score });
    }
  });

  // Calculate combined scores
  const results: { item: EvidenceItem; score: number }[] = [];
  scoreMap.forEach(({ item, keywordScore, semanticScore }) => {
    const combinedScore = Math.round(
      keywordScore * keywordWeight + semanticScore * semanticWeight
    );
    if (combinedScore > 0) {
      results.push({ item, score: combinedScore });
    }
  });

  // Sort by combined score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
