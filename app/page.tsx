'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  MagnifyingGlass,
  Funnel,
  SquaresFour,
  List,
  Calendar,
  Tag,
  FileText,
  Image,
  Envelope,
  FileDoc,
  Briefcase,
  PencilLine,
  Heart,
  File,
  X,
  Check,
  SpinnerGap,
  Trash,
  Eye,
  ArrowLeft,
  Key,
} from '@phosphor-icons/react';
import {
  EvidenceItem,
  EvidenceCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  ViewMode,
  FilterState,
  UploadProgress,
} from '@/lib/types/evidence';
import {
  getAllEvidence as getAllEvidenceLegacy,
  addEvidence as addEvidenceLegacy,
  updateEvidence as updateEvidenceLegacy,
  deleteEvidence as deleteEvidenceLegacy,
  filterEvidence as filterEvidenceLegacy,
  getAllTags as getAllTagsLegacy,
  getCategoryCounts as getCategoryCountsLegacy,
  generateId as generateIdLegacy,
  formatFileSize,
  searchEvidence,
  hybridSearch as hybridSearchLegacy,
} from '@/lib/evidence-storage';
import {
  getAllEvidence,
  getAllEvidenceMetadata,
  addEvidenceMetadata,
  updateEvidenceMetadata,
  deleteEvidenceMetadata,
  getEvidenceMetadata,
  filterEvidence,
  getAllTags,
  getCategoryCounts,
  uploadDocument,
  getDocumentText,
  searchVault,
  deleteVaultDocument,
  hybridSearch,
  getOrCreateVault,
  generateId,
  getStoredVaultId,
  syncFromVault,
  saveMetadataToDatabase,
  updateMetadataInDatabase,
  deleteMetadataFromDatabase,
  initializeDatabase,
  EvidenceMetadata,
  VaultDocumentRef,
} from '@/lib/evidence-service';
import {
  isFileTypeSupported,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_TYPES_DESCRIPTION,
} from '@/lib/file-types';
import { cn } from '@/lib/utils';
import { generatePdfThumbnail, extractPdfTextClient } from '@/lib/pdf-utils';
import { ApiKeyInput, useCaseDevApiKey } from '@/components/case-dev/api-key-input';

// Category icons mapping
const CATEGORY_ICONS: Record<EvidenceCategory, React.ReactNode> = {
  contract: <Briefcase className="w-4 h-4" />,
  email: <Envelope className="w-4 h-4" />,
  photo: <Image className="w-4 h-4" />,
  handwritten_note: <PencilLine className="w-4 h-4" />,
  medical_record: <Heart className="w-4 h-4" />,
  financial_document: <FileDoc className="w-4 h-4" />,
  legal_filing: <FileText className="w-4 h-4" />,
  correspondence: <Envelope className="w-4 h-4" />,
  report: <FileText className="w-4 h-4" />,
  other: <File className="w-4 h-4" />,
};

