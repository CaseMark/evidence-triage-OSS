/**
 * File type validation utilities
 *
 * Supported file types for document upload.
 */

// Supported MIME types
export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Supported file extensions
export const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx'];

// Human-readable description of supported types
export const SUPPORTED_TYPES_DESCRIPTION = 'PDF, TXT, JPG, PNG, GIF, WEBP, DOC, DOCX';

/**
 * Check if a file type is supported
 */
export function isFileTypeSupported(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return (
    SUPPORTED_FILE_TYPES.includes(file.type) ||
    SUPPORTED_EXTENSIONS.includes(extension)
  );
}
