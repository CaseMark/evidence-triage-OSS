# Local Storage Skill

## Purpose

This skill covers implementing client-side data persistence using **IndexedDB** (via Dexie.js) and **localStorage** as a local alternative to cloud vaults or server-side databases. This pattern enables offline-capable apps, demo/MVP deployments without database infrastructure, and privacy-first applications where data never leaves the user's browser.

## Key Concepts

- **IndexedDB (Dexie.js)**: Large data storage (documents, records, analysis results) - supports 100s of MBs
- **localStorage**: Small state data (preferences, active sessions, UI state) - limited to ~5MB
- **Hybrid Architecture**: Use IndexedDB for data, localStorage for state
- **User Isolation**: Data scoped by `userId` and `organizationId` when auth is enabled
- **Browser-Scoped**: Data persists per browser, not synced across devices

## When to Use This Pattern

| Use Case | Recommendation |
|----------|----------------|
| Demo/MVP without database setup | **Yes** - no infrastructure needed |
| Offline-capable application | **Yes** - data persists without network |
| Privacy-first (data stays local) | **Yes** - nothing leaves the browser |
| Multi-device sync required | **No** - use server database |
| Large-scale production | **No** - use Neon/PostgreSQL |
| Compliance requiring audit logs | **No** - use server database |

---

## Project Structure

```
lib/
├── storage/
│   ├── db.ts                    # IndexedDB setup with Dexie.js
│   ├── index.ts                 # Unified storage operations (CRUD)
│   └── local-storage-helpers.ts # localStorage utilities
types/
├── contract.ts                  # Data type definitions
├── comparison.ts                # Related data types
└── index.ts                     # Re-exports
```

---

## Setup

### Installation

```bash
bun add dexie
```

Dexie.js provides a cleaner API over raw IndexedDB with TypeScript support.

### No Environment Variables Required

Unlike server databases, local storage requires no configuration. Data is stored in the user's browser automatically.

---

## IndexedDB Setup (Dexie.js)

### Database Class Definition

```typescript
// lib/storage/db.ts
import Dexie, { type Table } from 'dexie';
import type { Contract, Clause } from '@/types/contract';
import type { Comparison, ClauseMatch, SemanticTag } from '@/types/comparison';

export class ContractDatabase extends Dexie {
  // Typed table declarations
  contracts!: Table<Contract>;
  clauses!: Table<Clause>;
  comparisons!: Table<Comparison>;
  clauseMatches!: Table<ClauseMatch>;
  semanticTags!: Table<SemanticTag>;

  constructor() {
    super('ContractComparator'); // Database name

    // Schema definition - version 1
    this.version(1).stores({
      // Primary key is first, then indexed fields
      contracts: 'id, uploadedBy, organizationId, uploadedAt, status',
      clauses: 'id, contractId, type, contentHash',
      comparisons: 'id, createdBy, organizationId, status, createdAt',
      clauseMatches: 'id, comparisonId, matchType, riskLevel',
      semanticTags: 'id, comparisonId, category',
    });
  }
}

// Singleton pattern - one database instance
let dbInstance: ContractDatabase | null = null;

export function getDatabase(): ContractDatabase {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }

  if (!dbInstance) {
    dbInstance = new ContractDatabase();
  }

  return dbInstance;
}

// Browser environment check
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// Reset database (for testing or user-initiated clear)
export async function resetDatabase(): Promise<void> {
  if (!isBrowser()) return;

  const db = getDatabase();
  await db.delete();
  dbInstance = null;
}
```

### Schema Design Principles

1. **Primary Key First**: The first field in the store definition is the primary key
2. **Index Frequently Queried Fields**: Add fields you'll filter/sort by to the index
3. **User Scoping**: Always include `uploadedBy`/`createdBy` and `organizationId` for multi-user support
4. **Versioning**: Increment version when changing schema

```typescript
// Schema syntax: 'primaryKey, index1, index2, ...'
this.version(1).stores({
  contracts: 'id, uploadedBy, organizationId, uploadedAt',
  //          ↑    ↑           ↑              ↑
  //          PK   User scope  Org scope     Sort field
});
```

---

## localStorage Helpers

### Robust Implementation

