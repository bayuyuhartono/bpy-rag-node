// Use `type` (not interface) so it is compatible with vectra's Record<string, MetadataTypes>
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
