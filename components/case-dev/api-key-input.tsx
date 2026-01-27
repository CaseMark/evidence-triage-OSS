'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Key, Check, X, CircleNotch, Eye, EyeSlash, Trash } from '@phosphor-icons/react';

const API_KEY_STORAGE_KEY = 'case-dev-api-key';
const DATABASE_PROJECT_ID_KEY = 'case-dev-database-project-id';

export interface ApiKeyState {
  key: string | null;
  isValid: boolean;
  isLoading: boolean;
  lastValidated: string | null;
}

// Validate API key format
export function validateApiKeyFormat(key: string): boolean {
  return key.startsWith('sk_case_') && key.length >= 20;
}

// Get API key from localStorage
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

// Save API key to localStorage
export function saveApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

// Remove API key from localStorage
export function removeApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(DATABASE_PROJECT_ID_KEY);
}

// Get stored database project ID
export function getStoredDatabaseProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DATABASE_PROJECT_ID_KEY);
}

// Save database project ID
function saveDatabaseProjectId(projectId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DATABASE_PROJECT_ID_KEY, projectId);
}

// Verify API key works by making a server-side request
export async function verifyApiKey(key: string): Promise<boolean> {
  try {
    // Get existing database project ID if any
    const existingProjectId = getStoredDatabaseProjectId();

    const response = await fetch('/api/case-dev/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: key,
        existingProjectId,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('[API Key] Verification failed:', data.error || 'Unknown error');
      return false;
    }

    // Store database project ID if returned
    const data = await response.json();
    if (data.database?.projectId) {
      saveDatabaseProjectId(data.database.projectId);
      console.log('[Database] Project ID stored:', data.database.projectId);
    }

    return true;
  } catch (error) {
    console.error('[API Key] Verification failed:', error);
    return false;
  }
}

// Hook to manage Case.dev API key
export function useCaseDevApiKey() {
  const [state, setState] = useState<ApiKeyState>({
    key: null,
    isValid: false,
    isLoading: true,
    lastValidated: null,
  });

  // Load key from localStorage on mount
  useEffect(() => {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      setState(prev => ({ ...prev, key: storedKey, isLoading: false }));
      // Verify the stored key
      verifyApiKey(storedKey).then(isValid => {
        setState(prev => ({
          ...prev,
          isValid,
          lastValidated: isValid ? new Date().toISOString() : null,
        }));
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const setApiKey = useCallback(async (key: string): Promise<boolean> => {
    if (!validateApiKeyFormat(key)) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    const isValid = await verifyApiKey(key);

    if (isValid) {
      saveApiKey(key);
      // Set cookie for middleware authentication
      document.cookie = 'has-case-api-key=true; path=/; max-age=31536000'; // 1 year
      setState({
        key,
        isValid: true,
        isLoading: false,
        lastValidated: new Date().toISOString(),
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }

    return isValid;
  }, []);

  const clearApiKey = useCallback(() => {
    removeApiKey();
    // Clear cookie for middleware authentication
    document.cookie = 'has-case-api-key=; path=/; max-age=0';
    setState({
      key: null,
      isValid: false,
      isLoading: false,
      lastValidated: null,
    });
  }, []);

  const refreshValidation = useCallback(async () => {
    if (!state.key) return false;

    setState(prev => ({ ...prev, isLoading: true }));
    const isValid = await verifyApiKey(state.key);
    setState(prev => ({
      ...prev,
      isValid,
      isLoading: false,
      lastValidated: isValid ? new Date().toISOString() : prev.lastValidated,
    }));
    return isValid;
  }, [state.key]);

  return {
    ...state,
    setApiKey,
    clearApiKey,
    refreshValidation,
    isConnected: state.isValid && state.key !== null,
  };
}

// Mask API key for display (show last 4 characters)
function maskApiKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `sk_case_${'•'.repeat(key.length - 12)}${key.slice(-4)}`;
}

interface ApiKeyInputProps {
  onConnectionChange?: (isConnected: boolean) => void;
  compact?: boolean;
}

export function ApiKeyInput({ onConnectionChange, compact = false }: ApiKeyInputProps) {
  const { key, isValid, isLoading, setApiKey, clearApiKey, isConnected } = useCaseDevApiKey();
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  const handleConnect = async () => {
    setError(null);

    if (!inputValue.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!validateApiKeyFormat(inputValue)) {
      setError('Invalid API key format. Key should start with "sk_case_" and be at least 20 characters.');
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

  const handleDisconnect = () => {
    clearApiKey();
    setInputValue('');
    setError(null);
  };

  if (isLoading) {
    return (
      <Card className={compact ? 'w-full' : 'w-full max-w-md'}>
        <CardContent className="flex items-center justify-center py-6">
          <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  // Connected state
  if (isConnected && key) {
    return (
      <Card className={compact ? 'w-full' : 'w-full max-w-md'}>
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">Connected to Case.dev</CardTitle>
                {!compact && (
                  <CardDescription className="text-xs">
                    {maskApiKey(key)}
                  </CardDescription>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDisconnect}
              title="Disconnect"
            >
              <Trash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </CardHeader>
        {compact && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">{maskApiKey(key)}</p>
          </CardContent>
        )}
      </Card>
    );
  }

  // Disconnected state - show input form
  return (
    <Card className={compact ? 'w-full' : 'w-full max-w-md'}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <Key className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Connect to Case.dev</CardTitle>
            <CardDescription className="text-xs">
              Enter your API key to enable cloud features
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="sk_case_..."
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
            className="pr-10"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <X className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Get your API key from{' '}
          <a
            href="https://console.case.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.case.dev
          </a>
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleConnect} className="w-full" disabled={!inputValue || isSubmitting}>
          {isSubmitting ? (
            <>
              <CircleNotch className="h-4 w-4 animate-spin mr-2" />
              Verifying...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ApiKeyInput;