```typescript
// lib/storage/local-storage-helpers.ts
const DEBUG = process.env.NODE_ENV === 'development';

// Centralized key definitions - prefix with app identifier
export const STORAGE_KEYS = {
  ACTIVE_COMPARISON: 'ccc:activeComparison',
  PREFERENCES: (userId: string) => `ccc:prefs:${userId}`,
  STORAGE_VERSION: 'ccc:version',
} as const;

// Current storage schema version
export const STORAGE_VERSION = 1;
```

### Date Serialization

localStorage only stores strings. Dates need serialization:

```typescript
// Serialize dates to ISO strings for storage
export function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDates) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }

  return obj;
}

// Deserialize ISO strings back to Date objects
export function deserializeDates<T>(obj: T, dateFields: string[] = []): T {
  if (obj === null || obj === undefined) return obj;

  const defaultDateFields = [
    'createdAt', 'updatedAt', 'uploadedAt', 'startedAt', 'generatedAt',
  ];

  const allDateFields = [...new Set([...defaultDateFields, ...dateFields])];

  if (Array.isArray(obj)) {
    return obj.map(item => deserializeDates(item, dateFields)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (allDateFields.includes(key) && typeof value === 'string') {
        const parsed = new Date(value);
        result[key] = isNaN(parsed.getTime()) ? value : parsed;
      } else if (typeof value === 'object') {
        result[key] = deserializeDates(value, dateFields);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return obj;
}
```

### Safe Load/Save Operations

```typescript
// Safe load with error handling and validation
export function loadFromLocalStorage<T>(
  key: string,
  options?: {
    dateFields?: string[];
    validator?: (data: unknown) => data is T;
  }
): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawData = localStorage.getItem(key);

    if (!rawData) {
      if (DEBUG) {
        console.log(`[Storage] Key "${key}" not found in localStorage`);
      }
      return null;
    }

    const parsed = JSON.parse(rawData);
    const deserialized = deserializeDates<T>(parsed, options?.dateFields);

    // Optional validation
    if (options?.validator && !options.validator(deserialized)) {
      console.warn(`[Storage] Validation failed for key "${key}"`);
      return null;
    }

    if (DEBUG) {
      console.log(`[Storage] Loaded from "${key}":`, deserialized);
    }

    return deserialized;
  } catch (error) {
    console.error(`[Storage] Failed to load from "${key}":`, error);
    return null;
  }
}

// Safe save with error handling
export function saveToLocalStorage<T>(key: string, data: T): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const serialized = serializeDates(data);
    const jsonString = JSON.stringify(serialized);

    localStorage.setItem(key, jsonString);

    if (DEBUG) {
      console.log(`[Storage] Saved to "${key}":`, {
        data: serialized,
        size: `${(jsonString.length / 1024).toFixed(2)} KB`,
      });
    }

    return true;
  } catch (error) {
    console.error(`[Storage] Failed to save to "${key}":`, error);

    // Handle quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[Storage] localStorage quota exceeded');
    }

    return false;
  }
}

// Remove specific key
export function removeFromLocalStorage(key: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.removeItem(key);
    if (DEBUG) {
      console.log(`[Storage] Removed key "${key}"`);
    }
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to remove "${key}":`, error);
    return false;
  }
}
```

### Clear Operations

```typescript
// Clear all app data (logout, reset)
export function clearAllStorageData(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    // Find all keys with our prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ccc:')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (DEBUG) {
      console.log(`[Storage] Cleared ${keysToRemove.length} keys:`, keysToRemove);
    }
  } catch (error) {
    console.error('[Storage] Failed to clear all storage data:', error);
  }
}

// Clear specific state
export function clearActiveComparisonStorage(): void {
  removeFromLocalStorage(STORAGE_KEYS.ACTIVE_COMPARISON);
}

export function clearUserPreferencesStorage(userId: string): void {
  removeFromLocalStorage(STORAGE_KEYS.PREFERENCES(userId));
}
```

### Storage Diagnostics

```typescript
// Get storage usage info
export function getStorageInfo(): {
  used: number;
  available: number;
  items: number;
  appItems: number;
} {
  if (typeof window === 'undefined') {
    return { used: 0, available: 0, items: 0, appItems: 0 };
  }

  let used = 0;
  let appItems = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        used += key.length + value.length;
      }
      if (key.startsWith('ccc:')) {
        appItems++;
      }
    }
  }

  // localStorage typically has a 5MB limit
  const available = 5 * 1024 * 1024 - used;

  return {
    used,
    available,
    items: localStorage.length,
    appItems,
  };
}
```

---

## Unified Storage Operations

### CRUD Pattern for IndexedDB

```typescript
// lib/storage/index.ts
import { getDatabase, isBrowser } from './db';
import type { Contract, Clause } from '@/types/contract';

