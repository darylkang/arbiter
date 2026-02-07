import { createReadStream, writeFileSync } from "node:fs";
import { renameSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

import { FixedSizeList, Field, Float32, Int32, Table, tableToIPC, vectorFromArray } from "apache-arrow";

import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { writeJsonAtomic } from "../artifacts/io.js";
import { decodeFloat32Base64 } from "../utils/float32-base64.js";

export type EmbeddingJsonlRecord = {
  trial_id: number;
  embedding_status: "success" | "failed" | "skipped";
  vector_b64: string | null;
  generation_id?: string;
  error?: string;
  skip_reason?: string;
  embed_text_sha256?: string;
  embed_text_truncated?: boolean;
  embed_text_original_chars?: number;
  embed_text_final_chars?: number;
  truncation_reason?: string | null;
  dimensions?: number;
  dtype: "float32";
  encoding: "float32le_base64";
};

export interface FinalizeEmbeddingsOptions {
  runDir: string;
  dimensions: number;
  debugJsonlPath?: string;
  provenance?: {
    requestedEmbeddingModel?: string;
    actualEmbeddingModel?: string | null;
    generationIds?: string[];
    embedTextStrategy?: string;
    normalization?: string;
  };
}

export interface FinalizeEmbeddingsResult {
  arrowPath?: string;
  provenance: EmbeddingsProvenance;
}

export const finalizeEmbeddingsToArrow = async (
  options: FinalizeEmbeddingsOptions
): Promise<FinalizeEmbeddingsResult> => {
  const debugJsonlPath = options.debugJsonlPath ??
    resolve(options.runDir, "debug", "embeddings.jsonl");
  const arrowPath = resolve(options.runDir, "embeddings.arrow");
  const arrowTmpPath = `${arrowPath}.tmp`;
  const provenancePath = resolve(options.runDir, "embeddings.provenance.json");

  const successes: Array<{ trial_id: number; vector: number[] }> = [];
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let totalCount = 0;

  try {
    const rl = createInterface({
      input: createReadStream(debugJsonlPath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) {
        continue;
      }
      const record = JSON.parse(line) as EmbeddingJsonlRecord;
      totalCount += 1;

      if (record.embedding_status === "success") {
        if (!record.vector_b64) {
          throw new Error(`Missing vector for trial ${record.trial_id}`);
        }
        const decoded = decodeFloat32Base64(record.vector_b64);
        if (decoded.length !== options.dimensions) {
          throw new Error(
            `Vector length mismatch for trial ${record.trial_id}: expected ${options.dimensions}, got ${decoded.length}`
          );
        }
        if (record.dimensions !== undefined && record.dimensions !== options.dimensions) {
          throw new Error(
            `Declared dimensions mismatch for trial ${record.trial_id}: expected ${options.dimensions}, got ${record.dimensions}`
          );
        }
        successes.push({ trial_id: record.trial_id, vector: decoded });
        successCount += 1;
      } else if (record.embedding_status === "failed") {
        failedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    successes.sort((a, b) => a.trial_id - b.trial_id);
    const trialIds = successes.map((item) => item.trial_id);
    const vectors = successes.map((item) => item.vector);

    const listType = new FixedSizeList(
      options.dimensions,
      new Field("item", new Float32(), false)
    );
    const table = new Table({
      trial_id: vectorFromArray(trialIds, new Int32()),
      vector: vectorFromArray(vectors, listType)
    });

    const ipc = tableToIPC(table, "file");
    writeFileSync(arrowTmpPath, ipc);
    renameSync(arrowTmpPath, arrowPath);

    const provenance: EmbeddingsProvenance = {
      schema_version: "1.0.0",
      status: "arrow_generated",
      intended_primary_format: "arrow_ipc_file",
      primary_format: "arrow",
      dtype: "float32",
      dimensions: options.dimensions,
      requested_embedding_model: options.provenance?.requestedEmbeddingModel,
      actual_embedding_model: options.provenance?.actualEmbeddingModel ?? null,
      generation_ids:
        options.provenance?.generationIds && options.provenance.generationIds.length > 0
          ? options.provenance.generationIds
          : undefined,
      embed_text_strategy: options.provenance?.embedTextStrategy,
      normalization: options.provenance?.normalization,
      counts: {
        total_trials: totalCount,
        successful_embeddings: successCount,
        failed_embeddings: failedCount,
        skipped_embeddings: skippedCount
      },
      debug_jsonl_present: true
    };

    writeJsonAtomic(provenancePath, provenance);
    return { arrowPath, provenance };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const provenance: EmbeddingsProvenance = {
      schema_version: "1.0.0",
      status: "jsonl_fallback",
      intended_primary_format: "arrow_ipc_file",
      primary_format: "jsonl",
      dtype: "float32",
      dimensions: options.dimensions,
      arrow_error: message,
      debug_jsonl_present: true,
      jsonl_encoding: "float32le_base64",
      requested_embedding_model: options.provenance?.requestedEmbeddingModel,
      actual_embedding_model: options.provenance?.actualEmbeddingModel ?? null,
      generation_ids:
        options.provenance?.generationIds && options.provenance.generationIds.length > 0
          ? options.provenance.generationIds
          : undefined,
      embed_text_strategy: options.provenance?.embedTextStrategy,
      normalization: options.provenance?.normalization
    };
    writeJsonAtomic(provenancePath, provenance);
    return { provenance };
  }
};
