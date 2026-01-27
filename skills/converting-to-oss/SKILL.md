# OSS Conversion Skill

## Purpose

This skill documents how to convert Case.dev demo applications into proper open-source projects that users can run with their own Case.dev API keys. The key principle: **only the API key goes in LocalStorage** - all other data uses Case.dev primitives (Vaults, databases, etc.).

## Key Concepts

- **API Key Management**: Store only the Case.dev API key in browser LocalStorage
- **Case.dev Vaults**: Replace all local data storage with cloud-based Vaults
- **Client-Side Key Passing**: API routes receive the key from client requests, not environment variables
- **Zero Server-Side Secrets**: OSS apps don't require `.env` files for Case.dev credentials

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
├─────────────────────────────────────────────────────────────┤
│  LocalStorage: { "case-dev-api-key": "sk_case_..." }        │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ API Key Input   │───▶│ React Context / Hook            │ │
│  │ Modal           │    │ (useCaseDevApiKey)              │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                    │                         │
│                                    ▼                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ API Calls include: { headers: { x-api-key: key } }      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
├─────────────────────────────────────────────────────────────┤
│  function getApiKey(request: Request): string | null {      │
│    return request.headers.get('x-api-key');                 │
│  }                                                           │
│                                                              │
│  // Create Case.dev client with user's key                  │
│  const client = createCaseDevClient(apiKey);                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Case.dev Cloud                          │
├─────────────────────────────────────────────────────────────┤
│  • Vaults (document storage + RAG)                          │
│  • LLMs (130+ models)                                       │
│  • OCR, Transcription, Workflows                            │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Create API Key Input Component

```typescript
// components/case-dev/api-key-input.tsx
'use client';

import { useState, useEffect } from 'react';
import { Key, Eye, EyeSlash, Check, X } from '@phosphor-icons/react';

const STORAGE_KEY = 'case-dev-api-key';

export function useCaseDevApiKey() {
  const [key, setKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setKey(stored);
    setIsLoading(false);
  }, []);

  const saveKey = (newKey: string) => {
    localStorage.setItem(STORAGE_KEY, newKey);
    setKey(newKey);
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setKey(null);
  };

  const isValid = key !== null && key.startsWith('sk_case_') && key.length >= 20;

  return { key, isValid, isLoading, saveKey, clearKey };
}

interface ApiKeyInputProps {
  onSave?: (key: string) => void;
  onClose?: () => void;
}

export function ApiKeyInput({ onSave, onClose }: ApiKeyInputProps) {
  const { key: savedKey, saveKey } = useCaseDevApiKey();
  const [inputValue, setInputValue] = useState(savedKey || '');
  const [showKey, setShowKey] = useState(false);

  const isValidFormat = inputValue.startsWith('sk_case_') && inputValue.length >= 20;

  const handleSave = () => {
    if (isValidFormat) {
      saveKey(inputValue);
      onSave?.(inputValue);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-md w-full">
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold">Case.dev API Key</h2>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Enter your API key from{' '}
        <a 
          href="https://case.dev/settings/api" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          case.dev/settings/api
        </a>
      </p>

      <div className="relative mb-4">
        <input
          type={showKey ? 'text' : 'password'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="sk_case_..."
          className="w-full px-3 py-2 pr-20 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            {showKey ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {inputValue && (
            isValidFormat 
              ? <Check className="w-4 h-4 text-green-500" />
              : <X className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isValidFormat}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Key
        </button>
      </div>
    </div>
  );
}
```

### 2. Create Case.dev Client Library

