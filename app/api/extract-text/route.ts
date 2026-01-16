import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
}

// OCR Client following the skill patterns
interface OCRSubmitResponse {
  jobId: string;
  status: string;
  statusUrl: string;
  textUrl: string;
}

interface OCRStatusResponse {
  jobId: string;
  status: string;
  text?: string;
  pageCount?: number;
  error?: string;
}

async function submitOCR(apiKey: string, documentUrl: string, fileName: string): Promise<OCRSubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/ocr/v1/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_url: documentUrl,
      file_name: fileName,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OCR submit failed: ${response.status} - ${error}`);
  }

  const result = await response.json();

  // Handle different response formats
  const jobId = result.id || result.jobId || result.job_id;
  const status = result.status || 'queued';

  if (!jobId) {
    throw new Error('OCR API did not return a job ID');
  }

  // CRITICAL: Construct our own URLs using public API base (don't use URLs from response)
  const statusUrl = `${API_BASE_URL}/ocr/v1/${jobId}`;
  const textUrl = `${API_BASE_URL}/ocr/v1/${jobId}/download/json`;

  console.log(`[OCR] Job submitted: ${jobId}, status: ${status}`);

  return {
    jobId,
    status,
    statusUrl,
    textUrl,
  };
}

async function getOCRStatus(apiKey: string, statusUrl: string, textUrl: string): Promise<OCRStatusResponse> {
  const response = await fetch(statusUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OCR status check failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const jobId = result.id || result.jobId || result.job_id;
  const status = result.status || 'processing';

  // Fetch extracted text when completed
  let text: string | undefined;
  if (status === 'completed') {
    text = await fetchExtractedText(apiKey, textUrl);
  }

  return {
    jobId,
    status,
    text: text || result.text || result.extracted_text,
    pageCount: result.pageCount || result.page_count,
    error: result.error,
  };
}

async function fetchExtractedText(apiKey: string, textUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(textUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('[OCR] Result fetch failed:', response.status);
      return undefined;
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const jsonResult = await response.json();

      // Try common field patterns
      let text = jsonResult.text || jsonResult.extracted_text || jsonResult.content;

      // Concatenate pages if present
      if (!text && jsonResult.pages && Array.isArray(jsonResult.pages)) {
        text = jsonResult.pages
          .map((page: { text?: string; content?: string }) => page.text || page.content || '')
          .join('\n\n');
      }

      return text;
    }

    // Plain text response
    return await response.text();
  } catch (e) {
    console.error('[OCR] Failed to fetch result:', e);
    return undefined;
  }
}

async function pollOCRUntilComplete(
  apiKey: string,
  statusUrl: string,
  textUrl: string,
  maxAttempts = 60,
  pollInterval = 3000
): Promise<string> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getOCRStatus(apiKey, statusUrl, textUrl);

    console.log(`[OCR] Poll attempt ${attempts + 1}: status=${status.status}`);

    if (status.status === 'completed') {
      if (!status.text) {
        throw new Error('OCR completed but no text returned');
      }
      return status.text;
    }

    if (status.status === 'failed') {
      throw new Error(`OCR failed: ${status.error || 'Unknown error'}`);
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('OCR job timed out');
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  // Check for Vercel Blob token
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`[Extract] Processing ${file.name} (${file.type})`);

    let extractedText = '';
    const contentType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Handle plain text files directly
    if (contentType === 'text/plain') {
      extractedText = buffer.toString('utf-8');
    } else if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
      // PDF or Image - use OCR API

      let documentUrl: string;
      let blobUrl: string | undefined;

      // If we have a Blob token, upload to Vercel Blob for reliable public URL
      if (blobToken) {
        try {
          const blob = await put(`ocr/${Date.now()}-${file.name}`, file, {
            access: 'public',
            token: blobToken,
          });
          documentUrl = blob.url;
          blobUrl = blob.url;
          console.log(`[Extract] Uploaded to Vercel Blob: ${documentUrl}`);
        } catch (blobError) {
          console.error('[Extract] Blob upload failed:', blobError);
          // Fall back to data URL
          const base64 = buffer.toString('base64');
          documentUrl = `data:${contentType};base64,${base64}`;
          console.log('[Extract] Using data URL fallback');
        }
      } else {
        // No Blob token, use data URL
        const base64 = buffer.toString('base64');
        documentUrl = `data:${contentType};base64,${base64}`;
        console.log('[Extract] Using data URL (no BLOB_READ_WRITE_TOKEN)');
      }

      try {
        // Submit OCR job
        const ocrJob = await submitOCR(apiKey, documentUrl, file.name);

        // Poll for completion
        extractedText = await pollOCRUntilComplete(
          apiKey,
          ocrJob.statusUrl,
          ocrJob.textUrl,
          60,  // max attempts
          3000 // poll every 3 seconds
        );

        console.log(`[Extract] OCR completed: ${extractedText.length} characters`);
      } catch (ocrError) {
        console.error('[Extract] OCR failed:', ocrError);
        // OCR failed, but we continue with empty text
      }

      // CRITICAL: Always clean up blob - user images must NEVER stay on blob permanently
      // This runs regardless of OCR success/failure
      if (blobUrl && blobToken) {
        try {
          await del(blobUrl, { token: blobToken });
          console.log('[Extract] Blob deleted - user image removed from cloud storage');
        } catch (cleanupError) {
          // Log prominently - manual cleanup may be needed
          console.error('[Extract] PRIVACY WARNING: Failed to delete blob:', cleanupError);
          console.error('[Extract] Manual cleanup needed for:', blobUrl);
        }
      }
    }

    console.log(`[Extract] Extracted ${extractedText.length} characters from ${file.name}`);

    // Calculate cost based on OCR processing
    // OCR pricing estimate: $0.001 per page (rough estimate)
    const costPerPage = 0.001;
    const estimatedPages = Math.max(1, Math.ceil(file.size / 50000)); // ~50KB per page estimate
    const cost = estimatedPages * costPerPage;

    return NextResponse.json({
      success: true,
      text: extractedText,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      cost: cost,
      charsProcessed: extractedText.length,
    });
  } catch (error) {
    console.error('[Extract] Error:', error);
    return NextResponse.json(
      { error: 'Text extraction failed' },
      { status: 500 }
    );
  }
}