const DEBUG = process.env.NODE_ENV === 'development';

// CREATE
export async function saveContract(contract: Contract): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    const db = getDatabase();
    await db.contracts.put(contract);

    if (DEBUG) {
      console.log('[Storage] Saved contract:', { id: contract.id, name: contract.name });
    }

    return true;
  } catch (error) {
    console.error('[Storage] Failed to save contract:', error);
    return false;
  }
}

// READ (single)
export async function getContract(id: string): Promise<Contract | undefined> {
  if (!isBrowser()) return undefined;

  try {
    const db = getDatabase();
    return await db.contracts.get(id);
  } catch (error) {
    console.error('[Storage] Failed to get contract:', error);
    return undefined;
  }
}

// READ (list with user scoping)
export async function listContracts(
  userId: string,
  organizationId?: string
): Promise<Contract[]> {
  if (!isBrowser()) return [];

  try {
    const db = getDatabase();

    // Query by user ID
    let query = db.contracts.where('uploadedBy').equals(userId);

    // Additional org filter if provided
    if (organizationId) {
      const contracts = await query.toArray();
      return contracts
        .filter(c => c.organizationId === organizationId)
        .sort((a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
    }

    const contracts = await query.toArray();
    return contracts.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  } catch (error) {
    console.error('[Storage] Failed to list contracts:', error);
    return [];
  }
}

// UPDATE
export async function updateContractStatus(
  id: string,
  status: Contract['status']
): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    const db = getDatabase();
    await db.contracts.update(id, { status });
    return true;
  } catch (error) {
    console.error('[Storage] Failed to update contract status:', error);
    return false;
  }
}

// DELETE (with cascade)
export async function deleteContract(id: string): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    const db = getDatabase();

    // Delete associated data first (cascade)
    await db.clauses.where('contractId').equals(id).delete();
    await db.contracts.delete(id);

    if (DEBUG) {
      console.log('[Storage] Deleted contract:', { id });
    }

    return true;
  } catch (error) {
    console.error('[Storage] Failed to delete contract:', error);
    return false;
  }
}

// BULK INSERT
export async function saveClauses(clauses: Clause[]): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    const db = getDatabase();
    await db.clauses.bulkPut(clauses);

    if (DEBUG) {
      console.log('[Storage] Saved clauses:', { count: clauses.length });
    }

    return true;
  } catch (error) {
    console.error('[Storage] Failed to save clauses:', error);
    return false;
  }
}
```

### localStorage State Operations

```typescript
// lib/storage/index.ts (continued)
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  clearActiveComparisonStorage,
  clearUserPreferencesStorage,
  STORAGE_KEYS,
} from './local-storage-helpers';
import type { ActiveComparison, UserPreferences } from '@/types/comparison';

// Active comparison state (survives page refresh)
export function getActiveComparison(): ActiveComparison | null {
  return loadFromLocalStorage<ActiveComparison>(STORAGE_KEYS.ACTIVE_COMPARISON, {
    dateFields: ['startedAt'],
  });
}

export function setActiveComparison(comparison: ActiveComparison | null): void {
  if (comparison) {
    saveToLocalStorage(STORAGE_KEYS.ACTIVE_COMPARISON, comparison);
  } else {
    clearActiveComparisonStorage();
  }
}

// User preferences (per-user settings)
export function getUserPreferences(userId: string): UserPreferences | null {
  return loadFromLocalStorage<UserPreferences>(STORAGE_KEYS.PREFERENCES(userId));
}

export function setUserPreferences(userId: string, preferences: UserPreferences): boolean {
  return saveToLocalStorage(STORAGE_KEYS.PREFERENCES(userId), preferences);
}

