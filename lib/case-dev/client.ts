/**
 * Case.dev API Client for Evidence Triage
 *
 * Handles authenticated requests to Case.dev API for Vault operations.
 * Uses direct HTTP calls with bearer token authentication.
 */

const CASE_DEV_API_BASE = 'https://api.case.dev';

/**
 * Vault object metadata
 */
export interface VaultObject {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  metadata?: Record<string, any>;
  status?: string;
}

/**
 * Vault search result
 */
export interface VaultSearchResult {
  objectId: string;
  filename: string;
  score: number;
  matchedText?: string;
  metadata?: Record<string, any>;
}

/**
 * LLM Chat Completion Response (OpenAI-compatible format)
 */
export interface LLMChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Case.dev API Client
 * Makes authenticated requests to Case.dev API using bearer token auth
 */
export class CaseDevClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to Case.dev API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 30000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${CASE_DEV_API_BASE}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text().catch(() => 'Unknown error');
        throw new Error(`Case.dev API error (${response.status}): ${error}`);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Case.dev API request timed out after ${timeoutMs / 1000} seconds`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================
  // Vault Operations
  // ============================================

  /**
   * Create a new vault
   */
  async createVault(params: {
    name: string;
    description?: string;
    enableIndexing?: boolean;
  }): Promise<{ id: string; name: string }> {
    return this.request('/vault', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        description: params.description || `Vault for ${params.name}`,
        enableIndexing: params.enableIndexing ?? true,
      }),
    });
  }

  /**
   * List all vaults
   */
  async listVaults(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.request<any>('/vault', { method: 'GET' });
    if (Array.isArray(response)) return response;
    if (response?.vaults) return response.vaults;
    if (response?.data) return response.data;
    return [];
  }

  /**
   * Get vault by ID
   */
  async getVault(vaultId: string): Promise<{ id: string; name: string }> {
    return this.request(`/vault/${vaultId}`, { method: 'GET' });
  }

  /**
   * Get or create a vault by name
   */
  async getOrCreateVault(params: {
    name: string;
    description?: string;
    enableIndexing?: boolean;
  }): Promise<{ id: string; name: string }> {
    try {
      const vaults = await this.listVaults();
      const existing = vaults.find(v => v.name === params.name);
      if (existing) return existing;
    } catch (error) {
      console.log('[CaseDevClient] Could not list vaults, attempting to create:', error);
    }
    return this.createVault(params);
  }

  /**
   * Delete a vault
   */
  async deleteVault(vaultId: string): Promise<void> {
    return this.request(`/vault/${vaultId}`, { method: 'DELETE' });
  }

  // ============================================
  // File Upload Operations
  // ============================================

  /**
   * Get upload URL for a file
   */
  async getUploadUrl(params: {
    vaultId: string;
    filename: string;
    contentType: string;
    metadata?: Record<string, any>;
  }): Promise<{ uploadUrl: string; objectId: string }> {
    return this.request(`/vault/${params.vaultId}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        filename: params.filename,
        contentType: params.contentType,
        metadata: params.metadata || {},
      }),
    });
  }

  /**
   * Ingest/process an uploaded object (triggers OCR, indexing, etc.)
   */
  async ingestObject(params: {
    vaultId: string;
    objectId: string;
  }): Promise<{ success: boolean }> {
    return this.request(`/vault/${params.vaultId}/ingest/${params.objectId}`, {
      method: 'POST',
    });
  }

  /**
   * Upload file to vault (complete workflow)
   * 1. Get or create vault
   * 2. Get upload URL
   * 3. PUT file to S3
   * 4. Ingest/process the file
   */
  async uploadToVault(params: {
    vaultName: string;
    file: File;
    enableOCR?: boolean;
    enableSemanticSearch?: boolean;
    metadata?: Record<string, any>;
  }): Promise<{ objectId: string; vaultId: string }> {
    // Step 1: Get or create vault
    const vault = await this.getOrCreateVault({
      name: params.vaultName,
      description: `Evidence vault for ${params.vaultName}`,
      enableIndexing: params.enableSemanticSearch ?? true,
    });

    // Step 2: Get upload URL
    const uploadInfo = await this.getUploadUrl({
      vaultId: vault.id,
      filename: params.file.name,
      contentType: params.file.type || 'application/octet-stream',
      metadata: {
        ...params.metadata,
        enableOCR: params.enableOCR ?? true,
      },
    });

    // Step 3: Upload file to S3
    const fileBuffer = await params.file.arrayBuffer();
    const uploadResponse = await fetch(uploadInfo.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': params.file.type || 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file to storage: ${uploadResponse.status}`);
    }

    // Step 4: Ingest/process the file
    await this.ingestObject({
      vaultId: vault.id,
      objectId: uploadInfo.objectId,
    });

    return {
      objectId: uploadInfo.objectId,
      vaultId: vault.id,
    };
  }

  // ============================================
  // File Retrieval Operations
  // ============================================

  /**
   * Get vault object metadata
   */
  async getVaultObject(params: {
    vaultId: string;
    objectId: string;
  }): Promise<VaultObject> {
    return this.request(`/vault/${params.vaultId}/objects/${params.objectId}`, {
      method: 'GET',
    });
  }

  /**
   * List all objects in a vault
   */
  async listVaultObjects(vaultId: string): Promise<VaultObject[]> {
    const response = await this.request<any>(`/vault/${vaultId}/objects`, {
      method: 'GET',
    });
    if (Array.isArray(response)) return response;
    if (response?.objects) return response.objects;
    if (response?.data) return response.data;
    return [];
  }

  /**
   * Get vault object text (OCR results)
   */
  async getVaultObjectText(params: {
    vaultId: string;
    objectId: string;
  }): Promise<{
    text: string;
    metadata?: {
      object_id: string;
      vault_id: string;
      filename: string;
      chunk_count: number;
      length: number;
      ingestion_completed_at: string;
    };
  }> {
    return this.request(`/vault/${params.vaultId}/objects/${params.objectId}/text`, {
      method: 'GET',
    });
  }

  /**
   * Get OCR text from vault object (convenience method)
   */
  async getOCRText(vaultId: string, objectId: string): Promise<string> {
    const result = await this.getVaultObjectText({ vaultId, objectId });
    return result.text || '';
  }

  /**
   * Get download URL for a vault object
   */
  async getDownloadUrl(params: {
    vaultId: string;
    objectId: string;
  }): Promise<{
    downloadUrl: string;
    filename?: string;
    contentType?: string;
  }> {
    return this.request(`/vault/${params.vaultId}/objects/${params.objectId}/download`, {
      method: 'GET',
    });
  }

  /**
   * Delete a vault object
   */
  async deleteVaultObject(params: {
    vaultId: string;
    objectId: string;
  }): Promise<void> {
    return this.request(`/vault/${params.vaultId}/objects/${params.objectId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Search Operations (RAG)
  // ============================================

  /**
   * Search vault using semantic/hybrid search
   * @param vaultId - The vault to search
   * @param query - Search query text
   * @param options - Search options
   *   - method: 'hybrid' (default), 'fast' (vector only), 'local' (GraphRAG entity), 'global' (GraphRAG corpus)
   *   - limit: Maximum results to return
   *   - minScore: Minimum relevance score (0-1)
   */
  async searchVault(params: {
    vaultId: string;
    query: string;
    method?: 'hybrid' | 'fast' | 'local' | 'global';
    limit?: number;
    minScore?: number;
  }): Promise<VaultSearchResult[]> {
    const response = await this.request<any>(`/vault/${params.vaultId}/search`, {
      method: 'POST',
      body: JSON.stringify({
        query: params.query,
        method: params.method || 'hybrid',
        limit: params.limit || 10,
        minScore: params.minScore || 0.3,
      }),
    });

    if (Array.isArray(response)) return response;
    if (response?.results) return response.results;
    if (response?.data) return response.data;
    return [];
  }

  // ============================================
  // LLM Operations
  // ============================================

  /**
   * Call LLM for chat completion
   * Note: Case.dev API does not support OpenAI's response_format parameter.
   * For JSON output, include explicit instructions in your prompt.
   */
  async completeLLM(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<LLMChatCompletionResponse> {
    return this.request<LLMChatCompletionResponse>('/llm/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Create a new database project
   */
  async createDatabaseProject(params: {
    name: string;
    region?: string;
  }): Promise<{ id: string; name: string; region: string; status: string }> {
    return this.request('/database/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        region: params.region || 'aws-us-east-1',
      }),
    });
  }

  /**
   * Get database project by ID
   */
  async getDatabaseProject(projectId: string): Promise<{
    id: string;
    name: string;
    region: string;
    status: string;
  }> {
    return this.request(`/database/v1/projects/${projectId}`, {
      method: 'GET',
    });
  }

  /**
   * Get database connection string
   */
  async getDatabaseConnection(projectId: string): Promise<{
    connectionUri: string;
    branch: string;
    pooled: boolean;
  }> {
    return this.request(`/database/v1/projects/${projectId}/connection`, {
      method: 'GET',
    });
  }

  /**
   * List database projects
   */
  async listDatabaseProjects(): Promise<Array<{
    id: string;
    name: string;
    region: string;
    status: string;
  }>> {
    const response = await this.request<any>('/database/v1/projects', {
      method: 'GET',
    });
    if (Array.isArray(response)) return response;
    if (response?.projects) return response.projects;
    if (response?.data) return response.data;
    return [];
  }

  /**
   * Delete database project
   */
  async deleteDatabaseProject(projectId: string): Promise<void> {
    return this.request(`/database/v1/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Verification
  // ============================================

  /**
   * List compute environments (used for API key verification)
   */
  async listComputeEnvironments(): Promise<any> {
    return this.request('/compute/v1/environments', { method: 'GET' });
  }
}

/**
 * Case.dev Client Manager
 * Provides methods for API key verification and client creation
 */
export class CaseDevClientManager {
  /**
   * Verify API key by making a test API call
   */
  static async verifyApiKey(apiKey: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const client = new CaseDevClient(apiKey);
      await client.listComputeEnvironments();
      return { valid: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        return {
          valid: false,
          error: 'Invalid API key - please check your key from console.case.dev',
        };
      }

      if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        return {
          valid: false,
          error: 'API key does not have required permissions',
        };
      }

      if (errorMessage.includes('429')) {
        return {
          valid: false,
          error: 'Rate limit exceeded - please try again in a moment',
        };
      }

      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
        return {
          valid: false,
          error: 'Unable to connect to Case.dev API - please check your internet connection',
        };
      }

      return {
        valid: false,
        error: `Failed to verify API key: ${errorMessage.substring(0, 100)}`,
      };
    }
  }

  /**
   * Create a client from stored API key
   */
  static createFromStoredKey(): CaseDevClient | null {
    if (typeof window === 'undefined') return null;

    const apiKey = localStorage.getItem('case-dev-api-key');
    if (!apiKey) return null;

    return new CaseDevClient(apiKey);
  }
}
