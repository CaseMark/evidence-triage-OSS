import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This is a simple semantic search endpoint that uses the LLM to find relevant matches
// In a full implementation, this would use vector embeddings for semantic search

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
}

const SEARCH_PROMPT = `You are a search relevance expert. Given a search query and a list of document summaries, rank them by relevance to the query.

For each document, provide a relevance score from 0-100 where:
- 100 = Exactly matches the query
- 70-99 = Highly relevant
- 40-69 = Somewhat relevant
- 1-39 = Marginally relevant
- 0 = Not relevant

Respond with a JSON array of objects with "id" and "score" properties, sorted by score descending.
Only include documents with score > 0.`;

interface DocumentSummary {
  id: string;
  filename: string;
  summary: string;
  category: string;
  tags: string[];
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
    const { query, documents } = body as { query: string; documents: DocumentSummary[] };

    if (!query || !documents || !Array.isArray(documents)) {
      return NextResponse.json(
        { error: 'Query and documents array required' },
        { status: 400 }
      );
    }

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    console.log(`[Search] Searching ${documents.length} documents for: "${query}"`);

    // Build document list for LLM
    const documentList = documents.map((doc, index) =>
      `${index + 1}. ID: ${doc.id}\n   Filename: ${doc.filename}\n   Category: ${doc.category}\n   Tags: ${doc.tags.join(', ')}\n   Summary: ${doc.summary || 'No summary'}`
    ).join('\n\n');

    // Call LLM for semantic search ranking
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
            content: SEARCH_PROMPT,
          },
          {
            role: 'user',
            content: `Search Query: "${query}"\n\nDocuments:\n${documentList}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Search] API error: ${response.status} - ${errorText}`);
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No search response');
    }

    // Parse JSON response
    let results: { id: string; score: number }[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[Search] Failed to parse response:', content);
      // Fallback to basic text matching
      const queryLower = query.toLowerCase();
      results = documents
        .map(doc => {
          let score = 0;
          if (doc.filename.toLowerCase().includes(queryLower)) score += 50;
          if (doc.summary?.toLowerCase().includes(queryLower)) score += 30;
          if (doc.tags.some(t => t.toLowerCase().includes(queryLower))) score += 20;
          return { id: doc.id, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score);
    }

    console.log(`[Search] Found ${results.length} relevant documents`);

    // Calculate cost based on character count
    // LLM inference pricing: $0.0005 per 1000 characters
    const costPerThousandChars = 0.0005;
    const charCount = `Search Query: "${query}"\n\nDocuments:\n${documentList}`.length;
    const cost = (charCount / 1000) * costPerThousandChars;

    return NextResponse.json({
      success: true,
      results,
      tokensUsed: data.usage?.total_tokens || 0,
      cost: cost, // Cost in dollars
      charsProcessed: charCount,
    });
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
