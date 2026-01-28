import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateApiKeyFormat,
  getStoredApiKey,
  saveApiKey,
  removeApiKey,
  getStoredDatabaseProjectId,
  getStoredVaultId,
} from '@/components/case-dev/api-key-input';

describe('API Key Input Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('validateApiKeyFormat', () => {
    it('should validate correct API key format', () => {
      expect(validateApiKeyFormat('sk_case_abc123xyz456789abc')).toBe(true);
      expect(validateApiKeyFormat('sk_case_12345678901234567890')).toBe(true);
    });

    it('should reject keys without sk_case_ prefix', () => {
      expect(validateApiKeyFormat('abc123xyz456789abc')).toBe(false);
      expect(validateApiKeyFormat('sk_test_abc123xyz456789')).toBe(false);
    });

    it('should reject keys that are too short', () => {
      expect(validateApiKeyFormat('sk_case_short')).toBe(false);
      expect(validateApiKeyFormat('sk_case_1234')).toBe(false);
    });
  });

  describe('API Key Storage', () => {
    const testKey = 'sk_case_test_api_key_12345678';

    it('should return null when no key is stored', () => {
      expect(getStoredApiKey()).toBeNull();
    });

    it('should save and retrieve API key', () => {
      saveApiKey(testKey);
      expect(getStoredApiKey()).toBe(testKey);
    });

    it('should remove API key and related data', () => {
      // Store some data
      saveApiKey(testKey);
      localStorage.setItem('case-dev-database-project-id', 'proj-123');
      localStorage.setItem('case-dev-vault-id', 'vault-456');

      // Verify data is stored
      expect(getStoredApiKey()).toBe(testKey);
      expect(getStoredDatabaseProjectId()).toBe('proj-123');
      expect(getStoredVaultId()).toBe('vault-456');

      // Remove API key (should also clear related data)
      removeApiKey();

      // Verify all data is cleared
      expect(getStoredApiKey()).toBeNull();
      expect(getStoredDatabaseProjectId()).toBeNull();
      expect(getStoredVaultId()).toBeNull();
    });
  });

  describe('Database Project ID Storage', () => {
    it('should return null when no project ID is stored', () => {
      expect(getStoredDatabaseProjectId()).toBeNull();
    });

    it('should return stored project ID', () => {
      localStorage.setItem('case-dev-database-project-id', 'proj-123');
      expect(getStoredDatabaseProjectId()).toBe('proj-123');
    });
  });

  describe('Vault ID Storage', () => {
    it('should return null when no vault ID is stored', () => {
      expect(getStoredVaultId()).toBeNull();
    });

    it('should return stored vault ID', () => {
      localStorage.setItem('case-dev-vault-id', 'vault-456');
      expect(getStoredVaultId()).toBe('vault-456');
    });
  });
});

describe('API Key Verification (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should call connect endpoint and store IDs on success', async () => {
    // Mock successful response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        database: {
          status: 'created',
          projectId: 'proj-new-123',
          projectName: 'evd_triageOSS__test',
        },
        vault: {
          status: 'created',
          vaultId: 'vault-new-456',
          vaultName: 'evd_triageOSS_evidence',
        },
      }),
    });

    const { verifyApiKey } = await import('@/components/case-dev/api-key-input');
    const result = await verifyApiKey('sk_case_test_key_12345678');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/case-dev/connect', expect.any(Object));
    expect(localStorage.getItem('case-dev-database-project-id')).toBe('proj-new-123');
    expect(localStorage.getItem('case-dev-vault-id')).toBe('vault-new-456');
  });

  it('should return false on API error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid API key' }),
    });

    const { verifyApiKey } = await import('@/components/case-dev/api-key-input');
    const result = await verifyApiKey('sk_case_invalid_key_000');

    expect(result).toBe(false);
  });

  it('should return false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const { verifyApiKey } = await import('@/components/case-dev/api-key-input');
    const result = await verifyApiKey('sk_case_test_key_12345678');

    expect(result).toBe(false);
  });
});
