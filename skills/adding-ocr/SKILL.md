# Case.dev OCR API Integration Skill

This skill documents critical patterns and fixes for integrating with the Case.dev OCR API. Use this as a reference when implementing OCR in any demo app.

## Environment Variables

```env
CASE_API_URL=https://api.case.dev
CASE_API_KEY=your_api_key_here
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token  # For file uploads
```

## Critical URL Patterns

### The Problem: Internal vs Public URLs

The OCR API returns internal URLs (e.g., `vision.casemark.net`) that are not publicly accessible. **You must construct your own URLs** using the public API base URL.

### URL Pattern Mapping

| Endpoint | Internal Pattern (DO NOT USE) | Public Pattern (USE THIS) |
|----------|------------------------------|---------------------------|
| Status | `/v1/ocr/{jobId}` | `/ocr/v1/{jobId}` |
| JSON Result | `/v1/ocr/{jobId}/result` | `/ocr/v1/{jobId}/download/json` |
| Text Result | `/v1/ocr/{jobId}/text` | `/ocr/v1/{jobId}/download/text` |

### Correct URL Construction

```typescript
// CORRECT: Construct URLs using public API base
const baseUrl = "https://api.case.dev";
const jobId = result.id || result.jobId || result.job_id;

const statusUrl = `${baseUrl}/ocr/v1/${jobId}`;
const jsonUrl = `${baseUrl}/ocr/v1/${jobId}/download/json`;

// WRONG: Using URLs from API response directly
// These may point to internal services like vision.casemark.net
const statusUrl = result.statusUrl;  // DO NOT USE
const textUrl = result.textUrl;      // DO NOT USE
```

## API Endpoints

### 1. Submit OCR Job

**Endpoint:** `POST /ocr/v1/process`

**Request:**
```typescript
const response = await fetch(`${baseUrl}/ocr/v1/process`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_url: documentUrl,  // Vercel Blob URL or data URL
    file_name: fileName,
  }),
});
```

**Response Handling:**
```typescript
const result = await response.json();

// Handle different response formats - the API may return:
// - { id: "..." } or { jobId: "..." } or { job_id: "..." }
const jobId = result.id || result.jobId || result.job_id;
const status = result.status || "queued";

if (!jobId) {
  throw new Error("OCR API did not return a job ID");
}
```

### 2. Check Job Status

**Endpoint:** `GET /ocr/v1/{jobId}`

**Request:**
```typescript
const response = await fetch(statusUrl, {
  headers: {
    "Authorization": `Bearer ${apiKey}`,
  },
});
```

**Status Values:**
- `queued` - Waiting to start
- `pending` - Waiting to start (alias)
- `processing` - Currently running
- `completed` - Ready to fetch results
- `failed` - Processing failed

### 3. Fetch OCR Results

**Endpoint:** `GET /ocr/v1/{jobId}/download/json`

This is the critical endpoint for getting extracted text. The `/download/json` path is required.

**Response Format:**
```typescript
// JSON response structure (varies, handle all patterns)
interface OCRJsonResult {
  text?: string;           // Full extracted text
  extracted_text?: string; // Alternative field name
  content?: string;        // Another alternative
  pages?: Array<{          // Page-by-page results
    text?: string;
    content?: string;
    page_number?: number;
  }>;
  page_count?: number;
}
```

**Extracting Text:**
```typescript
const textResponse = await fetch(jsonUrl, {
  headers: {
    "Authorization": `Bearer ${apiKey}`,
  },
});

const jsonResult = await textResponse.json();

// Try common field patterns
let text = jsonResult.text
  || jsonResult.extracted_text
  || jsonResult.content;

// If text is in pages array, concatenate all page texts
if (!text && jsonResult.pages && Array.isArray(jsonResult.pages)) {
  text = jsonResult.pages
    .map((page) => page.text || page.content || "")
    .join("\n\n");
}
```

## Complete Working Implementation

```typescript
interface OCRSubmitResponse {
  jobId: string;
  status: "queued" | "processing" | "pending";
  statusUrl: string;
  textUrl: string;
}

interface OCRStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "pending" | "completed" | "failed";
  text?: string;
  pageCount?: number;
  error?: string;
}

class OCRClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.case.dev") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async submitOCR(documentUrl: string, fileName: string): Promise<OCRSubmitResponse> {
    const response = await fetch(`${this.baseUrl}/ocr/v1/process`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
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
    const jobId = result.id || result.jobId || result.job_id;
    const status = result.status || "queued";

    if (!jobId) {
      throw new Error("OCR API did not return a job ID");
    }

    // CRITICAL: Construct our own URLs using public API base
    const statusUrl = `${this.baseUrl}/ocr/v1/${jobId}`;
    const jsonUrl = `${this.baseUrl}/ocr/v1/${jobId}/download/json`;

    return {
      jobId,
      status: status as "queued" | "processing" | "pending",
      statusUrl,
      textUrl: jsonUrl,
    };
  }

  async getOCRStatus(statusUrl: string, textUrl?: string): Promise<OCRStatusResponse> {
    if (!statusUrl || statusUrl === "undefined") {
      throw new Error("Invalid status URL provided");
    }

    const response = await fetch(statusUrl, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR status check failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const jobId = result.id || result.jobId || result.job_id;
    const status = result.status || "processing";

    // Fetch extracted text when completed
    let text: string | undefined;
    if (status === "completed" && textUrl) {
      text = await this.fetchExtractedText(textUrl);
    }

    return {
      jobId,
      status,
      text: text || result.text || result.extracted_text,
      pageCount: result.pageCount || result.page_count,
      error: result.error,
    };
  }

  private async fetchExtractedText(textUrl: string): Promise<string | undefined> {
    try {
      const response = await fetch(textUrl, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        console.error("OCR result fetch failed:", response.status);
        return undefined;
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const jsonResult = await response.json();

        // Try common field patterns
        let text = jsonResult.text
          || jsonResult.extracted_text
          || jsonResult.content;

        // Concatenate pages if present
        if (!text && jsonResult.pages && Array.isArray(jsonResult.pages)) {
          text = jsonResult.pages
            .map((page: { text?: string; content?: string }) =>
              page.text || page.content || "")
            .join("\n\n");
        }

        return text;
      }

      // Plain text response
      return await response.text();
    } catch (e) {
      console.error("Failed to fetch OCR result:", e);
      return undefined;
    }
  }
}
```