```typescript
// lib/case-dev/client.ts

// Types for Vault operations
export interface VaultObject {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface VaultSearchResult {
  objectId: string;
  score: number;
  content?: string;
}

const CASE_DEV_API_BASE = 'https://api.case.dev';

export function createCaseDevClient(apiKey: string) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  return {
    vault: {
      // List all vaults
      async list(): Promise<{ id: string; name: string }[]> {
        const res = await fetch(`${CASE_DEV_API_BASE}/v1/vaults`, { headers });
        if (!res.ok) throw new Error(`Failed to list vaults: ${res.status}`);
        return res.json();
      },

      // Create a new vault
      async create(params: { name: string; description?: string }): Promise<{ id: string }> {
        const res = await fetch(`${CASE_DEV_API_BASE}/v1/vaults`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });
        if (!res.ok) throw new Error(`Failed to create vault: ${res.status}`);
        return res.json();
      },

      // Upload object to vault
      async upload(params: { 
        vaultId: string; 
        file: File | Blob; 
        filename: string;
        metadata?: Record<string, unknown>;
      }): Promise<VaultObject> {
        const formData = new FormData();
        formData.append('file', params.file, params.filename);
        if (params.metadata) {
          formData.append('metadata', JSON.stringify(params.metadata));
        }

        const res = await fetch(
          `${CASE_DEV_API_BASE}/v1/vaults/${params.vaultId}/objects`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
          }
        );
        if (!res.ok) throw new Error(`Failed to upload: ${res.status}`);
        return res.json();
      },

      // List objects in vault
      async listObjects(params: { vaultId: string }): Promise<VaultObject[]> {
        const res = await fetch(
          `${CASE_DEV_API_BASE}/v1/vaults/${params.vaultId}/objects`,
          { headers }
        );
        if (!res.ok) throw new Error(`Failed to list objects: ${res.status}`);
        return res.json();
      },

      // Get object by ID
      async getObject(params: { vaultId: string; objectId: string }): Promise<VaultObject> {
        const res = await fetch(
          `${CASE_DEV_API_BASE}/v1/vaults/${params.vaultId}/objects/${params.objectId}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Failed to get object: ${res.status}`);
        return res.json();
      },

      // Download object content
      async downloadObject(params: { vaultId: string; objectId: string }): Promise<Blob> {
        const res = await fetch(
          `${CASE_DEV_API_BASE}/v1/vaults/${params.vaultId}/objects/${params.objectId}/download`,
          { headers }
        );
        if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
        return res.blob();
      },

      // Delete object
      async deleteObject(params: { vaultId: string; objectId: string }): Promise<void> {
        const res = await fetch(
          `${CASE_DEV_API_BASE}/v1/vaults/${params.vaultId}/objects/${params.objectId}`,
          { method: 'DELETE', headers }
        );
        if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
      },

      // Semantic search
      async search(params: { 
        vaultId: string; 
        query: string; 
        limit?: number;
        threshold?: number;
      }): Promise<VaultSearchResult[]> {
        const res = await fetch(
          `${CASE_DEV_API_BASE}/v1/vaults/${params.vaultId}/search`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              query: params.query,
              limit: params.limit || 10,
              threshold: params.threshold || 0.7,
            }),
          }
        );
        if (!res.ok) throw new Error(`Failed to search: ${res.status}`);
        return res.json();
      },
    },

    llm: {
      // Chat completion
      async chat(params: {
        model?: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        maxTokens?: number;
      }): Promise<{ content: string }> {
        const res = await fetch(`${CASE_DEV_API_BASE}/v1/llm/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: params.model || 'anthropic/claude-3-5-sonnet-20241022',
            messages: params.messages,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
          }),
        });
        if (!res.ok) throw new Error(`Failed to chat: ${res.status}`);
        const data = await res.json();
        return { content: data.choices[0].message.content };
      },

      // Generate embeddings
      async embeddings(params: {
        input: string | string[];
        model?: string;
      }): Promise<number[][]> {
        const res = await fetch(`${CASE_DEV_API_BASE}/v1/llm/embeddings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            input: params.input,
            model: params.model || 'voyage-law-2',
          }),
        });
        if (!res.ok) throw new Error(`Failed to embed: ${res.status}`);
        const data = await res.json();
        return data.data.map((d: { embedding: number[] }) => d.embedding);
      },
    },

    ocr: {
      // Process document with OCR
      async process(params: { file: File | Blob; filename: string }): Promise<{ text: string }> {
        const formData = new FormData();
        formData.append('file', params.file, params.filename);

        const res = await fetch(`${CASE_DEV_API_BASE}/v1/ocr/process`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData,
        });
        if (!res.ok) throw new Error(`Failed to OCR: ${res.status}`);
        return res.json();
      },
    },
  };
}

export type CaseDevClient = ReturnType<typeof createCaseDevClient>;
```

### 3. Update API Routes to Accept Client Key

```typescript
// app/api/[feature]/route.ts

function getApiKey(request: Request): string | null {
  // Try header first (preferred for API calls)
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey;
  
  // Fallback to environment variable (for server-side operations)
  return process.env.CASEDEV_API_KEY || null;
}

export async function POST(request: Request) {
  const apiKey = getApiKey(request);
  
  if (!apiKey) {
    return Response.json(
      { error: 'API key required. Set x-api-key header or CASEDEV_API_KEY env var.' },
      { status: 401 }
    );
  }

  const client = createCaseDevClient(apiKey);
  
  // Use client for operations...
  const result = await client.vault.list();
  
  return Response.json(result);
}
```

### 4. Update Client-Side API Calls

```typescript
// In React components or hooks
const { key: apiKey } = useCaseDevApiKey();

async function fetchData() {
  const response = await fetch('/api/feature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
    },
    body: JSON.stringify({ /* data */ }),
  });
  
  return response.json();
}
```

### 5. Replace Local Storage with Vaults

**Before (localStorage):**
```typescript
// ❌ Don't do this for user data
function saveEvidence(evidence: Evidence) {
  const existing = JSON.parse(localStorage.getItem('evidence') || '[]');
  existing.push(evidence);
  localStorage.setItem('evidence', JSON.stringify(existing));
}
```

**After (Case.dev Vaults):**
```typescript
// ✅ Use Vaults for all user data
async function saveEvidence(
  client: CaseDevClient,
  vaultId: string,
  evidence: Evidence,
  file: File
): Promise<VaultObject> {
  return await client.vault.upload({
    vaultId,
    file,
    filename: evidence.filename,
    metadata: {
      category: evidence.category,
      tags: evidence.tags,
      uploadedAt: new Date().toISOString(),
    },
  });
}
```

### 6. Add API Key Modal to Main Page

```typescript
// app/page.tsx
'use client';

import { useState } from 'react';
import { Gear } from '@phosphor-icons/react';
import { ApiKeyInput, useCaseDevApiKey } from '@/components/case-dev/api-key-input';

export default function HomePage() {
  const { key: apiKey, isValid, isLoading } = useCaseDevApiKey();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Show modal if no valid key
  if (!isLoading && !isValid && !showApiKeyModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ApiKeyInput onSave={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div>
      {/* Settings button to change API key */}
      <button
        onClick={() => setShowApiKeyModal(true)}
        className="fixed top-4 right-4 p-2 rounded-full hover:bg-gray-100"
        title="API Settings"
      >
        <Gear className="w-5 h-5" />
      </button>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <ApiKeyInput
            onSave={() => setShowApiKeyModal(false)}
            onClose={() => setShowApiKeyModal(false)}
          />
        </div>
      )}

      {/* Main app content */}
      <main>
        {/* ... */}
      </main>
    </div>
  );
}
```

## README.md Template for OSS Projects

```markdown
# [Project Name]

[Brief description of what the project does]

## Demo

Try the hosted demo at [case.dev/gallery](https://case.dev/gallery)

## Features

- Feature 1
- Feature 2
- Feature 3

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Case.dev API key ([get one free](https://case.dev/settings/api))

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/casedev/[project-name].git
cd [project-name]

# Install dependencies
bun install

# Start development server
bun dev
\`\`\`

### Configuration

When you first open the app, you'll be prompted to enter your Case.dev API key. 
The key is stored locally in your browser and never sent to our servers.

Get your API key at: https://case.dev/settings/api

## How It Works

[Explain the architecture and how Case.dev services are used]

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Phosphor Icons
- **AI/ML**: Case.dev (Vaults, LLMs, OCR)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Case.dev Documentation](https://docs.case.dev)
- [Demo Gallery](https://case.dev/gallery)
- [Report Issues](https://github.com/casedev/[project-name]/issues)
```

## Checklist for OSS Conversion

- [ ] **Reference bankruptcy-tool-OSS** for working implementation patterns
- [ ] Create `lib/case-dev/client.ts` with typed API client including:
  - [ ] `CaseDevClient` class with `listComputeEnvironments()` method
  - [ ] `CaseDevClientManager.verifyApiKey()` static method
- [ ] Create `app/api/case-dev/connect/route.ts` for server-side verification
- [ ] Create `components/case-dev/api-key-input.tsx` with:
  - [ ] `useCaseDevApiKey` hook
  - [ ] Server-side verification (calls `/api/case-dev/connect`, NOT direct to case.dev)
  - [ ] No form wrapper (use direct onClick on Button)
  - [ ] onKeyDown handler for Enter key support
  - [ ] Link to `console.case.dev` (NOT case.dev/settings/api)
- [ ] Update all API routes to use `getApiKey(request)` pattern
- [ ] Replace all localStorage data operations with Vault operations
- [ ] Add API key modal to main page component
- [ ] Update all client-side fetch calls to include `x-api-key` header
- [ ] Remove any hardcoded API keys or environment variable requirements
- [ ] Update README.md with OSS-specific content
- [ ] Add link to case.dev/gallery for demo version
- [ ] Test full flow: fresh install → enter API key → use app
- [ ] Verify no CORS errors in browser console during API key verification

## API Key Verification Pattern

**CRITICAL: API key verification MUST be done server-side to avoid CORS issues.**

### Reference Implementation

The `bankruptcy-tool-OSS` project has a working reference implementation. Always check it when implementing API key handling:
- Client library: `/lib/case-dev/client.ts`
- API routes: `/app/api/case-dev/connect/route.ts`
- Component: `/components/case-dev/connect-button.tsx`

### Step-by-Step Verification Implementation

#### 1. Create Server-Side Verification Client

The client library should include a verification method that uses `/compute/v1/environments`:

```typescript
// lib/case-dev/client.ts
export class CaseDevClientManager {
  /**
   * Verify API key works by making a test API call
   * Uses compute environments endpoint as it's lightweight and always available
   */
  static async verifyApiKey(apiKey: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const client = new CaseDevClient(apiKey);

      // Use /compute/v1/environments for verification
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

      return {
        valid: false,
        error: `Failed to verify API key: ${errorMessage.substring(0, 100)}`,
      };
    }
  }
}

export class CaseDevClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listComputeEnvironments(): Promise<any> {
    const response = await fetch('https://api.case.dev/compute/v1/environments', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`case.dev API error (${response.status})`);
    }

    return response.json();
  }
}
```

#### 2. Create API Route for Verification

```typescript
// app/api/case-dev/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CaseDevClientManager } from '@/lib/case-dev/client';

function validateApiKeyFormat(key: string): boolean {
  return key.startsWith('sk_case_') && key.length >= 20;
}

function getLast4(key: string): string {
  return key.slice(-4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!validateApiKeyFormat(apiKey)) {
      return NextResponse.json(
        {
          error: 'Invalid API key format. Key should start with sk_case_ and be at least 20 characters',
        },
        { status: 400 }
      );
    }

    // Verify key works by making test API call
    const verification = await CaseDevClientManager.verifyApiKey(apiKey);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Failed to verify API key' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'case.dev API key verified successfully',
      last4: getLast4(apiKey),
    });
  } catch (error) {
    console.error('[case-dev/connect] Error verifying:', error);
    return NextResponse.json(
      { error: 'Failed to verify case.dev API key. Please try again.' },
      { status: 500 }
    );
  }
}
```

#### 3. Update Component to Use Server-Side Verification

**CRITICAL: Do NOT verify directly from the browser - it will fail with CORS errors.**

```typescript
// components/case-dev/api-key-input.tsx

// ✅ CORRECT: Verify via server-side API route
export async function verifyApiKey(key: string): Promise<boolean> {
  try {
    const response = await fetch('/api/case-dev/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('[API Key] Verification failed:', data.error || 'Unknown error');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Key] Verification failed:', error);
    return false;
  }
}

// ❌ WRONG: Direct browser call will fail with CORS
export async function verifyApiKey(key: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.case.dev/compute/v1/environments', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

#### 4. Form Submission Pattern

**CRITICAL: Do NOT use a `<form>` wrapper - it prevents proper submission.**

```typescript
// ✅ CORRECT: Direct onClick without form wrapper
const handleConnect = async () => {
  setError(null);

  if (!inputValue.trim()) {
    setError('Please enter an API key');
    return;
  }

  if (!validateApiKeyFormat(inputValue)) {
    setError('Invalid API key format');
    return;
  }

  setIsSubmitting(true);
  const success = await setApiKey(inputValue);
  setIsSubmitting(false);

  if (success) {
    setInputValue('');
    setError(null);
  } else {
    setError('API key verification failed. Please check your key and try again.');
  }
};

return (
  <Card>
    <CardContent className="space-y-3">
      <Input
        type={showKey ? 'text' : 'password'}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputValue) {
            handleConnect();
          }
        }}
        disabled={isSubmitting}
      />
      <p className="text-xs text-muted-foreground">
        Get your API key from{' '}
        <a href="https://console.case.dev" target="_blank" rel="noopener noreferrer">
          console.case.dev
        </a>
      </p>
    </CardContent>
    <CardFooter>
      <Button onClick={handleConnect} disabled={!inputValue || isSubmitting}>
        {isSubmitting ? 'Verifying...' : 'Connect'}
      </Button>
    </CardFooter>
  </Card>
);

