import React, { useEffect } from "react";
import { Box, Text, render, useApp } from "ink";

import type { ReceiptModel } from "./receipt-model.js";

const ReceiptView = ({ model }: { model: ReceiptModel }): React.ReactElement => {
  const { exit } = useApp();

  useEffect(() => {
    exit();
  }, [exit]);

  const header = `Run ${model.run_id}`;
  const status = model.stop_reason
    ? `${model.stop_reason}${model.incomplete ? " (incomplete)" : ""}`
    : "unknown";
  const question = model.question ?? "-";
  const protocol = model.protocol ?? "-";
  const models = model.model_summary ?? "-";
  const trials = `planned ${model.counts.k_planned ?? "-"}, attempted ${
    model.counts.k_attempted ?? "-"
  }, eligible ${model.counts.k_eligible ?? "-"}`;
  const embeddings = model.embeddings
    ? `${model.embeddings.status ?? "unknown"} (dims ${model.embeddings.dimensions ?? "-"})`
    : "-";
  const clustering = model.clustering?.enabled
    ? `enabled${model.clustering.cluster_count !== undefined ? ` (${model.clustering.cluster_count} clusters)` : ""}`
    : "disabled";
  const lastBatch = model.convergence
    ? `novelty ${model.convergence.novelty_rate?.toFixed(3) ?? "-"}, mean_sim ${
        model.convergence.mean_max_sim_to_prior?.toFixed(3) ?? "-"
      }`
    : "-";

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true }, header),
    React.createElement(Text, null, `Status: ${status}`),
    React.createElement(Text, null, `Question: ${question}`),
    React.createElement(Text, null, `Protocol: ${protocol}`),
    React.createElement(Text, null, `Models: ${models}`),
    React.createElement(Text, null, `Trials: ${trials}`),
    React.createElement(Text, null, `Embeddings: ${embeddings}`),
    React.createElement(Text, null, `Clustering: ${clustering}`),
    React.createElement(Text, null, `Last batch: ${lastBatch}`),
    React.createElement(Text, null, `Output: ${model.run_dir}`)
  );
};

export const renderReceiptInk = async (model: ReceiptModel): Promise<void> => {
  const { waitUntilExit } = render(React.createElement(ReceiptView, { model }));
  await waitUntilExit();
};