export function clearUserPreferences(userId: string): void {
  clearUserPreferencesStorage(userId);
}
```

---

## Type Definitions

### Data Models

```typescript
// types/contract.ts
export type ClauseType =
  | 'indemnification' | 'liability' | 'confidentiality'
  | 'termination' | 'warranty' | 'dispute_resolution'
  | 'intellectual_property' | 'non_compete' | 'force_majeure'
  | 'assignment' | 'governing_law' | 'payment_terms'
  | 'representation' | 'insurance' | 'other';

export interface Contract {
  id: string;
  name: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  fileSize: number;
  content: string;
  uploadedAt: string;           // ISO date string
  uploadedBy: string;           // User ID for scoping
  organizationId?: string;      // Org ID for multi-tenant
  status: 'uploading' | 'processing' | 'completed' | 'failed';
}

export interface Clause {
  id: string;
  contractId: string;           // Foreign key
  type: ClauseType;
  title: string;
  content: string;
  sectionNumber?: string;
  confidence: number;
  contentHash: string;          // For deduplication
}
```

### State Types

```typescript
// types/comparison.ts
export interface ActiveComparison {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultView?: 'summary' | 'clauses';
  notifications?: boolean;
}
```

---

## React Integration

### React Context for State

```typescript
// lib/contexts/comparison-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getActiveComparison, setActiveComparison as saveActiveComparison } from '@/lib/storage';
import type { ActiveComparison } from '@/types/comparison';

interface ComparisonContextType {
  activeComparison: ActiveComparison | null;
  setActiveComparison: (comparison: ActiveComparison | null) => void;
  clearActiveComparison: () => void;
  isComparisonInProgress: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [activeComparison, setActiveComparisonState] = useState<ActiveComparison | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = getActiveComparison();
    if (stored) {
      setActiveComparisonState(stored);
    }
  }, []);

  // Sync state changes to localStorage
  const setActiveComparison = useCallback((comparison: ActiveComparison | null) => {
    setActiveComparisonState(comparison);
    saveActiveComparison(comparison);
  }, []);

  const clearActiveComparison = useCallback(() => {
    setActiveComparisonState(null);
    saveActiveComparison(null);
  }, []);

  const isComparisonInProgress = activeComparison?.status === 'processing';

  return (
    <ComparisonContext.Provider
      value={{
        activeComparison,
        setActiveComparison,
        clearActiveComparison,
        isComparisonInProgress,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within ComparisonProvider');
  }
  return context;
}
```

### Custom Hook for Data

```typescript
// lib/hooks/use-contracts.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { listContracts, saveContract, deleteContract } from '@/lib/storage';
import { useSession } from '@/lib/auth/client';
import type { Contract } from '@/types/contract';

export function useContracts() {
  const { data: session } = useSession();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user?.id;
  const organizationId = session?.session?.activeOrganizationId;

  // Load contracts on mount and when user changes
  useEffect(() => {
    async function load() {
      if (!userId) {
        setContracts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const result = await listContracts(userId, organizationId || undefined);
      setContracts(result);
      setIsLoading(false);
    }

    load();
  }, [userId, organizationId]);

  // Add contract
  const addContract = useCallback(async (contract: Contract) => {
    const success = await saveContract(contract);
    if (success) {
      setContracts(prev => [contract, ...prev]);
    }
    return success;
  }, []);

  // Remove contract
  const removeContract = useCallback(async (id: string) => {
    const success = await deleteContract(id);
    if (success) {
      setContracts(prev => prev.filter(c => c.id !== id));
    }
    return success;
  }, []);

  return {
    contracts,
    isLoading,
    addContract,
    removeContract,
  };
}
```

---

## User Isolation Pattern

### How It Works

When auth is enabled, data is scoped by `userId`:

```typescript
// All queries filter by the authenticated user
const contracts = await db.contracts
  .where('uploadedBy')
  .equals(session.user.id)
  .toArray();
```

### Without Auth (Demo Mode)

Without auth, all data lives in the same browser database. To support demo mode:

```typescript
// Generate a persistent anonymous ID
function getAnonymousUserId(): string {
  const key = 'ccc:anonymousUserId';
  let id = localStorage.getItem(key);

  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }

  return id;
}

// Use in queries
const userId = session?.user?.id || getAnonymousUserId();
```

### Multi-Tenant Isolation

For organization-scoped apps:

```typescript
export async function listContracts(
  userId: string,
  organizationId?: string
): Promise<Contract[]> {
  const db = getDatabase();

  let contracts = await db.contracts
    .where('uploadedBy')
    .equals(userId)
    .toArray();

  // Additional org filter
  if (organizationId) {
    contracts = contracts.filter(c => c.organizationId === organizationId);
  }

  return contracts;
}
```

---

## Migration & Versioning

### Schema Versioning

```typescript
export class ContractDatabase extends Dexie {
  constructor() {
    super('ContractComparator');

    // Version 1 - initial schema
    this.version(1).stores({
      contracts: 'id, uploadedBy, uploadedAt',
      clauses: 'id, contractId',
    });

    // Version 2 - add organizationId index
    this.version(2).stores({
      contracts: 'id, uploadedBy, organizationId, uploadedAt',
      clauses: 'id, contractId, type',
    });

    // Version 3 - add new table
    this.version(3).stores({
      contracts: 'id, uploadedBy, organizationId, uploadedAt',
      clauses: 'id, contractId, type',
      tags: 'id, contractId, name',  // New table
    });
  }
}
```

### localStorage Version Check

```typescript
export function checkStorageVersion(): void {
  if (typeof window === 'undefined') return;

  try {
    const storedVersion = localStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
    const currentVersion = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (currentVersion < STORAGE_VERSION) {
      console.log(`[Storage] Migrating from v${currentVersion} to v${STORAGE_VERSION}`);

      // Add migration logic here
      // Example: rename keys, transform data, etc.

      localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, STORAGE_VERSION.toString());
    }
  } catch (error) {
    console.error('[Storage] Failed to check storage version:', error);
  }
}

