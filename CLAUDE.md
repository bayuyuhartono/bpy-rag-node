# CLAUDE.md

Local RAG (retrieval-augmented generation) chatbot over documents in `data/docs/`, written in TypeScript and run natively on Node ≥ 23 (no build step).

Stack: Gemini embeddings (`gemini-embedding-001`) · vectra local index · BM25 + RRF hybrid search (optional) · Jina reranker (optional) · Groq LLM (`openai/gpt-oss-20b`).
## Project skills

Skills live in `.claude/skills/`. Load the relevant one before working in its area.

| Skill | Use it when |
|---|---|
| `rag-structure` | Before adding, moving, or refactoring any code in `src/`; adding a document loader, LLM/embedding provider, vector store, prompt, or CLI command; or deciding whether the index must be rebuilt. Contains the file tree, the "where new code goes" table, layer rules, and TypeScript conventions. |

## Commands

- `npm run chat` — sync the index, then start the interactive Q&A CLI
- `npm run ingest` — sync the index only
- `npm run typecheck` — run `tsc` (no emit). Run it after every change.

## Key rules (details in the `rag-structure` skill)

- Relative imports must include the `.ts` extension.
- `erasableSyntaxOnly` + `verbatimModuleSyntax`: no `enum` / `namespace` / parameter properties; use `import type` for types.
- All tunables (chunk size, topK, candidateK, minScore, model names, API keys) live in `src/config.ts`.
- Only `src/cli/` prints to the console; library code returns values or throws.
- Only `retrieval/vectorStore.ts` imports `vectra`; only `clients/` (and `retrieval/reranker.ts`) call external APIs.
- Changing chunking, the embedding model, or `ChunkMetadata` requires deleting `data/index/` and re-running ingest.

## Language

Code comments, logs, and error messages are in English. LLM prompt templates in `src/generation/prompts.ts` are intentionally in Indonesian (the answers are expected in Indonesian).
