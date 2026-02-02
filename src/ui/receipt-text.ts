import type { ReceiptModel } from "./receipt-model.js";

const formatCount = (value: number | undefined): string =>
  value === undefined ? "-" : String(value);

const formatNumber = (value: number | null | undefined, digits = 3): string =>
  value === undefined || value === null ? "-" : value.toFixed(digits);

export const formatReceiptText = (model: ReceiptModel): string => {
  const lines: string[] = [];

  lines.push("Arbiter Receipt");
  lines.push(`Run ID: ${model.run_id}`);
  if (model.stop_reason) {
    lines.push(`Status: ${model.stop_reason}${model.incomplete ? " (incomplete)" : ""}`);
  }
  if (model.started_at || model.completed_at) {
    lines.push(
      `Time: ${model.started_at ?? "-"} → ${model.completed_at ?? "-"}`
    );
  }

  if (model.question) {
    lines.push(`Question: ${model.question}`);
  }
  if (model.protocol) {
    lines.push(`Protocol: ${model.protocol}`);
  }
  if (model.model_summary) {
    lines.push(`Models: ${model.model_summary}`);
  }

  lines.push(
    `Trials: planned ${formatCount(model.counts.k_planned)}, attempted ${formatCount(
      model.counts.k_attempted
    )}, eligible ${formatCount(model.counts.k_eligible)}`
  );

  if (model.embeddings) {
    const dims = model.embeddings.dimensions ?? "-";
    lines.push(
      `Embeddings: ${model.embeddings.status ?? "unknown"} (dims ${dims})`
    );
  }

  if (model.convergence) {
    const clusterCount = model.convergence.cluster_count;
    const clusterLine = clusterCount !== undefined ? `, clusters ${clusterCount}` : "";
    lines.push(
      `Last batch: novelty_rate ${formatNumber(model.convergence.novelty_rate)}, mean_max_sim ${formatNumber(model.convergence.mean_max_sim_to_prior)}${clusterLine}`
    );
    if (model.convergence.js_divergence !== undefined) {
      const jsd = model.convergence.js_divergence;
      lines.push(`JSD (log2): ${jsd === null ? "null" : jsd.toFixed(4)}`);
    }
  }

  if (model.clustering?.enabled) {
    lines.push(
      `Clustering: enabled${
        model.clustering.cluster_count !== undefined
          ? ` (clusters ${model.clustering.cluster_count})`
          : ""
      }`
    );
  } else {
    lines.push("Clustering: disabled");
  }

  lines.push(`Output: ${model.run_dir}`);

  return `${lines.join("\n")}\n`;
};