// Call on app initialization
if (typeof window !== 'undefined') {
  checkStorageVersion();
}
```

---

## Best Practices

### 1. Always Check Browser Environment

```typescript
// IndexedDB and localStorage only work in browser
if (!isBrowser()) return [];
if (typeof window === 'undefined') return null;
```

### 2. Use Consistent Error Handling

```typescript
try {
  // Operation
  return true;
} catch (error) {
  console.error('[Storage] Operation failed:', error);
  return false; // or null, or []
}
```

### 3. Add Debug Logging

```typescript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('[Storage] Saved:', { id, type, size });
}
```

### 4. Prefix localStorage Keys

```typescript
// Good - namespaced
'ccc:activeComparison'
'ccc:prefs:user123'

// Bad - may conflict with other apps
'activeComparison'
'preferences'
```

### 5. Handle Quota Exceeded

```typescript
if (error instanceof DOMException && error.name === 'QuotaExceededError') {
  console.error('[Storage] Quota exceeded - clear old data');
  // Optionally trigger cleanup
}
```

### 6. Serialize Dates

```typescript
// Always serialize dates before storing
const serialized = serializeDates(data);
localStorage.setItem(key, JSON.stringify(serialized));

// Always deserialize dates after loading
const deserialized = deserializeDates(JSON.parse(raw));
```

---

## Common Gotchas

| Issue | Cause | Solution |
|-------|-------|----------|
| `window is not defined` | Running on server | Check `typeof window !== 'undefined'` |
| Data disappears | Browser cleared storage | Warn users about browser data clearing |
| Slow queries | Missing index | Add field to Dexie store definition |
| Dates are strings | JSON serialization | Use deserializeDates helper |
| Data not isolated | Missing user filter | Always query with `uploadedBy` |
| Quota exceeded | Too much data | Implement data cleanup, warn users |
| Version mismatch | Schema changed | Implement migration logic |

---

## Transitioning to Server Database

When ready to move from local storage to a server database:

1. **Create server API routes** that mirror storage operations
2. **Add sync logic** that uploads local data to server
3. **Replace storage calls** with API calls
4. **Keep localStorage** for offline cache if needed

```typescript
// Future: API-based storage
export async function saveContract(contract: Contract): Promise<boolean> {
  // Try server first
  try {
    const response = await fetch('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(contract),
    });

    if (response.ok) {
      // Also save locally for offline access
      await saveContractLocal(contract);
      return true;
    }
  } catch {
    // Offline - save locally only
    return await saveContractLocal(contract);
  }
}
```

---

## Resources

- [Dexie.js Documentation](https://dexie.org/docs/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Web Storage Limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
