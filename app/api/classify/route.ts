import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
}

// Evidence categories
const CATEGORIES = [
  'contract',
  'email',
  'photo',
  'handwritten_note',
  'medical_record',
  'financial_document',
  'legal_filing',
  'correspondence',
  'report',
  'other',
] as const;

const CLASSIFICATION_PROMPT = `You are an expert legal document classifier. Analyze the provided document text and classify it into one of the following categories:

Categories:
- contract: Legal contracts, agreements, terms of service, NDAs
- email: Email messages, email threads, email attachments
- photo: Photographs, images (when text extracted via OCR)
- handwritten_note: Handwritten notes, personal notes, memos
- medical_record: Medical records, health documents, prescriptions, lab results
- financial_document: Financial statements, invoices, receipts, bank statements, tax documents
- legal_filing: Court filings, motions, pleadings, legal briefs, judgments
- correspondence: Letters, formal correspondence, memos (non-email)
- report: Reports, analyses, summaries, findings, assessments
- other: Documents that don't fit other categories

Respond with a JSON object containing:
{
  "category": "one of the categories above",
  "confidence": 0.0-1.0 confidence score,
  "suggestedTags": ["array", "of", "relevant", "tags"],
  "summary": "Brief 1-2 sentence summary of the document",
  "dateDetected": "YYYY-MM-DD if a date is mentioned in the document, or null",
  "relevanceScore": 0-100 score indicating potential legal relevance
}

Focus on accuracy. If uncertain, use "other" category with lower confidence.`;

export async function POST(request: NextRequest) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { text, filename, contentType } = body;

    if (!text && !filename) {
      return NextResponse.json(
        { error: 'No text or filename provided' },
        { status: 400 }
      );
    }

    // Auto-classify images as photo category
    if (contentType && contentType.startsWith('image/')) {
      return NextResponse.json({
        success: true,
        classification: {
          category: 'photo',
          confidence: 1.0,
          suggestedTags: ['image', contentType.split('/')[1] || 'photo'],
          summary: `Image file: ${filename}`,
          dateDetected: null,
          relevanceScore: 50,
        },
        tokensUsed: 0,
        cost: 0,
        charsProcessed: 0,
      });
    }

    // Build context for classification
    const documentContext = text
      ? `Filename: ${filename || 'unknown'}\nContent Type: ${contentType || 'unknown'}\n\nDocument Text:\n${text.substring(0, 8000)}`
      : `Filename: ${filename}\nContent Type: ${contentType || 'unknown'}\n\n(No text content available - classify based on filename)`;

    // Call Case.dev LLM API
    const response = await fetch(`${API_BASE_URL}/llm/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash',
        messages: [
          {
            role: 'system',
            content: CLASSIFICATION_PROMPT,
          },
          {
            role: 'user',
            content: documentContext,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Classify] API error: ${response.status} - ${errorText}`);
      throw new Error(`Classification API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No classification response');
    }

    // Parse JSON response
    let classification;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Classify] Failed to parse response:', content);
      // Fallback classification
      classification = {
        category: 'other',
        confidence: 0.5,
        suggestedTags: [],
        summary: 'Document classification failed - manual review recommended',
        dateDetected: null,
        relevanceScore: 50,
      };
    }

    // Validate category
    if (!CATEGORIES.includes(classification.category)) {
      classification.category = 'other';
    }

    // Ensure relevanceScore is in valid range
    classification.relevanceScore = Math.max(0, Math.min(100, classification.relevanceScore || 50));

    // Calculate cost based on character count
    // LLM inference pricing: $0.0005 per 1000 characters
    const costPerThousandChars = 0.0005;
    const charCount = documentContext.length;
    const cost = (charCount / 1000) * costPerThousandChars;

    return NextResponse.json({
      success: true,
      classification: {
        category: classification.category,
        confidence: classification.confidence,
        suggestedTags: classification.suggestedTags || [],
        summary: classification.summary || '',
        dateDetected: classification.dateDetected,
        relevanceScore: classification.relevanceScore,
      },
      tokensUsed: data.usage?.total_tokens || 0,
      cost: cost, // Cost in dollars
      charsProcessed: charCount,
    });
  } catch (error) {
    console.error('[Classify] Error:', error);
    return NextResponse.json(
      { error: 'Classification failed' },
      { status: 500 }
    );
  }
}