// ❌ WRONG: Form wrapper prevents submission
return (
  <form onSubmit={handleSubmit}>
    <CardContent>
      <Input type="password" value={inputValue} onChange={...} />
    </CardContent>
    <CardFooter>
      <Button type="submit">Connect</Button>
    </CardFooter>
  </form>
);
```

### Key Points

1. **Always use server-side verification** via Next.js API routes
2. **Reference bankruptcy-tool-OSS** for working implementation
3. **Use `/compute/v1/environments`** endpoint for verification
4. **No form wrapper** - use direct onClick and onKeyDown handlers
5. **Link to console.case.dev** for API keys, not case.dev/settings/api

## Common Gotchas

### Property Names

Case.dev API uses **camelCase** for all properties:

```typescript
// ✅ Correct
interface VaultObject {
  id: string;
  filename: string;
  contentType: string;
  createdAt: string;
}

interface VaultSearchResult {
  objectId: string;  // NOT object_id
  score: number;     // NOT similarity
}

// ❌ Wrong
interface VaultObject {
  object_id: string;
  file_name: string;
  content_type: string;
}
```

### Object Parameters

All client methods use **object parameters**, not positional arguments:

```typescript
// ✅ Correct
await client.vault.getObject({ vaultId, objectId });
await client.vault.search({ vaultId, query, limit: 10 });

