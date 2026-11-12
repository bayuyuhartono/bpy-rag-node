# bpy-rag-node

A small, dependency-light **Retrieval-Augmented Generation (RAG)** chatbot that answers questions about your own documents from the terminal.

Drop PDF, TXT, or Markdown files into `data/docs/`, run one command, and ask questions. Answers are grounded only in your documents and come with the source chunks used.

- **Embeddings:** Google Gemini `gemini-embedding-001`
- **Vector store:** [vectra](https://github.com/Stevenic/vectra) (local, file-based JSON index, no server)
- **Retrieval:** vector search, plus optional BM25 keyword search merged with Reciprocal Rank Fusion
- **Reranking (optional):** Jina `jina-reranker-v2-base-multilingual` cross-encoder
- **LLM:** Groq `openai/gpt-oss-20b`
- **Runtime:** TypeScript run natively on Node ≥ 23 (type stripping, no build step)

---

## How it works

```
                ┌──────────────────────── INGEST ────────────────────────┐
data/docs/*  ─▶ │ load (pdf/txt/md) ─▶ sha256 check ─▶ chunk ─▶ embed     │ ─▶ data/index/index.json
                └────────────────────────────────────────────────────────┘

                ┌──────────────────────── QUERY ─────────────────────────┐
question ─────▶ │ rewrite with chat history (if any)                     │
                │        │                                               │
                │        ▼                                               │
                │ Stage 1  vector search (candidateK, ≥ minScore)        │
                │          + BM25 keyword search (candidateK) [optional] │
                │          ─▶ Reciprocal Rank Fusion                     │
                │        │                                               │
                │        ▼                                               │
                │ Stage 2  Jina reranker [optional] ─▶ top-K chunks      │
                │        │                                               │
                │        ▼                                               │
                │ prompt + chunks ─▶ Groq LLM ─▶ answer + sources        │
                └────────────────────────────────────────────────────────┘
```

### 1. Ingestion (`src/ingestion/`)

1. **Load** each supported file in `data/docs/` (`loaders.ts`). PDFs are parsed with `pdf-parse`; `.txt` and `.md` are read as UTF-8.
2. **Change detection** (`ingest.ts`): each file's sha256 hash is stored in the chunk metadata. Unchanged files are skipped, changed files are re-indexed, and files removed from `data/docs/` have their chunks dropped from the index.
3. **Chunking** (`chunker.ts`): text is split into sentences, then sentences are merged up to `chunk.size` characters. Overlap is made of whole trailing sentences (up to `chunk.overlap` characters), so no sentence is cut in half. Very long "sentences" (e.g. PDF tables) are force-split.
4. **Embedding** (`retrieval/embedder.ts`): chunks are embedded with Gemini in batches of `embedding.batchSize`.
5. **Storage** (`retrieval/vectorStore.ts`): all chunks of a file are replaced in a single vectra update.

Ingestion runs automatically every time you start the chat, so the index always matches `data/docs/`.

### 2. Query (`src/rag.ts`)

1. **Query rewriting** (`generation/generator.ts`): when there is chat history, the LLM rewrites the latest question into a standalone question (resolving pronouns like "he", "it", "that") using the last two Q&A pairs. The rewritten query is shown in grey in the CLI.
2. **Retrieval, stage 1** (`retrieval/retriever.ts`):
   - Vector search returns `candidateK` nearest chunks; results below `minScore` (cosine similarity) are dropped.
   - *(optional)* BM25 keyword search runs alongside and the two lists are merged with Reciprocal Rank Fusion. See [Optional retrieval stages](#optional-retrieval-stages).
3. **Retrieval, stage 2** *(optional)*: the Jina reranker re-scores the candidates and keeps the top `topK`. See below.
4. **Generation** (`generation/prompts.ts` + `generator.ts`): the top chunks are placed into a prompt that tells the LLM to answer briefly (2–3 sentences) **only** from the given context, and to say the information was not found otherwise.

### Optional retrieval stages

Vector search is the only required retrieval step. BM25 and the reranker are add-ons that improve result quality. Both are **on by default**. The pipeline works without either of them, so you can remove them if you don't need them.

#### BM25 keyword search

**What it does:** BM25 (`retrieval/bm25.ts`) is a classic keyword-ranking algorithm. It scores each chunk by how often the question's words appear in it (`k1 = 1.5`). Rare words count more than common ones (IDF), and long chunks are normalised (`b = 0.75`) so they don't win just by being long. Its top `candidateK` results are merged with the vector results using **Reciprocal Rank Fusion** (`k = 60`). RRF scores each chunk by its rank in each list, so chunks found by both methods rise to the top.

**Why it helps:** embeddings capture *meaning* but often blur *exact terms*. BM25 catches what vector search misses: player names, numbers, years, product codes, acronyms, rare words.

**Without it:** only vector search is used. It is slightly faster, since there is no full scan of all chunks per query, but exact-term questions may get weaker results. To drop it, change `retrieve()` in [`src/retrieval/retriever.ts`](src/retrieval/retriever.ts) to pass `vectorResults` straight to the next stage instead of the RRF-fused list.

#### Jina reranker

**What it does:** the reranker (`retrieval/reranker.ts`) sends the question and all stage-1 candidates to Jina's cross-encoder model. A cross-encoder reads the question and each chunk **together**, rather than comparing two separate vectors, so it judges relevance much more precisely. It returns a new 0–1 relevance score for each chunk, and the best `topK` are kept.

**Why it helps:** stage 1 is tuned to *find* plausible candidates quickly (recall). The reranker *picks the best ones* (precision), so the 3 chunks sent to the LLM are the most relevant, not just the closest by vector distance.

**Without it:** the stage-1 order is cut to `topK` directly. That means no extra API call, lower latency, and no Jina key needed, but the final ranking is less precise. The reranker is skipped when:
- `JINA_API_KEY` is not set in `.env`
- the Jina API call fails (a warning is printed and the stage-1 order is used)
- you switch to the commented-out `return fusedCandidates.slice(...)` line in [`src/retrieval/retriever.ts`](src/retrieval/retriever.ts) instead of the `rerankChunks` return

#### Combinations

| BM25 | Reranker | Pipeline | Shown score |
|---|---|---|---|
| ✅ | ✅ | vector + BM25 → RRF → rerank *(default)* | Jina relevance (0–1) |
| ✅ | ❌ | vector + BM25 → RRF | cosine similarity (0.7 for BM25-only hits) |
| ❌ | ✅ | vector → rerank | Jina relevance (0–1) |
| ❌ | ❌ | vector only (fastest, simplest) | cosine similarity |

---

## Requirements

- **Node.js ≥ 23.6** (runs `.ts` files directly through built-in type stripping)
- API keys:
  | Variable | Used for | Get one at |
  |---|---|---|
  | `GEMINI_API_KEY` | Embeddings | https://aistudio.google.com/apikey |
  | `GROQ_API_KEY` | Query rewriting and answer generation | https://console.groq.com/keys |
  | `JINA_API_KEY` | Reranking (optional — without it the RRF order is used) | https://jina.ai/reranker |

## Setup

```bash
npm install
cp .env.example .env     # fill in GEMINI_API_KEY and GROQ_API_KEY (JINA_API_KEY is optional)
```

Put your documents in `data/docs/` (supported: `.pdf`, `.txt`, `.md`).

## Usage

```bash
npm run chat        # sync the index, then start interactive Q&A
npm run ingest      # sync the index only
npm run typecheck   # type-check the project with tsc (no emit)
```

Inside the chat:

| Input | Effect |
|---|---|
| any question | ask about your documents |
| `reset` | clear the conversation memory |
| `exit` | quit |

Example session:

```
Document index is up to date (42 chunks).

🤖 Document chatbot ready! (Type 'reset' to clear memory, 'exit' to quit)

You: Who is the club's top scorer?
AI: ...
   Sources: chelsea_file.pdf #12 (0.91), chelsea_file.pdf #13 (0.74), chelsea_file.pdf #3 (0.52)

You: How many goals did he score?
[Query Rewrite]: "How many goals did the club's top scorer score?"
AI: ...
```

Each source is shown as `file #chunkIndex (score)`. With reranking on, the score is the Jina relevance score.

---

## Configuration

All tunables live in [`src/config.ts`](src/config.ts):

| Key | Default | Meaning |
|---|---|---|
| `paths.docs` | `data/docs` | Folder of source documents |
| `paths.index` | `data/index` | Folder of the generated vectra index |
| `chunk.size` | `500` | Max characters per chunk |
| `chunk.overlap` | `100` | Max characters of trailing sentences carried into the next chunk |
| `retrieval.candidateK` | `10` | Candidates taken from each of vector search and BM25 before fusion |
| `retrieval.minScore` | `0.65` | Minimum cosine similarity for a vector result |
| `retrieval.topK` | `3` | Chunks passed to the LLM after reranking |
| `embedding.model` | `gemini-embedding-001` | Embedding model |
| `embedding.batchSize` | `50` | Chunks per embedding request |
| `llm.model` | `openai/gpt-oss-20b` | Groq chat model |
| `llm.temperature` | `0.2` | Sampling temperature |
| `rerank.model` | `jina-reranker-v2-base-multilingual` | Jina reranker model |

### When to rebuild the index

Editing, adding, or removing files in `data/docs/` never needs a manual rebuild. Delete `data/index/` and run `npm run ingest` only after changing:

- `chunk.size` / `chunk.overlap` or the chunking logic
- the embedding model or embedder behaviour
- the shape of `ChunkMetadata` in `src/types.ts`

---

## Project structure

```
data/
├── docs/                    # your source documents (.pdf, .txt, .md)
└── index/                   # generated vectra index (git-ignored, safe to delete)
src/
├── config.ts                # all tunables, paths, model names, API keys
├── types.ts                 # ChunkMetadata, RetrievedChunk, RagAnswer, ChatMessage
├── rag.ts                   # askDocs(): rewrite → retrieve → generate (no console output)
├── clients/
│   ├── gemini.ts            # GoogleGenAI instance
│   └── groq.ts              # chatCompletion() via fetch
├── ingestion/
│   ├── loaders.ts           # file extension → text loader
│   ├── chunker.ts           # sentence-based chunking with overlap
│   └── ingest.ts            # ingestFolder(): sync data/docs with the index
├── retrieval/
│   ├── embedder.ts          # embed(), embedMany()
│   ├── vectorStore.ts       # the only file that touches vectra
│   ├── bm25.ts              # BM25 keyword search + Reciprocal Rank Fusion
│   ├── reranker.ts          # Jina reranker with fallback
│   └── retriever.ts         # retrieve(): hybrid search → rerank
├── generation/
│   ├── prompts.ts           # prompt templates (pure functions)
│   └── generator.ts         # rewriteQuery(), generateAnswer()
└── cli/
    ├── chat.ts              # npm run chat
    └── ingest.ts            # npm run ingest
```

Dependencies flow one way: `cli → rag → retrieval / generation → clients / config`. Only `cli/` prints to the console, so `askDocs()` can be reused from an HTTP server or another UI.

### Extending

| To add… | Change |
|---|---|
| a new file format (e.g. `.docx`) | add a loader to the map in `ingestion/loaders.ts` |
| another LLM or embedding provider | new file in `clients/`, used from `generator.ts` / `embedder.ts` |
| a different vector DB | rewrite `retrieval/vectorStore.ts`, keeping its exported functions |
| an HTTP API or web UI | new folder such as `src/server/` that calls `askDocs()` |

## Notes

- Prompt templates are written in Indonesian, so answers come back in Indonesian. Edit `src/generation/prompts.ts` to change the answer language.
- The vectra index is a single JSON file loaded into memory and BM25 scans every chunk per query. That is fine for hundreds to a few thousand chunks; for larger corpora, swap in a real vector DB and keyword index.
