// Demo limits configuration for Evidence Triage
// All limits can be overridden via environment variables

function parseEnvInt(key: string, defaultValue: number): number {
  if (typeof window !== 'undefined') return defaultValue; // Client-side uses defaults
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const DEMO_LIMITS = {
  // Document limits
  maxDocumentsStored: parseEnvInt('DEMO_MAX_DOCUMENTS', 10), // Max docs stored at a time
  maxFileSizeBytes: parseEnvInt('DEMO_MAX_FILE_SIZE', 5 * 1024 * 1024), // 5MB
  maxTotalStorageBytes: parseEnvInt('DEMO_MAX_STORAGE', 50 * 1024 * 1024), // 50MB total

  // API call limits (per session)
  maxClassificationsPerSession: parseEnvInt('DEMO_MAX_CLASSIFICATIONS', 50),
  maxSearchesPerSession: parseEnvInt('DEMO_MAX_SEARCHES', 50),

  // Token limits (for LLM calls)
  tokensPerClassification: parseEnvInt('DEMO_TOKENS_PER_CLASSIFICATION', 2000),
  tokensPerSession: parseEnvInt('DEMO_TOKENS_PER_SESSION', 20000),

  // Supported file types
  supportedFileTypes: [
    'application/pdf',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],

  // Supported file extensions
  supportedExtensions: ['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx'],
};

// Human-readable descriptions for UI
export const LIMIT_DESCRIPTIONS = {
  maxDocuments: `Up to ${DEMO_LIMITS.maxDocumentsStored} documents at a time`,
  maxFileSize: `Max ${(DEMO_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB per file`,
  maxStorage: `${(DEMO_LIMITS.maxTotalStorageBytes / (1024 * 1024)).toFixed(0)}MB total storage`,
  maxClassifications: `${DEMO_LIMITS.maxClassificationsPerSession} AI classifications per session`,
  supportedTypes: 'PDF, TXT, JPG, PNG, GIF, WEBP, DOC, DOCX',
};

// Upgrade messages
export const UPGRADE_MESSAGES = {
  documentLimit: {
    title: 'Document Limit Reached',
    description: `You can store up to ${DEMO_LIMITS.maxDocumentsStored} documents at a time. Delete some documents to upload more, or upgrade for unlimited storage.`,
    cta: 'Upgrade to Pro',
  },
  storageLimit: {
    title: 'Storage Limit Reached',
    description: 'You\'ve reached the demo storage limit. Upgrade to unlock more storage.',
    cta: 'Upgrade to Pro',
  },
  classificationLimit: {
    title: 'Classification Limit Reached',
    description: 'You\'ve used all AI classifications for this session. Upgrade for unlimited classifications.',
    cta: 'Upgrade to Pro',
  },
  fileTooLarge: {
    title: 'File Too Large',
    description: `Files must be under ${(DEMO_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB. Upgrade to process larger files.`,
    cta: 'Upgrade to Pro',
  },
  unsupportedType: {
    title: 'Unsupported File Type',
    description: `This demo supports: ${LIMIT_DESCRIPTIONS.supportedTypes}`,
    cta: 'See Pro Features',
  },
};

// Check if file type is supported
export function isFileTypeSupported(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return (
    DEMO_LIMITS.supportedFileTypes.includes(file.type) ||
    DEMO_LIMITS.supportedExtensions.includes(extension)
  );
}

// Check if file size is within limits
export function isFileSizeValid(file: File): boolean {
  return file.size <= DEMO_LIMITS.maxFileSizeBytes;
}