// ❌ Wrong
await client.vault.getObject(vaultId, objectId);
await client.vault.search(vaultId, query, 10);
```

### Async Storage Operations

All storage operations are now async:

```typescript
// ✅ Correct
const evidence = await getAllEvidence(client, vaultId);
await saveEvidence(client, vaultId, newEvidence);

// ❌ Wrong (sync localStorage pattern)
const evidence = getAllEvidence();
saveEvidence(newEvidence);
```

### Icon Library

Pay attention to whether your project uses **@phosphor-icons/react** or lucide-react:

```typescript
// Phosphor-icons
import { Key, Eye, EyeSlash, Gear } from '@phosphor-icons/react';

// Lucide-react
import { Key, Eye, EyeOff, Settings } from 'lucide-react';
```

### API Key Validation

```typescript
// Valid key format
const isValid = key.startsWith('sk_case_') && key.length >= 20;
```

### Hook Property Names

The `useCaseDevApiKey` hook returns `key`, not `apiKey`:

```typescript
// ✅ Correct
const { key, isValid, isLoading } = useCaseDevApiKey();

// ❌ Wrong
const { apiKey, isValid, isLoading } = useCaseDevApiKey();
```

## Troubleshooting

### API Key Verification Fails with CORS Error

**Symptoms:**
- Browser console shows CORS error
- Message: "API key verification failed. Please check your key and try again."
- Network tab shows failed request to `https://api.case.dev`

