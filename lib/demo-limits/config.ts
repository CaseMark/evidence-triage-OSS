// Centralized demo limits configuration
// All limits can be overridden via environment variables

import type { DemoLimits } from '@/lib/types/demo-limits';

function parseEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Demo limits configuration
 * Can be overridden via environment variables:
 * - DEMO_SESSION_HOURS (default: 24)
 * - DEMO_SESSION_PRICE_LIMIT (default: 5)
 * - DEMO_MAX_DOCUMENTS_PER_SESSION (default: 20)
 * - DEMO_MAX_FILE_SIZE (in bytes, default: 10MB)
 */
export const DEMO_LIMITS: DemoLimits = {
  pricing: {
    sessionHours: parseEnvInt('DEMO_SESSION_HOURS', 24),
    sessionPriceLimit: parseEnvFloat('DEMO_SESSION_PRICE_LIMIT', 5),
    pricePerThousandChars: 0.0005, // $0.0005 per 1000 characters (~$0.50 per million chars, realistic for LLM inference)
  },
  documents: {
    maxDocumentsPerSession: parseEnvInt('DEMO_MAX_DOCUMENTS_PER_SESSION', 20),
    maxFileSize: parseEnvInt('DEMO_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
  },
};

// Human-readable limit descriptions for UI
export const LIMIT_DESCRIPTIONS = {
  pricing: {
    sessionLimit: `$${DEMO_LIMITS.pricing.sessionPriceLimit.toFixed(2)} per ${DEMO_LIMITS.pricing.sessionHours}hr session`,
  },
  documents: {
    maxDocumentsPerSession: `${DEMO_LIMITS.documents.maxDocumentsPerSession} documents per session`,
    maxFileSize: `${(DEMO_LIMITS.documents.maxFileSize / (1024 * 1024)).toFixed(0)}MB max file size`,
  },
};

// Upgrade CTA messages
export const UPGRADE_MESSAGES = {
  priceLimit: {
    title: 'Session Limit Reached',
    description: `You've reached the $${DEMO_LIMITS.pricing.sessionPriceLimit.toFixed(2)} demo session limit. Upgrade to unlock unlimited processing.`,
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
  documentLimit: {
    title: 'Document Limit Reached',
    description: 'You\'ve reached the demo document processing limit. Upgrade for unlimited document processing.',
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
  fileTooLarge: {
    title: 'File Too Large',
    description: `Files must be under ${(DEMO_LIMITS.documents.maxFileSize / (1024 * 1024)).toFixed(0)}MB. Upgrade to process larger files.`,
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
};

export default DEMO_LIMITS;
