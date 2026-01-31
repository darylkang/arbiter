export type EmbeddingJsonlRecord = {
  trial_id: number;
  embedding_status: "success" | "failed" | "skipped";
  vector_b64: string | null;
  error?: {
    message?: string;
    code?: string;
  };
  dtype: "float32";
  encoding: "float32le_base64";
};

export const finalizeEmbeddingsToArrow = async (_jsonlPath: string): Promise<void> => {
  throw new Error("finalizeEmbeddingsToArrow not implemented");
};
