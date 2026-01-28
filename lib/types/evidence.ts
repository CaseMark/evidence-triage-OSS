// Evidence categories for legal document classification
export type EvidenceCategory =
  | 'contract'
  | 'email'
  | 'photo'
  | 'handwritten_note'
  | 'medical_record'
  | 'financial_document'
  | 'legal_filing'
  | 'correspondence'
  | 'report'
  | 'other';

export const CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  contract: 'Contract',
  email: 'Email',
  photo: 'Photo/Image',
  handwritten_note: 'Handwritten Note',
  medical_record: 'Medical Record',
  financial_document: 'Financial Document',
  legal_filing: 'Legal Filing',
  correspondence: 'Correspondence',
  report: 'Report',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<EvidenceCategory, string> = {
  contract: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  email: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  photo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  handwritten_note: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  medical_record: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  financial_document: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  legal_filing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  correspondence: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  report: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
};

// Vault document reference - links to case.dev vault storage
export interface VaultDocumentRef {
  vaultId: string;
  objectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
}

// Evidence item stored in localStorage
export interface EvidenceItem {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  category: EvidenceCategory;
  tags: string[];
  relevanceScore: number;
  extractedText?: string;
  summary?: string;
  dateDetected?: string;
  status: 'uploading' | 'processing' | 'classifying' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  // Base64 data URL for client-side storage (images only, limited size)
  thumbnailDataUrl?: string;
  // For text content
  textContent?: string;
  // Embedding vector for RAG search (legacy - now handled by vault)
  embedding?: number[];
  // Vault document reference (new - for case.dev vault storage)
  vaultDocRef?: VaultDocumentRef;
  // Flag indicating this item was recovered from vault and may need re-classification
  needsSync?: boolean;
}

// Upload progress tracking
export interface UploadProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'extracting' | 'classifying' | 'completed' | 'failed';
  error?: string;
  evidenceId?: string;
}

// Filter state for evidence list
export interface FilterState {
  categories: EvidenceCategory[];
  tags: string[];
  dateRange: {
    start?: string;
    end?: string;
  };
  searchQuery: string;
  sortBy: 'date' | 'relevance' | 'name';
  sortOrder: 'asc' | 'desc';
}

// View mode for evidence display
export type ViewMode = 'gallery' | 'list' | 'timeline';

// Classification result from LLM
export interface ClassificationResult {
  category: EvidenceCategory;
  confidence: number;
  suggestedTags: string[];
  summary: string;
  dateDetected?: string;
  relevanceScore: number;
}

// Search result with relevance
export interface SearchResult {
  evidenceId: string;
  score: number;
  matchedText?: string;
}
