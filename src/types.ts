// Pakai `type` (bukan interface) supaya kompatibel dengan Record<string, MetadataTypes> milik vectra
export type ChunkMetadata = {
  source: string;
  fileHash: string;
  chunkIndex: number;
  text: string;
};

export type RetrievedChunk = ChunkMetadata & { score: number };

export type RagAnswer =
  | { found: false }
  | { 
    found: true; 
    answer: string; 
    sources: RetrievedChunk[];
    rewrittenQuery: string;
  };
  
  
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
