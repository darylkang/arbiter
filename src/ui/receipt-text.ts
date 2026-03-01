import type { ReceiptModel } from "./receipt-model.js";

const formatCount = (value: number | undefined): string => (value === undefined ? "-" : String(value));

const formatStopBanner = (reason?: string): string => {
  switch (reason) {
    case "converged":
      return "Stopped: novelty saturation";
    case "k_max_reached":
      return "Stopped: max trials reached";
    case "user_interrupt":
      return "Stopped: user requested graceful stop";
    case "completed":
      return "Stopped: sampling complete";
    default:
      return "Stopped: run failed";
  }
};

export const formatReceiptText = (model: ReceiptModel): string => {
  const lines: string[] = [];

  lines.push(formatStopBanner(model.stop_reason));
  lines.push("Stopping indicates diminishing novelty, not correctness.");
  lines.push("");

  lines.push("Summary:");
  lines.push(`- run id: ${model.run_id}`);
  lines.push(`- stop reason: ${model.stop_reason ?? "unknown"}${model.incomplete ? " (incomplete)" : ""}`);
  lines.push(
    `- trials planned/completed/eligible: ${formatCount(model.counts.k_planned)}/${formatCount(model.counts.k_attempted)}/${formatCount(model.counts.k_eligible)}`
  );
  lines.push(`- protocol: ${model.protocol ?? "-"}`);
  lines.push(`- models/personas: ${model.model_count}/${model.persona_count}`);
  if (model.started_at || model.completed_at) {
    lines.push(`- time: ${model.started_at ?? "-"} -> ${model.completed_at ?? "-"}`);
  }

  if (model.usage) {
    const totals = model.usage.totals;
    lines.push(
      `- usage tokens: in ${totals.prompt_tokens}, out ${totals.completion_tokens}, total ${totals.total_tokens}`
    );
  } else {
    lines.push("- usage tokens: not available");
  }

  if (model.grouping?.enabled) {
    lines.push(`- embedding groups: ${model.grouping.group_count ?? model.monitoring?.group_count ?? "-"}`);
    lines.push("- groups reflect embedding similarity, not semantic categories.");
  }

  if ((model.counts.k_eligible ?? 0) === 0) {
    lines.push("- embeddings: none written because zero eligible trials were produced");
  }

  lines.push("");
  lines.push("Artifacts:");
  const artifacts = model.artifacts ?? [];
  if (artifacts.length === 0) {
    lines.push("- (no artifacts listed)");
  } else {
    for (const artifact of artifacts) {
      lines.push(`- ${artifact.path}`);
    }
  }

  lines.push("");
  lines.push(`Reproduce: arbiter run --config ${model.run_dir}/config.resolved.json`);

  return `${lines.join("\n")}\n`;
};
