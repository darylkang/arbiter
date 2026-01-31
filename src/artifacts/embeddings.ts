import { createReadStream, writeFileSync } from "node:fs";
import { renameSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

import { FixedSizeList, Field, Float32, Int32, Table, tableToIPC, vectorFromArray } from "apache-arrow";

import type { EmbeddingsProvenance } from "./embeddings-provenance.js";
import { writeJsonAtomic } from "./io.js";

export type EmbeddingJsonlRecord = {
  trial_id: number;
  embedding_status: "success" | "failed" | "skipped";
  vector_b64: string | null;
  error?: string;
  embed_text_sha256?: string;
  dtype: "float32";
  encoding: "float32le_base64";
};

export interface FinalizeEmbeddingsOptions {
  runDir: string;
  dimensions: number;
  debugJsonlPath?: string;
}

export interface FinalizeEmbeddingsResult {
  arrowPath?: string;
  provenance: EmbeddingsProvenance;
}

const decodeFloat32 = (base64: string): Float32Array => {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength % 4 !== 0) {
    throw new Error("Embedding byte length is not divisible by 4");
  }
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
};

export const finalizeEmbeddingsToArrow = async (
  options: FinalizeEmbeddingsOptions
): Promise<FinalizeEmbeddingsResult> => {
  const debugJsonlPath = options.debugJsonlPath ??
    resolve(options.runDir, "debug", "embeddings.jsonl");
  const arrowPath = resolve(options.runDir, "embeddings.arrow");
  const arrowTmpPath = `${arrowPath}.tmp`;
  const provenancePath = resolve(options.runDir, "embeddings.provenance.json");

  const trialIds: number[] = [];
  const vectors: number[][] = [];
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
        const decoded = decodeFloat32(record.vector_b64);
        if (decoded.length !== options.dimensions) {
          throw new Error(
            `Vector length mismatch for trial ${record.trial_id}: expected ${options.dimensions}, got ${decoded.length}`
          );
        }
        trialIds.push(record.trial_id);
        vectors.push(Array.from(decoded));
        successCount += 1;
      } else if (record.embedding_status === "failed") {
        failedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

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
      status: "arrow_generated",
      intended_primary_format: "arrow_ipc_file",
      primary_format: "arrow",
      dtype: "float32",
      dimensions: options.dimensions,
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
      status: "jsonl_fallback",
      intended_primary_format: "arrow_ipc_file",
      primary_format: "jsonl",
      dtype: "float32",
      dimensions: options.dimensions,
      arrow_error: message,
      debug_jsonl_present: true
    };
    writeJsonAtomic(provenancePath, provenance);
    return { provenance };
  }
};
