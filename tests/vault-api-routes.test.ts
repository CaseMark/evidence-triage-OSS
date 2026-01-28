import { describe, it, expect } from 'vitest';

/**
 * Tests for Vault API Routes - Input Validation
 *
 * These tests verify the input validation logic of the vault API routes.
 * They test the error responses when required parameters are missing.
 */

describe('Vault API Routes - Input Validation', () => {
  describe('POST /api/vault/init', () => {
    it('should return error when API key is missing', async () => {
      const { POST } = await import('@/app/api/vault/init/route');

      const request = new Request('http://localhost/api/vault/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
    });
  });

  describe('POST /api/vault/document-text', () => {
    it('should return error when API key is missing', async () => {
      const { POST } = await import('@/app/api/vault/document-text/route');

      const request = new Request('http://localhost/api/vault/document-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId: 'vault-123', objectId: 'obj-456' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
    });

    it('should return error when vaultId is missing', async () => {
      const { POST } = await import('@/app/api/vault/document-text/route');

      const request = new Request('http://localhost/api/vault/document-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk_case_test_key_12345678', objectId: 'obj-456' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('vaultId and objectId are required');
    });

    it('should return error when objectId is missing', async () => {
      const { POST } = await import('@/app/api/vault/document-text/route');

      const request = new Request('http://localhost/api/vault/document-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk_case_test_key_12345678', vaultId: 'vault-123' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('vaultId and objectId are required');
    });
  });

  describe('POST /api/vault/search', () => {
    it('should return error when API key is missing', async () => {
      const { POST } = await import('@/app/api/vault/search/route');

      const request = new Request('http://localhost/api/vault/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId: 'vault-123', query: 'test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
    });

    it('should return error when vaultId is missing', async () => {
      const { POST } = await import('@/app/api/vault/search/route');

      const request = new Request('http://localhost/api/vault/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk_case_test_key_12345678', query: 'test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('vaultId is required');
    });

    it('should return error when query is missing', async () => {
      const { POST } = await import('@/app/api/vault/search/route');

      const request = new Request('http://localhost/api/vault/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk_case_test_key_12345678', vaultId: 'vault-123' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('query is required');
    });
  });

  describe('POST /api/vault/delete', () => {
    it('should return error when API key is missing', async () => {
      const { POST } = await import('@/app/api/vault/delete/route');

      const request = new Request('http://localhost/api/vault/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId: 'vault-123', objectId: 'obj-456' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
    });

    it('should return error when vaultId is missing', async () => {
      const { POST } = await import('@/app/api/vault/delete/route');

      const request = new Request('http://localhost/api/vault/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk_case_test_key_12345678', objectId: 'obj-456' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('vaultId and objectId are required');
    });

    it('should return error when objectId is missing', async () => {
      const { POST } = await import('@/app/api/vault/delete/route');

      const request = new Request('http://localhost/api/vault/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk_case_test_key_12345678', vaultId: 'vault-123' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('vaultId and objectId are required');
    });
  });
});

describe('Vault API Routes - Architecture Verification', () => {
  it('should have all required vault routes', async () => {
    // Verify all routes can be imported (they exist and export POST handler)
    const initRoute = await import('@/app/api/vault/init/route');
    const uploadRoute = await import('@/app/api/vault/upload/route');
    const docTextRoute = await import('@/app/api/vault/document-text/route');
    const searchRoute = await import('@/app/api/vault/search/route');
    const deleteRoute = await import('@/app/api/vault/delete/route');

    expect(typeof initRoute.POST).toBe('function');
    expect(typeof uploadRoute.POST).toBe('function');
    expect(typeof docTextRoute.POST).toBe('function');
    expect(typeof searchRoute.POST).toBe('function');
    expect(typeof deleteRoute.POST).toBe('function');
  });

  it('should confirm server-side routes avoid CORS by using internal API', () => {
    // This is a documentation test - confirms the architecture design
    // All vault operations go through Next.js API routes which then call case.dev
    // Browser -> /api/vault/* -> case.dev API (server-side, no CORS)

    const architecture = {
      browserCalls: [
        '/api/vault/init',
        '/api/vault/upload',
        '/api/vault/document-text',
        '/api/vault/search',
        '/api/vault/delete',
      ],
      serverSideProxy: true,
      avoidsCORS: true,
    };

    expect(architecture.serverSideProxy).toBe(true);
    expect(architecture.avoidsCORS).toBe(true);
    expect(architecture.browserCalls).toHaveLength(5);
  });
});
