# Evidence Triage

An open-source legal document management application built with [Case.dev](https://case.dev) and Next.js. Upload, organize, and search legal evidence with AI-powered classification and semantic search.

## Features

- **Document Upload**: Upload PDFs, images, and text files with automatic OCR processing
- **AI Classification**: Documents are automatically categorized (contracts, emails, medical records, etc.) with suggested tags and relevance scores
- **Semantic Search**: Find documents by meaning, not just keywords, using hybrid vector + BM25 search
- **Persistent Storage**: Documents and metadata persist across sessions via Case.dev Vaults and Database
- **Multiple Views**: Gallery, list, and timeline views for organizing evidence

## Case.dev Primitives Used

This application demonstrates three core Case.dev services:

| Service | Purpose |
|---------|---------|
| **Vaults** | Document storage with automatic OCR, text extraction, and vector indexing for semantic search |
| **Database** | Neon PostgreSQL for persistent metadata storage (tags, categories, summaries) |
| **LLM** | AI-powered document classification and summarization |

## Getting Started

### 1. Get a Case.dev API Key

Sign up at [console.case.dev](https://console.case.dev) and create an API key.

### 2. Clone and Install

```bash
git clone https://github.com/CaseMark/evidence-triage-OSS.git
cd evidence-triage-OSS
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Add your Case.dev API key to `.env.local`:

```env
CASE_API_KEY=sk_case_...
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your API key to connect.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
├─────────────────────────────────────────────────────────────────┤
│  Upload → Classify → Display    │    Search → Filter → Display  │
└─────────────────┬───────────────┴──────────────┬────────────────┘
                  │                              │
                  ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Routes (Server-Side)                     │
│  /api/vault/*  │  /api/database/*  │  /api/classify             │
└────────┬───────┴────────┬──────────┴────────┬───────────────────┘
         │                │                   │
         ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Case.dev API                              │
│  Vaults (Storage/OCR/Search)  │  Database (Neon)  │  LLM        │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
app/
├── api/
│   ├── vault/          # Vault operations (upload, search, delete)
│   ├── database/       # Metadata CRUD operations
│   └── classify/       # Document classification
├── page.tsx            # Main application UI
lib/
├── case-dev/
│   ├── client.ts       # Case.dev API client
│   └── evidence-db.ts  # Database operations
├── evidence-service.ts # Core business logic
└── types/              # TypeScript definitions
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS + Shadcn UI
- **Icons**: Phosphor Icons
- **Database**: Neon PostgreSQL (via Case.dev)
- **Storage**: Case.dev Vaults
- **AI**: Case.dev LLM API

## License

[Apache 2.0](LICENSE)