**Cause:**
API key verification is happening client-side instead of server-side.

**Solution:**
1. Create `/app/api/case-dev/connect/route.ts` API route
2. Update verification function to call `/api/case-dev/connect` instead of `https://api.case.dev` directly
3. Ensure verification happens server-side where CORS is not an issue

**Example Fix:**
```typescript
// ❌ WRONG - Will fail with CORS
const response = await fetch('https://api.case.dev/compute/v1/environments', {
  headers: { 'Authorization': `Bearer ${key}` }
});

// ✅ CORRECT - Goes through your API route
const response = await fetch('/api/case-dev/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: key })
});
```

### Form Not Submitting

**Symptoms:**
- Clicking Connect button does nothing
- Pressing Enter doesn't submit

**Cause:**
Using a `<form>` wrapper interferes with submission handling.

**Solution:**
Remove the form wrapper and use direct onClick handler:
```typescript
// ❌ WRONG
<form onSubmit={handleSubmit}>
  <Button type="submit">Connect</Button>
</form>

// ✅ CORRECT
<Button onClick={handleConnect}>Connect</Button>
<Input onKeyDown={(e) => e.key === 'Enter' && handleConnect()} />
```

### Verification Endpoint Issues

**Symptoms:**
- 404 or method not found errors
- API key format is valid but verification fails

**Cause:**
Using wrong endpoint for verification.

**Solution:**
Always use `/compute/v1/environments` for verification, not `/v1/vaults`:
```typescript
// ✅ CORRECT
await fetch('https://api.case.dev/compute/v1/environments', ...)

// ❌ WRONG
await fetch('https://api.case.dev/v1/vaults', ...)
```

## Resources

- [Case.dev Documentation](https://docs.case.dev)
- [Vault API Reference](https://docs.case.dev/api-reference/vaults)
- [LLM API Reference](https://docs.case.dev/api-reference/llm)
- [Demo Gallery](https://case.dev/gallery)
- **Reference Implementation**: `/Users/dante.danelian/Desktop/Demos/bankruptcy-tool-OSS`
