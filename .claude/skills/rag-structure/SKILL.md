---
name: rag-structure
description: File tree, layer boundaries, and coding conventions for this RAG project (TypeScript, Gemini embeddings, vectra index, Groq LLM). Use before adding, moving, or refactoring any code in src/, when adding a new document loader, LLM/embedding provider, vector store, prompt, or CLI command, or when deciding whether the index must be rebuilt.
---

# RAG project structure

Pipeline: **ingest** (docs → chunks → embeddings → index) then **query** (question → embedding → top-K chunks → prompt → LLM answer).

## File tree

```
data/
├── docs/                 # source documents (.pdf, .txt, .md) — never delete
└── index/index.json      # generated vector index — safe to delete, rebuilt by ingest
src/
├── config.ts             # ALL tunables: paths, chunk size/overlap, topK, minScore, models, API keys
├── types.ts              # shared types: ChunkMetadata, RetrievedChunk, RagAnswer
├── rag.ts                # askDocs(): retrieve → generate; returns data, never prints
├── clients/              # thin wrappers around external APIs, no business logic
│   ├── gemini.ts         # GoogleGenAI instance
│   └── groq.ts           # chatCompletion(messages) via fetch
├── ingestion/            # phase 1: documents → index
│   ├── loaders.ts        # extension → Loader map (file buffer → text)
│   ├── chunker.ts        # chunkText(): sentence-based, size/overlap from config
│   └── ingest.ts         # ingestFolder(): hash check → load → chunk → embedMany → replaceSource
├── retrieval/            # phase 2a: find relevant chunks
│   ├── embedder.ts       # embed(), embedMany() (batched)
│   ├── vectorStore.ts    # the ONLY file that touches vectra/LocalIndex
│   └── retriever.ts      # retrieve(): embed question → query topK → filter by minScore
├── generation/           # phase 2b: chunks → answer
│   ├── prompts.ts        # prompt templates (pure functions returning strings)
│   └── generator.ts      # generateAnswer(): build prompt → call LLM client
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
| Reranking, hybrid search, query rewriting | `retrieval/retriever.ts` |
| Chat history / multi-turn | `rag.ts` (orchestration) + `prompts.ts` |
| HTTP API / web UI | new entry folder (e.g. `src/server/`) that calls `askDocs()` |
| New npm command | file in `src/cli/` + script in `package.json` |
| New shared type | `types.ts` |

## Layer rules

- Dependencies flow one way: `cli → rag → retrieval/generation → clients/config`. `ingestion` may use `retrieval/embedder` and `retrieval/vectorStore`.
- Only `cli/` uses `console.log` / readline. Library code returns values or throws `Error`.
- Only `vectorStore.ts` imports `vectra`. Only `clients/` imports SDKs or calls `fetch` to an API.
- Read env vars only through `config.keys`.

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

- `npm run chat` — sync index, then interactive Q&A (shows sources + scores)
- `npm run ingest` — sync index only
- `npm run typecheck` — runs `tsc` (`noEmit` is set in tsconfig.json)
