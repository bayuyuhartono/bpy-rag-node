---
name: rag-structure
description: File tree, layer boundaries, and coding conventions for this RAG project (TypeScript, Gemini embeddings, vectra index, Groq LLM). Use before adding, moving, or refactoring any code in src/, when adding a new document loader, LLM/embedding provider, vector store, prompt, or CLI command, or when deciding whether the index must be rebuilt.
---

# RAG project structure

Pipeline: **ingest** (docs → chunks → embeddings → index) then **query** (question → rewrite with chat history → hybrid search (vector + BM25, fused with RRF) → Jina rerank → top-K chunks → prompt → LLM answer).

## File tree

```
data/
├── docs/                 # source documents (.pdf, .txt, .md) — never delete
└── index/index.json      # generated vector index — safe to delete, rebuilt by ingest
src/
├── config.ts             # ALL tunables: paths, chunk size/overlap, topK, candidateK, minScore, models, API keys
├── types.ts              # shared types: ChunkMetadata, RetrievedChunk, RagAnswer, ChatMessage
├── rag.ts                # askDocs(): rewrite query → retrieve → generate; returns data, never prints
├── clients/              # thin wrappers around external APIs, no business logic
│   ├── gemini.ts         # GoogleGenAI instance
│   └── groq.ts           # chatCompletion(messages, temperature) via fetch
├── ingestion/            # phase 1: documents → index
│   ├── loaders.ts        # extension → Loader map (file buffer → text)
│   ├── chunker.ts        # chunkText(): sentence-based, size/overlap from config
│   └── ingest.ts         # ingestFolder(): hash check → load → chunk → embedMany → replaceSource
├── retrieval/            # phase 2a: find relevant chunks
│   ├── embedder.ts       # embed(), embedMany() (batched)
│   ├── vectorStore.ts    # the ONLY file that touches vectra/LocalIndex
│   ├── bm25.ts           # searchBM25() keyword search + reciprocalRankFusion()
│   ├── reranker.ts       # rerankChunks(): Jina cross-encoder via fetch, falls back to input order
│   └── retriever.ts      # retrieve(): vector (candidateK, ≥ minScore) + BM25 → RRF → rerank → topK
├── generation/           # phase 2b: chunks → answer
│   ├── prompts.ts        # prompt templates (pure functions returning strings)
│   └── generator.ts      # rewriteQuery() (standalone question from history), generateAnswer()
└── cli/                  # entry points; the only place that does console I/O
    ├── chat.ts           # npm run chat
    └── ingest.ts         # npm run ingest
```

## Where new code goes

| Change | Put it in |
|---|---|
| New file format (e.g. .docx, .html) | add an entry to the `loaders` map in `ingestion/loaders.ts` |
| New tunable number / model name | `config.ts` — never hardcode in other files |
| New external API (OpenAI, Ollama, …) | new file in `clients/`, then use it from `embedder.ts` or `generator.ts` |
| LLM fallback / provider switching | `generation/generator.ts` |
| Swap embedding model | `retrieval/embedder.ts` + `config.embedding` (requires re-index) |
| Swap vector DB (pgvector, Qdrant, …) | rewrite `retrieval/vectorStore.ts` only, keep its exported functions |
| New prompt or prompt tweak | `generation/prompts.ts` |
| Retrieval pipeline order / stages | `retrieval/retriever.ts` |
| Keyword search or fusion logic | `retrieval/bm25.ts` |
| Reranker provider or fallback | `retrieval/reranker.ts` |
| Query rewriting | `generation/generator.ts` + `generation/prompts.ts` |
| Chat history / multi-turn | `rag.ts` (orchestration) + `prompts.ts` |
| HTTP API / web UI | new entry folder (e.g. `src/server/`) that calls `askDocs()` |
| New npm command | file in `src/cli/` + script in `package.json` |
| New shared type | `types.ts` |

## Layer rules

- Dependencies flow one way: `cli → rag → retrieval/generation → clients/config`. `ingestion` may use `retrieval/embedder` and `retrieval/vectorStore`.
- Only `cli/` uses `console.log` / readline. Library code returns values or throws `Error`.
- Only `vectorStore.ts` imports `vectra`. Only `clients/` imports SDKs or calls `fetch` to an API (exception: `retrieval/reranker.ts` calls Jina directly and may `console.warn` on fallback).
- Read env vars only through `config.keys`. `GEMINI_API_KEY` and `GROQ_API_KEY` are required; `JINA_API_KEY` is optional (no key → no rerank).

## TypeScript conventions

- Runs natively on Node ≥ 23 (type stripping), no build step. Relative imports MUST include the `.ts` extension: `import { x } from './foo.ts'`.
- `erasableSyntaxOnly` is on: no `enum`, no `namespace`, no constructor parameter properties. Use union types and plain objects.
- `verbatimModuleSyntax` is on: type-only imports use `import type { … }`.
- Vectra metadata types must be `type` aliases (not `interface`) with only `string | number | boolean` fields.
- Verify every change with `npm run typecheck`.

## When the index must be rebuilt

Delete `data/index/index.json` then run `npm run ingest` after changing:
- `config.chunk` (size/overlap) or `chunker.ts` logic
- the embedding model or `embedder.ts` behavior
- the shape of `ChunkMetadata`

Changing docs in `data/docs/` does NOT need a manual rebuild — ingest re-indexes changed files by sha256 hash and drops deleted files automatically.

## Commands

- `npm run chat` — sync index, then interactive Q&A with chat memory (shows rewritten query, sources + scores)
- `npm run ingest` — sync index only
- `npm run typecheck` — runs `tsc` (`noEmit` is set in tsconfig.json)
