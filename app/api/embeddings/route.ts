import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
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
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Truncate text if too long (max ~8000 tokens for embedding models)
    const truncatedText = text.slice(0, 30000);

    const response = await fetch(`${API_BASE_URL}/llm/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: truncatedText,
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Embeddings] API error:', response.status, error);
      return NextResponse.json(
        { error: `Embeddings API error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Extract the embedding vector
    const embedding = result.data?.[0]?.embedding;

    if (!embedding) {
      return NextResponse.json(
        { error: 'No embedding returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      embedding,
      dimensions: embedding.length,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[Embeddings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create embedding' },
      { status: 500 }
    );
  }
}
