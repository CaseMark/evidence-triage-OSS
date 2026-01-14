import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
}

// Process OCR for images
async function processOCR(apiKey: string, imageBase64: string, contentType: string): Promise<string> {
  // Convert base64 to buffer and upload
  const buffer = Buffer.from(imageBase64, 'base64');

  // Create a temporary upload URL and process
  const response = await fetch(`${API_BASE_URL}/ocr/v1/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_base64: imageBase64,
      content_type: contentType,
    }),
  });

  if (!response.ok) {
    throw new Error(`OCR API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

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

    // Handle different file types
    if (contentType === 'text/plain') {
      // Plain text file - decode directly
      extractedText = buffer.toString('utf-8');
    } else if (contentType === 'application/pdf') {
      // PDF - use OCR API for text extraction
      const base64 = buffer.toString('base64');

      try {
        const response = await fetch(`${API_BASE_URL}/ocr/v1/jobs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_base64: base64,
            content_type: contentType,
            filename: file.name,
          }),
        });

        if (response.ok) {
          const job = await response.json();

          // Poll for completion
          let attempts = 0;
          const maxAttempts = 30;

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusResponse = await fetch(`${API_BASE_URL}/ocr/v1/jobs/${job.id}`, {
              headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            if (statusResponse.ok) {
              const status = await statusResponse.json();

              if (status.status === 'completed') {
                // Get the extracted text
                const textResponse = await fetch(status.links.text, {
                  headers: { 'Authorization': `Bearer ${apiKey}` },
                });

                if (textResponse.ok) {
                  extractedText = await textResponse.text();
                }
                break;
              } else if (status.status === 'failed') {
                console.error('[Extract] OCR job failed');
                break;
              }
            }

            attempts++;
          }
        }
      } catch (ocrError) {
        console.error('[Extract] OCR failed:', ocrError);
      }
    } else if (contentType.startsWith('image/')) {
      // Image - use OCR API
      const base64 = buffer.toString('base64');

      try {
        const response = await fetch(`${API_BASE_URL}/ocr/v1/jobs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_base64: base64,
            content_type: contentType,
            filename: file.name,
          }),
        });

        if (response.ok) {
          const job = await response.json();

          // Poll for completion
          let attempts = 0;
          const maxAttempts = 30;

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusResponse = await fetch(`${API_BASE_URL}/ocr/v1/jobs/${job.id}`, {
              headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            if (statusResponse.ok) {
              const status = await statusResponse.json();

              if (status.status === 'completed') {
                const textResponse = await fetch(status.links.text, {
                  headers: { 'Authorization': `Bearer ${apiKey}` },
                });

                if (textResponse.ok) {
                  extractedText = await textResponse.text();
                }
                break;
              } else if (status.status === 'failed') {
                console.error('[Extract] OCR job failed');
                break;
              }
            }

            attempts++;
          }
        }
      } catch (ocrError) {
        console.error('[Extract] Image OCR failed:', ocrError);
      }
    }

    console.log(`[Extract] Extracted ${extractedText.length} characters from ${file.name}`);

    // Calculate cost based on character count
    // LLM inference pricing: $0.0005 per 1000 characters
    const costPerThousandChars = 0.0005;
    const charCount = extractedText.length;
    const cost = (charCount / 1000) * costPerThousandChars;

    return NextResponse.json({
      success: true,
      text: extractedText,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      cost: cost, // Cost in dollars
      charsProcessed: charCount,
    });
  } catch (error) {
    console.error('[Extract] Error:', error);
    return NextResponse.json(
      { error: 'Text extraction failed' },
      { status: 500 }
    );
  }
}