## Polling Pattern for Job Status

```typescript
const MAX_POLL_ATTEMPTS = 60;  // 5 minutes with 5s intervals
const POLL_INTERVAL = 5000;    // 5 seconds

async function pollOCRUntilComplete(
  client: OCRClient,
  statusUrl: string,
  textUrl: string
): Promise<string> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const status = await client.getOCRStatus(statusUrl, textUrl);

    if (status.status === "completed") {
      if (!status.text) {
        throw new Error("OCR completed but no text returned");
      }
      return status.text;
    }

    if (status.status === "failed") {
      throw new Error(`OCR failed: ${status.error || "Unknown error"}`);
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("OCR job timed out");
}
```

## File Upload with Vercel Blob

Documents must be uploaded to a publicly accessible URL before OCR submission:

```typescript
import { put } from "@vercel/blob";

async function uploadForOCR(file: File): Promise<string> {
  const blob = await put(file.name, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}
```

## Common Issues and Solutions

### Issue 1: "OCR API did not return a job ID"
**Cause:** The response field name varies (`id`, `jobId`, `job_id`)
**Solution:** Check all possible field names:
```typescript
const jobId = result.id || result.jobId || result.job_id;
```

### Issue 2: 404 errors when checking status
**Cause:** Using internal URLs from API response
**Solution:** Construct URLs using public API base URL:
```typescript
const statusUrl = `${baseUrl}/ocr/v1/${jobId}`;
```

### Issue 3: Status shows "completed" but no text
**Cause:** Not using the `/download/json` endpoint
**Solution:** Use the download endpoint for results:
```typescript
const jsonUrl = `${baseUrl}/ocr/v1/${jobId}/download/json`;
```

### Issue 4: Text field is empty in JSON response
**Cause:** Text may be in different fields or in pages array
**Solution:** Check multiple locations:
```typescript
let text = result.text || result.extracted_text || result.content;
if (!text && result.pages) {
  text = result.pages.map(p => p.text || p.content).join("\n\n");
}
```

### Issue 5: Jobs stuck in "processing" forever
**Cause:** Network issues, API errors, or very large documents
**Solution:** Implement timeout and stuck job detection:
```typescript
const MAX_PROCESSING_TIME = 5 * 60 * 1000; // 5 minutes
const startTime = Date.now();

if (Date.now() - startTime > MAX_PROCESSING_TIME) {
  throw new Error("OCR job appears stuck - exceeded max processing time");
}
```

## API Route Example (Next.js)

```typescript
// app/api/ocr/submit/route.ts
import { put } from "@vercel/blob";
import { caseDevClient } from "@/lib/case-dev/client";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const documentId = formData.get("documentId") as string;

  // Upload to Vercel Blob
  const blob = await put(file.name, file, { access: "public" });

  // Submit for OCR
  const result = await caseDevClient.submitOCR(blob.url, file.name);

  return Response.json({
    documentId,
    jobId: result.jobId,
    statusUrl: result.statusUrl,
    textUrl: result.textUrl,
  });
}
```

```typescript
// app/api/ocr/status/route.ts
import { caseDevClient } from "@/lib/case-dev/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusUrl = searchParams.get("statusUrl");
  const textUrl = searchParams.get("textUrl");

  if (!statusUrl) {
    return Response.json({ error: "Missing statusUrl" }, { status: 400 });
  }

  const result = await caseDevClient.getOCRStatus(statusUrl, textUrl || undefined);

  return Response.json(result);
}
```

## Summary of Critical Fixes

1. **Always construct your own URLs** - Don't use URLs from API responses
2. **Use `/ocr/v1/{jobId}` pattern** - Not `/v1/ocr/{jobId}`
3. **Use `/download/json` endpoint** - Required to get extracted text
4. **Handle multiple field names** - `id`/`jobId`/`job_id`, `text`/`extracted_text`/`content`
5. **Check pages array** - Text may be paginated in the response
6. **Implement timeouts** - Jobs can get stuck in processing state
7. **Upload files to public URLs** - Use Vercel Blob or similar service