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
  // File size limits
  maxFileSizeBytes: parseEnvInt('DEMO_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
  maxTotalStorageBytes: parseEnvInt('DEMO_MAX_STORAGE', 50 * 1024 * 1024), // 50MB total

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
  maxFileSize: `Max ${(DEMO_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB per file`,
  maxStorage: `${(DEMO_LIMITS.maxTotalStorageBytes / (1024 * 1024)).toFixed(0)}MB total storage`,
  supportedTypes: 'PDF, TXT, JPG, PNG, GIF, WEBP, DOC, DOCX',
};

// Upgrade messages
export const UPGRADE_MESSAGES = {
  documentLimit: {
    title: 'Document Limit Reached',
    description: 'You\'ve reached the demo document limit. Delete some documents to upload more, or upgrade for unlimited storage.',
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
  storageLimit: {
    title: 'Storage Limit Reached',
    description: 'You\'ve reached the demo storage limit. Upgrade to unlock more storage.',
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
  priceLimit: {
    title: 'Session Limit Reached',
    description: 'You\'ve reached the demo session price limit. Upgrade for unlimited processing.',
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
  fileTooLarge: {
    title: 'File Too Large',
    description: `Files must be under ${(DEMO_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB. Upgrade to process larger files.`,
    cta: 'Upgrade',
    ctaUrl: 'https://case.dev',
  },
  unsupportedType: {
    title: 'Unsupported File Type',
    description: `This demo supports: ${LIMIT_DESCRIPTIONS.supportedTypes}`,
    cta: 'Learn More',
    ctaUrl: 'https://case.dev',
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
