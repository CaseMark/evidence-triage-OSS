import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllEvidenceMetadata,
  addEvidenceMetadata,
  updateEvidenceMetadata,
  deleteEvidenceMetadata,
  getEvidenceMetadata,
  metadataToEvidenceItem,
  getAllEvidence,
  filterEvidence,
  getAllTags,
  getCategoryCounts,
  generateId,
  clearAllEvidence,
  getStoredVaultId,
  clearStoredVaultId,
  EvidenceMetadata,
} from '@/lib/evidence-service';
import { FilterState } from '@/lib/types/evidence';

describe('Evidence Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Vault ID Storage', () => {
    it('should return null when no vault ID is stored', () => {
      const vaultId = getStoredVaultId();
      expect(vaultId).toBeNull();
    });

    it('should clear stored vault ID', () => {
      localStorage.setItem('case-dev-vault-id', 'test-vault-123');
      clearStoredVaultId();
      expect(localStorage.getItem('case-dev-vault-id')).toBeNull();
    });
  });

  describe('Evidence Metadata CRUD', () => {
    const sampleMetadata: EvidenceMetadata = {
      id: 'test-id-1',
      vaultDocRef: {
        vaultId: 'vault-123',
        objectId: 'obj-456',
        filename: 'test-document.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        uploadedAt: '2024-01-01T00:00:00Z',
        status: 'ready',
      },
      category: 'contract',
      tags: ['important', 'legal'],
      relevanceScore: 0.85,
      summary: 'Test document summary',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should return empty array when no metadata exists', () => {
      const items = getAllEvidenceMetadata();
      expect(items).toEqual([]);
    });

    it('should add evidence metadata', () => {
      addEvidenceMetadata(sampleMetadata);
      const items = getAllEvidenceMetadata();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('test-id-1');
    });

    it('should get evidence metadata by ID', () => {
      addEvidenceMetadata(sampleMetadata);
      const item = getEvidenceMetadata('test-id-1');
      expect(item).toBeDefined();
      expect(item?.vaultDocRef.filename).toBe('test-document.pdf');
    });

    it('should return undefined for non-existent ID', () => {
      const item = getEvidenceMetadata('non-existent');
      expect(item).toBeUndefined();
    });

    it('should update evidence metadata', () => {
      addEvidenceMetadata(sampleMetadata);
      const updated = updateEvidenceMetadata('test-id-1', {
        summary: 'Updated summary',
        tags: ['updated', 'tag'],
      });

      expect(updated).toBeDefined();
      expect(updated?.summary).toBe('Updated summary');
      expect(updated?.tags).toEqual(['updated', 'tag']);
      expect(updated?.updatedAt).not.toBe(sampleMetadata.updatedAt);
    });

    it('should return undefined when updating non-existent item', () => {
      const updated = updateEvidenceMetadata('non-existent', { summary: 'test' });
      expect(updated).toBeUndefined();
    });

    it('should delete evidence metadata', () => {
      addEvidenceMetadata(sampleMetadata);
      const deleted = deleteEvidenceMetadata('test-id-1');

      expect(deleted).toBe(true);
      expect(getAllEvidenceMetadata()).toHaveLength(0);
    });

    it('should return false when deleting non-existent item', () => {
      const deleted = deleteEvidenceMetadata('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('metadataToEvidenceItem', () => {
    it('should convert metadata to evidence item', () => {
      const metadata: EvidenceMetadata = {
        id: 'test-id',
        vaultDocRef: {
          vaultId: 'vault-123',
          objectId: 'obj-456',
          filename: 'document.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          uploadedAt: '2024-01-01T00:00:00Z',
          status: 'ready',
        },
        category: 'email',
        tags: ['inbox'],
        relevanceScore: 0.9,
        summary: 'Email summary',
        extractedText: 'Hello world',
        dateDetected: '2024-01-15',
        thumbnailDataUrl: 'data:image/png;base64,abc',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const item = metadataToEvidenceItem(metadata);

      expect(item.id).toBe('test-id');
      expect(item.filename).toBe('document.pdf');
      expect(item.contentType).toBe('application/pdf');
      expect(item.sizeBytes).toBe(2048);
      expect(item.category).toBe('email');
      expect(item.tags).toEqual(['inbox']);
      expect(item.relevanceScore).toBe(0.9);
      expect(item.status).toBe('completed');
      expect(item.extractedText).toBe('Hello world');
      expect(item.thumbnailDataUrl).toBe('data:image/png;base64,abc');
    });

    it('should map status correctly', () => {
      const baseMetadata: EvidenceMetadata = {
        id: 'test',
        vaultDocRef: {
          vaultId: 'v',
          objectId: 'o',
          filename: 'f',
          contentType: 'c',
          sizeBytes: 0,
          uploadedAt: '',
          status: 'ready',
        },
        category: 'other',
        tags: [],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      };

      // Ready -> completed
      expect(metadataToEvidenceItem({ ...baseMetadata, vaultDocRef: { ...baseMetadata.vaultDocRef, status: 'ready' } }).status).toBe('completed');

      // Failed -> failed
      expect(metadataToEvidenceItem({ ...baseMetadata, vaultDocRef: { ...baseMetadata.vaultDocRef, status: 'failed' } }).status).toBe('failed');

      // Processing -> processing
      expect(metadataToEvidenceItem({ ...baseMetadata, vaultDocRef: { ...baseMetadata.vaultDocRef, status: 'processing' } }).status).toBe('processing');

      // Uploading -> processing
      expect(metadataToEvidenceItem({ ...baseMetadata, vaultDocRef: { ...baseMetadata.vaultDocRef, status: 'uploading' } }).status).toBe('processing');
    });
  });

  describe('getAllEvidence', () => {
    it('should return all evidence as EvidenceItem array', () => {
      const metadata: EvidenceMetadata = {
        id: 'test-1',
        vaultDocRef: {
          vaultId: 'vault-123',
          objectId: 'obj-1',
          filename: 'doc1.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1000,
          uploadedAt: '2024-01-01T00:00:00Z',
          status: 'ready',
        },
        category: 'contract',
        tags: ['tag1'],
        relevanceScore: 0.8,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      addEvidenceMetadata(metadata);
      const items = getAllEvidence();

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('test-1');
      expect(items[0].status).toBe('completed');
    });
  });

  describe('filterEvidence', () => {
    beforeEach(() => {
      // Add sample evidence
      const items: EvidenceMetadata[] = [
        {
          id: '1',
          vaultDocRef: { vaultId: 'v', objectId: 'o1', filename: 'contract.pdf', contentType: 'application/pdf', sizeBytes: 100, uploadedAt: '2024-01-01', status: 'ready' },
          category: 'contract',
          tags: ['legal', 'important'],
          relevanceScore: 0.9,
          summary: 'A legal contract',
          dateDetected: '2024-01-15',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          vaultDocRef: { vaultId: 'v', objectId: 'o2', filename: 'email.eml', contentType: 'message/rfc822', sizeBytes: 200, uploadedAt: '2024-01-02', status: 'ready' },
          category: 'email',
          tags: ['inbox', 'important'],
          relevanceScore: 0.7,
          summary: 'An important email',
          dateDetected: '2024-02-01',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: '3',
          vaultDocRef: { vaultId: 'v', objectId: 'o3', filename: 'photo.jpg', contentType: 'image/jpeg', sizeBytes: 300, uploadedAt: '2024-01-03', status: 'ready' },
          category: 'photo',
          tags: ['evidence'],
          relevanceScore: 0.5,
          summary: 'A photo',
          dateDetected: '2024-03-01',
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z',
        },
      ];

      items.forEach(item => addEvidenceMetadata(item));
    });

    it('should return all items with empty filters', () => {
      const filters: FilterState = {
        categories: [],
        tags: [],
        dateRange: {},
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
      };

      const results = filterEvidence(filters);
      expect(results).toHaveLength(3);
    });

    it('should filter by categories', () => {
      const filters: FilterState = {
        categories: ['contract', 'email'],
        tags: [],
        dateRange: {},
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
      };

      const results = filterEvidence(filters);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.category)).toContain('contract');
      expect(results.map(r => r.category)).toContain('email');
    });

    it('should filter by tags', () => {
      const filters: FilterState = {
        categories: [],
        tags: ['important'],
        dateRange: {},
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
      };

      const results = filterEvidence(filters);
      expect(results).toHaveLength(2);
    });

    it('should filter by date range', () => {
      const filters: FilterState = {
        categories: [],
        tags: [],
        dateRange: { start: '2024-02-01', end: '2024-03-01' },
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
      };

      const results = filterEvidence(filters);
      expect(results).toHaveLength(2);
    });

    it('should filter by search query', () => {
      const filters: FilterState = {
        categories: [],
        tags: [],
        dateRange: {},
        searchQuery: 'legal',
        sortBy: 'date',
        sortOrder: 'desc',
      };

      const results = filterEvidence(filters);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should sort by relevance', () => {
      const filters: FilterState = {
        categories: [],
        tags: [],
        dateRange: {},
        searchQuery: '',
        sortBy: 'relevance',
        sortOrder: 'desc',
      };

      const results = filterEvidence(filters);
      expect(results[0].relevanceScore).toBe(0.9);
      expect(results[2].relevanceScore).toBe(0.5);
    });

    it('should sort by name', () => {
      const filters: FilterState = {
        categories: [],
        tags: [],
        dateRange: {},
        searchQuery: '',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      const results = filterEvidence(filters);
      expect(results[0].filename).toBe('contract.pdf');
      expect(results[2].filename).toBe('photo.jpg');
    });
  });

  describe('getAllTags', () => {
    it('should return all unique tags sorted', () => {
      addEvidenceMetadata({
        id: '1',
        vaultDocRef: { vaultId: 'v', objectId: 'o1', filename: 'f1', contentType: 'c', sizeBytes: 0, uploadedAt: '', status: 'ready' },
        category: 'other',
        tags: ['b', 'a', 'c'],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      });
      addEvidenceMetadata({
        id: '2',
        vaultDocRef: { vaultId: 'v', objectId: 'o2', filename: 'f2', contentType: 'c', sizeBytes: 0, uploadedAt: '', status: 'ready' },
        category: 'other',
        tags: ['c', 'd'],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      });

      const tags = getAllTags();
      expect(tags).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('getCategoryCounts', () => {
    it('should return category counts', () => {
      addEvidenceMetadata({
        id: '1',
        vaultDocRef: { vaultId: 'v', objectId: 'o1', filename: 'f1', contentType: 'c', sizeBytes: 0, uploadedAt: '', status: 'ready' },
        category: 'contract',
        tags: [],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      });
      addEvidenceMetadata({
        id: '2',
        vaultDocRef: { vaultId: 'v', objectId: 'o2', filename: 'f2', contentType: 'c', sizeBytes: 0, uploadedAt: '', status: 'ready' },
        category: 'contract',
        tags: [],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      });
      addEvidenceMetadata({
        id: '3',
        vaultDocRef: { vaultId: 'v', objectId: 'o3', filename: 'f3', contentType: 'c', sizeBytes: 0, uploadedAt: '', status: 'ready' },
        category: 'email',
        tags: [],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      });

      const counts = getCategoryCounts();
      expect(counts.contract).toBe(2);
      expect(counts.email).toBe(1);
      expect(counts.photo).toBe(0);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();

      const timestamp = parseInt(id.split('-')[0]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('clearAllEvidence', () => {
    it('should clear all evidence', () => {
      addEvidenceMetadata({
        id: '1',
        vaultDocRef: { vaultId: 'v', objectId: 'o1', filename: 'f1', contentType: 'c', sizeBytes: 0, uploadedAt: '', status: 'ready' },
        category: 'other',
        tags: [],
        relevanceScore: 0,
        createdAt: '',
        updatedAt: '',
      });

      expect(getAllEvidenceMetadata()).toHaveLength(1);

      clearAllEvidence();

      expect(getAllEvidenceMetadata()).toHaveLength(0);
    });
  });
});