export default function EvidenceTriagePage() {
  // State
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<EvidenceCategory, number>>({} as Record<EvidenceCategory, number>);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    tags: [],
    dateRange: {},
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchResult, setIsSearchResult] = useState(false);
  const [searchResults, setSearchResults] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deletingEvidence, setDeletingEvidence] = useState<Set<string>>(new Set());
  const [viewingEvidence, setViewingEvidence] = useState<EvidenceItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ synced: number; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // API key state
  const { key: apiKey, isValid: hasValidApiKey } = useCaseDevApiKey();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Show API key input if no valid key
  useEffect(() => {
    if (!hasValidApiKey && !loading) {
      setShowApiKeyInput(true);
    }
  }, [hasValidApiKey, loading]);

  // Perform vault sync - recovers metadata for documents in vault
  const performVaultSync = useCallback(async () => {
    const vaultId = getStoredVaultId();
    if (!vaultId) {
      console.log('[Sync] No vault ID, skipping sync');
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);

    try {
      console.log('[Sync] Starting vault sync...');
      const result = await syncFromVault();

      // Always reload evidence after sync (database data was loaded into localStorage cache)
      loadEvidence();

      if (result.synced > 0) {
        setSyncStatus({
          synced: result.synced,
          message: `Synced ${result.synced} document${result.synced > 1 ? 's' : ''} from vault`
        });
        console.log('[Sync] Synced', result.synced, 'documents');
      } else if (result.fromDatabase > 0) {
        setSyncStatus({
          synced: result.fromDatabase,
          message: `Loaded ${result.fromDatabase} document${result.fromDatabase > 1 ? 's' : ''} from database`
        });
        console.log('[Sync] Loaded', result.fromDatabase, 'documents from database');
      } else if (result.errors.length > 0) {
        console.error('[Sync] Sync errors:', result.errors);
      } else {
        console.log('[Sync] No documents found');
      }
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
    } finally {
      setIsSyncing(false);
      // Clear sync status after a few seconds
      setTimeout(() => setSyncStatus(null), 5000);
    }
  }, []);

  // Load evidence on mount
  useEffect(() => {
    loadEvidence();
    setLoading(false);
  }, []);

  // Auto-sync from vault on initial load if already connected
  useEffect(() => {
    if (hasValidApiKey && !loading) {
      performVaultSync();
    }
  }, [hasValidApiKey, loading, performVaultSync]);

  const loadEvidence = useCallback(() => {
    // Get vault-based evidence
    const vaultItems = filterEvidence(filters);

    // Also get legacy evidence for backward compatibility
    const legacyItems = filterEvidenceLegacy(filters);

    // Merge, preferring vault items but including legacy items that aren't in vault
    const vaultIds = new Set(vaultItems.map(item => item.id));
    const mergedItems = [
      ...vaultItems,
      ...legacyItems.filter(item => !vaultIds.has(item.id)),
    ];

    // Sort the merged items
    mergedItems.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'date':
          const dateA = a.dateDetected || a.createdAt;
          const dateB = b.dateDetected || b.createdAt;
          comparison = dateA.localeCompare(dateB);
          break;
        case 'relevance':
          comparison = a.relevanceScore - b.relevanceScore;
          break;
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    setEvidence(mergedItems);

    // Merge tags from both sources
    const vaultTags = getAllTags();
    const legacyTags = getAllTagsLegacy();
    const allTagsSet = new Set([...vaultTags, ...legacyTags]);
    setAllTags(Array.from(allTagsSet).sort());

    // Merge category counts
    const vaultCounts = getCategoryCounts();
    const legacyCounts = getCategoryCountsLegacy();
    const mergedCounts = { ...legacyCounts };
    for (const [category, count] of Object.entries(vaultCounts)) {
      mergedCounts[category as EvidenceCategory] = (mergedCounts[category as EvidenceCategory] || 0) + count;
    }
    setCategoryCounts(mergedCounts);

    setIsSearchResult(false);
    setSearchResults(new Map());
  }, [filters]);

  // Reload when filters change
  useEffect(() => {
    if (!loading) {
      loadEvidence();
    }
  }, [filters, loading, loadEvidence]);

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);

    // Initialize progress for all files
    const initialProgress: UploadProgress[] = fileArray.map(f => ({
      filename: f.name,
      progress: 0,
      status: 'pending',
    }));
    setUploadProgress(initialProgress);

    // Ensure vault is ready
    const vaultInfo = await getOrCreateVault();
    if (!vaultInfo) {
      console.error('[Upload] Vault not available');
      setUploadProgress(prev => prev.map(p => ({ ...p, status: 'failed', error: 'Vault not available' })));
      setIsUploading(false);
      return;
    }

    // Process files
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      // Validate file type
      if (!isFileTypeSupported(file)) {
        setUploadProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'failed', error: 'Unsupported file type' } : p
        ));
        continue;
      }

      try {
        // Update progress - uploading to vault
        setUploadProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'uploading', progress: 20 } : p
        ));

        // Upload to vault (OCR and indexing handled automatically by case.dev)
        const uploadResult = await uploadDocument(file, (status, progress) => {
          setUploadProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, progress: Math.min(progress, 50) } : p
          ));
        });

        if (!uploadResult.success || !uploadResult.docRef) {
          setUploadProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'failed', error: uploadResult.error || 'Upload failed' } : p
          ));
          continue;
        }

        const evidenceId = generateId();
        let thumbnailDataUrl: string | undefined;

        // Store thumbnail for images
        if (file.type.startsWith('image/') && file.size < 500 * 1024) {
          const reader = new FileReader();
          thumbnailDataUrl = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }

        // Generate thumbnail for PDFs
        if (file.type === 'application/pdf') {
          try {
            const pdfThumbnail = await generatePdfThumbnail(file, 300, 400);
            if (pdfThumbnail) {
              thumbnailDataUrl = pdfThumbnail;
            }
          } catch (err) {
            console.error('PDF thumbnail generation failed:', err);
          }
        }

        // Create initial metadata
        const metadata: EvidenceMetadata = {
          id: evidenceId,
          vaultDocRef: uploadResult.docRef,
          category: 'other',
          tags: [],
          relevanceScore: 0,
          thumbnailDataUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        addEvidenceMetadata(metadata);

        // Save initial metadata to database
        await saveMetadataToDatabase(metadata);

        // Update progress - extracting text (vault handles OCR)
        setUploadProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'extracting', progress: 50, evidenceId } : p
        ));

        // Get extracted text from vault (OCR result)
        let extractedText = '';

        // For text files, read directly
        if (file.type === 'text/plain') {
          extractedText = await file.text();
        } else {
          // Wait a moment for vault processing, then try to get text
          await new Promise(resolve => setTimeout(resolve, 2000));

          try {
            const vaultText = await getDocumentText(
              uploadResult.docRef.vaultId,
              uploadResult.docRef.objectId
            );
            if (vaultText) {
              extractedText = vaultText;
              console.log(`[Upload] Got ${extractedText.length} chars from vault OCR`);
            }
          } catch (err) {
            console.log('[Upload] Vault text not ready yet, falling back to local extraction');
          }

          // Fall back to local extraction if vault text not ready
          if (!extractedText) {
            if (file.type === 'application/pdf') {
              try {
                extractedText = await extractPdfTextClient(file);
                console.log(`[PDF] Client-side extracted ${extractedText.length} characters`);
              } catch (err) {
                console.error('Client-side PDF extraction failed:', err);
              }
            }

            // Fall back to server-side OCR
            if (!extractedText || file.type.startsWith('image/')) {
              try {
                const formData = new FormData();
                formData.append('file', file);

                const extractResponse = await fetch('/api/extract-text', {
                  method: 'POST',
                  body: formData,
                });

                if (extractResponse.ok) {
                  const extractResult = await extractResponse.json();
                  const serverText = extractResult.text || '';
                  if (serverText.length > extractedText.length) {
                    extractedText = serverText;
                  }
                }
              } catch (err) {
                console.error('Server text extraction failed:', err);
              }
            }
          }
        }

        // Update metadata with extracted text
        updateEvidenceMetadata(evidenceId, {
          extractedText: extractedText.substring(0, 5000),
          vaultDocRef: { ...uploadResult.docRef, status: 'processing' },
        });

        // Update progress - classifying
        setUploadProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'classifying', progress: 70 } : p
        ));

        // Classify the document
        try {
          const classifyResponse = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: extractedText,
              filename: file.name,
              contentType: file.type,
            }),
          });

          if (classifyResponse.ok) {
            const classifyResult = await classifyResponse.json();
            const classification = classifyResult.classification;

            updateEvidenceMetadata(evidenceId, {
              category: classification.category,
              tags: classification.suggestedTags || [],
              summary: classification.summary,
              dateDetected: classification.dateDetected,
              relevanceScore: classification.relevanceScore,
              vaultDocRef: { ...uploadResult.docRef, status: 'ready' },
            });

            // Update database with classification results
            await updateMetadataInDatabase(evidenceId, {
              category: classification.category,
              tags: classification.suggestedTags || [],
              summary: classification.summary,
              dateDetected: classification.dateDetected,
            });
          } else {
            updateEvidenceMetadata(evidenceId, {
              vaultDocRef: { ...uploadResult.docRef, status: 'ready' },
            });
          }
        } catch (err) {
          console.error('Classification failed:', err);
          updateEvidenceMetadata(evidenceId, {
            vaultDocRef: { ...uploadResult.docRef, status: 'ready' },
          });
        }

        // Update progress - completed
        setUploadProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'completed', progress: 100 } : p
        ));

      } catch (error) {
        console.error('Upload failed:', error);
        setUploadProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'failed', error: 'Upload failed' } : p
        ));
      }
    }

    setIsUploading(false);
    loadEvidence();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearchResult(false);
      setSearchResults(new Map());
      loadEvidence();
      return;
    }

    setIsSearching(true);

    try {
      // Check if vault is available for semantic search
      const vaultId = getStoredVaultId();

      if (vaultId) {
        // Use vault semantic search (case.dev handles embeddings)
        console.log('[Search] Using vault semantic search');
        const results = await hybridSearch(searchQuery, {
          categories: filters.categories.length > 0 ? filters.categories : undefined,
          tags: filters.tags.length > 0 ? filters.tags : undefined,
        });

        if (results.length > 0) {
          const scoreMap = new Map(results.map(r => [r.item.id, r.score]));
          setSearchResults(scoreMap);
          setEvidence(results.map(r => r.item));
          setIsSearchResult(true);
        } else {
          // Fall back to local keyword search
          console.log('[Search] No vault results, falling back to keyword search');
          const keywordResults = searchEvidence(searchQuery);
          if (keywordResults.length > 0) {
            const scoreMap = new Map(keywordResults.map(r => [r.item.id, r.score]));
            setSearchResults(scoreMap);
            setEvidence(keywordResults.map(r => r.item));
            setIsSearchResult(true);
          } else {
            setSearchResults(new Map());
            setEvidence([]);
            setIsSearchResult(true);
          }
        }
      } else {
        // No vault, use legacy local search
        console.log('[Search] Using legacy local search');
        let queryEmbedding: number[] | undefined;

        try {
          const embeddingResponse = await fetch('/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: searchQuery }),
          });

          if (embeddingResponse.ok) {
            const embeddingResult = await embeddingResponse.json();
            queryEmbedding = embeddingResult.embedding;
          }
        } catch (err) {
          console.error('[Search] Failed to get query embedding:', err);
        }

        const results = hybridSearchLegacy(searchQuery, queryEmbedding);

        if (results.length > 0) {
          const scoreMap = new Map(results.map(r => [r.item.id, r.score]));
          setSearchResults(scoreMap);
          setEvidence(results.map(r => r.item));
          setIsSearchResult(true);
        } else {
          setSearchResults(new Map());
          setEvidence([]);
          setIsSearchResult(true);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!confirm('Are you sure you want to delete this evidence?')) {
      return;
    }

    setDeletingEvidence(prev => new Set(prev).add(evidenceId));

    try {
      // Get metadata to find vault reference
      const metadata = getEvidenceMetadata(evidenceId);

      // Delete from vault if it has a vault reference
      if (metadata?.vaultDocRef) {
        try {
          await deleteVaultDocument(
            metadata.vaultDocRef.vaultId,
            metadata.vaultDocRef.objectId
          );
          console.log('[Delete] Removed from vault:', metadata.vaultDocRef.objectId);
        } catch (err) {
          console.error('[Delete] Failed to delete from vault:', err);
          // Continue with local deletion even if vault deletion fails
        }
      }

      // Delete local metadata
      deleteEvidenceMetadata(evidenceId);

      // Delete from database
      await deleteMetadataFromDatabase(evidenceId);

      // Also try legacy storage for backward compatibility
      deleteEvidenceLegacy(evidenceId);

      loadEvidence();

      if (viewingEvidence?.id === evidenceId) {
        setViewingEvidence(null);
      }
    } finally {
      setDeletingEvidence(prev => {
        const next = new Set(prev);
        next.delete(evidenceId);
        return next;
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const toggleCategory = (category: EvidenceCategory) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const clearFilters = () => {
    setFilters({
      categories: [],
      tags: [],
      dateRange: {},
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
    });
    setSearchQuery('');
  };

  const getRelevanceClass = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  // Group evidence by date for timeline view
  const evidenceByDate = evidence.reduce((acc, item) => {
    const rawDate = item.dateDetected || item.createdAt;
    const date = rawDate.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, EvidenceItem[]>);

  const sortedDates = Object.keys(evidenceByDate).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SpinnerGap className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Document Viewer Modal
  if (viewingEvidence) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewingEvidence(null)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Evidence
            </button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground truncate">
              {viewingEvidence.filename}
            </h1>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Document Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    {CATEGORY_ICONS[viewingEvidence.category]}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{viewingEvidence.filename}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatFileSize(viewingEvidence.sizeBytes)} • {viewingEvidence.contentType}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteEvidence(viewingEvidence.id)}
                  disabled={deletingEvidence.has(viewingEvidence.id)}
                  className="flex items-center gap-2 px-3 py-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingEvidence.has(viewingEvidence.id) ? (
                    <SpinnerGap className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>

            {/* Image Preview */}
            {viewingEvidence.thumbnailDataUrl && (
              <div className="p-6 border-b border-border bg-muted/50">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Image Preview</h3>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewingEvidence.thumbnailDataUrl}
                    alt={viewingEvidence.filename}
                    className="max-h-96 max-w-full object-contain rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Document Details */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Metadata */}
              <div className="space-y-6">
                {/* Category */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Category</h3>
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', CATEGORY_COLORS[viewingEvidence.category])}>
                    {CATEGORY_ICONS[viewingEvidence.category]}
                    {CATEGORY_LABELS[viewingEvidence.category]}
                  </span>
                </div>

                {/* Tags */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  {viewingEvidence.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewingEvidence.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tags</p>
                  )}
                </div>

                {/* Dates */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Dates</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Uploaded:</span> {new Date(viewingEvidence.createdAt).toLocaleString()}</p>
                    {viewingEvidence.dateDetected && (
                      <p><span className="text-muted-foreground">Document Date:</span> {formatDateForDisplay(viewingEvidence.dateDetected).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Summary & Text */}
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Summary</h3>
                  <p className="text-sm text-foreground">
                    {viewingEvidence.summary || 'No summary available.'}
                  </p>
                </div>

                {/* Extracted Text Preview */}
                {viewingEvidence.extractedText && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Extracted Text Preview</h3>
                    <div className="bg-muted rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                        {viewingEvidence.extractedText.substring(0, 2000)}
                        {viewingEvidence.extractedText.length > 2000 && '...'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Case.dev API Key Modal */}
      {showApiKeyInput && !hasValidApiKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Connect to Case.dev</h2>
                  <p className="text-sm text-muted-foreground">Enter your API key to continue</p>
                </div>
              </div>

              <ApiKeyInput
                onConnectionChange={(connected) => {
                  if (connected) {
                    setShowApiKeyInput(false);
                    loadEvidence();
                    // Auto-sync from vault after connection
                    performVaultSync();
                  }
                }}
              />

              <div className="text-center text-xs text-muted-foreground">
                <p>
                  Don't have an API key?{' '}
                  <a
                    href="https://console.case.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Get one free at console.case.dev
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Evidence Triage</h1>
            <a
              href="https://case.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              <span>built with</span>
              <svg width="14" height="14" viewBox="0 0 144 144" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M127.927 56.3865C127.927 54.7298 126.583 53.3867 124.927 53.3865H19.6143C17.9574 53.3865 16.6143 54.7296 16.6143 56.3865V128.226C16.6143 129.883 17.9574 131.226 19.6143 131.226H124.927C126.583 131.226 127.927 129.883 127.927 128.226V56.3865ZM93.1553 32.6638C93.1553 31.007 91.8121 29.6639 90.1553 29.6638H53.4102C51.7534 29.664 50.4102 31.0071 50.4102 32.6638V47.3865H93.1553V32.6638ZM99.1553 47.3865H124.927C129.897 47.3867 133.927 51.4161 133.927 56.3865V128.226C133.927 133.197 129.897 137.226 124.927 137.226H19.6143C14.6437 137.226 10.6143 133.197 10.6143 128.226V56.3865C10.6143 51.4159 14.6437 47.3865 19.6143 47.3865H44.4102V32.6638C44.4102 27.6933 48.4397 23.664 53.4102 23.6638H90.1553C95.1258 23.6639 99.1553 27.6933 99.1553 32.6638V47.3865Z" fill="#EB5600"/>
                <path d="M76.6382 70.6082C77.8098 69.4366 79.7088 69.4366 80.8804 70.6082L98.8013 88.5291C100.754 90.4817 100.754 93.6477 98.8013 95.6003L80.8804 113.521C79.7088 114.693 77.8097 114.693 76.6382 113.521C75.4667 112.35 75.4667 110.451 76.6382 109.279L93.8521 92.0642L76.6382 74.8503C75.4666 73.6788 75.4666 71.7797 76.6382 70.6082Z" fill="#EB5600"/>
                <path d="M67.3618 70.6082C66.1902 69.4366 64.2912 69.4366 63.1196 70.6082L45.1987 88.5291C43.2461 90.4817 43.2461 93.6477 45.1987 95.6003L63.1196 113.521C64.2912 114.693 66.1903 114.693 67.3618 113.521C68.5333 112.35 68.5333 110.451 67.3618 109.279L50.1479 92.0642L67.3618 74.8503C68.5334 73.6788 68.5334 71.7797 67.3618 70.6082Z" fill="#EB5600"/>
              </svg>
              <span className="font-semibold">case.dev</span>
            </a>
            {isSyncing && (
              <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                <SpinnerGap className="w-3 h-3 animate-spin" />
                Syncing from vault...
              </div>
            )}
            {syncStatus && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
                <Check className="w-3 h-3" />
                {syncStatus.message}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search evidence..."
                className="w-64 pl-10 pr-10 py-2 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <MagnifyingGlass className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
              {isSearching && (
                <div className="absolute right-3">
                  <SpinnerGap className="w-4 h-4 animate-spin text-primary" />
                </div>
              )}
              {!isSearching && searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchResult(false);
                    loadEvidence();
                  }}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('gallery')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'gallery' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Gallery view"
              >
                <SquaresFour className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Timeline view"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>

            {/* API Key button */}
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
              title="Manage Case.dev API Key"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Evidence
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
              accept={SUPPORTED_EXTENSIONS.join(',')}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar */}
        <aside className="w-64 bg-card border-r border-border overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Funnel className="w-4 h-4" />
                Filters
              </h2>
              {(filters.categories.length > 0 || filters.tags.length > 0) && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Categories</h3>
              <div className="space-y-1">
                {(Object.keys(CATEGORY_LABELS) as EvidenceCategory[]).map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors',
                      filters.categories.includes(category)
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {CATEGORY_ICONS[category]}
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {categoryCounts[category] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {allTags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                        filters.tags.includes(tag)
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Sort by</h3>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['sortOrder']];
                  setFilters(prev => ({ ...prev, sortBy, sortOrder }));
                }}
                className="w-full px-2 py-1.5 border border-border rounded text-sm bg-background text-foreground"
              >
                <option value="date-desc">Date (newest first)</option>
                <option value="date-asc">Date (oldest first)</option>
                <option value="relevance-desc">Relevance (highest first)</option>
                <option value="relevance-asc">Relevance (lowest first)</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mb-6 bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">Upload Progress</h3>
                <button
                  onClick={() => setUploadProgress([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {uploadProgress.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate text-foreground">{item.filename}</span>
                        <span className="text-muted-foreground capitalize">{item.status}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            item.status === 'failed' ? 'bg-destructive' :
                              item.status === 'completed' ? 'bg-green-500' : 'bg-primary'
                          )}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      {item.error && (
                        <p className="text-xs text-destructive mt-1">{item.error}</p>
                      )}
                    </div>
                    {item.status === 'completed' && <Check className="w-4 h-4 text-green-500" />}
                    {item.status === 'failed' && <X className="w-4 h-4 text-destructive" />}
                    {(item.status === 'uploading' || item.status === 'extracting' || item.status === 'classifying') && (
                      <SpinnerGap className="w-4 h-4 animate-spin text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground'
            )}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              Drag and drop files here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:text-primary/80"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {SUPPORTED_TYPES_DESCRIPTION}
            </p>
          </div>

          {/* Empty State */}
          {evidence.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">No evidence yet</h3>
              <p className="text-muted-foreground">Upload files to start building your evidence collection</p>
            </div>
          )}

          {/* Gallery View */}
          {viewMode === 'gallery' && evidence.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {evidence.map(item => (
                <div
                  key={item.id}
                  className="group relative bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setViewingEvidence(item)}
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvidence(item.id);
                    }}
                    disabled={deletingEvidence.has(item.id)}
                    className="absolute top-2 right-2 p-1.5 bg-card/90 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 disabled:opacity-50"
                    title="Delete evidence"
                  >
                    {deletingEvidence.has(item.id) ? (
                      <SpinnerGap className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash className="w-4 h-4" />
                    )}
                  </button>

                  {/* Thumbnail/Icon */}
                  <div className="h-32 bg-muted flex items-center justify-center">
                    {item.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailDataUrl}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground">
                        {CATEGORY_ICONS[item.category]}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <h4 className="font-medium text-sm text-foreground truncate" title={item.filename}>
                      {item.filename}
                    </h4>

                    {/* Category badge */}
                    <div className="mt-2">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[item.category])}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>

                    {/* Search relevance */}
                    {isSearchResult && searchResults.has(item.id) && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Search Relevance</span>
                          <span>{searchResults.get(item.id)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', getRelevanceClass(searchResults.get(item.id) || 0))}
                            style={{ width: `${searchResults.get(item.id)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{tag}</span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Status indicator */}
                    {item.status !== 'completed' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                        <SpinnerGap className="w-3 h-3 animate-spin" />
                        Processing...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && evidence.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tags</th>
                    {isSearchResult && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Relevance</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {evidence.map(item => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setViewingEvidence(item)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {CATEGORY_ICONS[item.category]}
                          <span className="text-sm font-medium text-foreground truncate max-w-xs">
                            {item.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[item.category])}>
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{tag}</span>
                          ))}
                          {item.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{item.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      {isSearchResult && (
                        <td className="px-4 py-3">
                          {searchResults.has(item.id) ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full">
                                <div
                                  className={cn('h-full rounded-full', getRelevanceClass(searchResults.get(item.id) || 0))}
                                  style={{ width: `${searchResults.get(item.id)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{searchResults.get(item.id)}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatFileSize(item.sizeBytes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(item.dateDetected || item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingEvidence(item);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvidence(item.id);
                            }}
                            disabled={deletingEvidence.has(item.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete evidence"
                          >
                            {deletingEvidence.has(item.id) ? (
                              <SpinnerGap className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && evidence.length > 0 && (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {formatDateForDisplay(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <div className="space-y-3 border-l-2 border-border pl-4 ml-2">
                    {evidenceByDate[date].map(item => (
                      <div
                        key={item.id}
                        className="group relative bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow cursor-pointer -ml-[1.125rem]"
                        onClick={() => setViewingEvidence(item)}
                      >
                        <div className="absolute -left-[0.5625rem] top-5 w-3 h-3 bg-primary rounded-full" />

                        {/* Action buttons */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingEvidence(item);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvidence(item.id);
                            }}
                            disabled={deletingEvidence.has(item.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete evidence"
                          >
                            {deletingEvidence.has(item.id) ? (
                              <SpinnerGap className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-start justify-between pr-20">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              {CATEGORY_ICONS[item.category]}
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">{item.filename}</h4>
                              <p className="text-sm text-muted-foreground">{item.summary || 'No summary available'}</p>
                            </div>
                          </div>
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[item.category])}>
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        </div>
                        {item.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {item.tags.map(tag => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
