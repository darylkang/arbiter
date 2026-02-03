import React from "react";
import { Box, Text } from "ink";

import { BrandBanner, FooterHelpBar, Panel, ProgressBar, TrendMiniChart, theme } from "../../ink/kit.js";
import type { RunState } from "../types.js";

export const RunScreen: React.FC<{ runState: RunState; warningHint?: string }> = ({
  runState,
  warningHint
}) => {
  const stopStatus = runState.stopStatus;
  const hasClusters = runState.recentBatches.some((batch) => batch.clusterCount !== undefined);

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Panel title="Run progress">
        <Text color={theme.fg.secondary}>
          Progress: <ProgressBar value={runState.attempted} max={runState.planned || 1} />
        </Text>
        {runState.currentBatch ? (
          <Text color={theme.fg.secondary}>
            Batch {runState.currentBatch.batchNumber}: {runState.currentBatch.completed}/
            {runState.currentBatch.total} complete
          </Text>
        ) : null}
        <Text color={theme.fg.secondary}>Eligible embeddings: {runState.eligible}</Text>
        {runState.recentBatches.length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.fg.tertiary}>Recent batches:</Text>
            {runState.recentBatches.map((batch) => (
              <Text key={batch.batchNumber} color={theme.fg.secondary}>
                Batch {batch.batchNumber}: novelty{" "}
                {batch.noveltyRate === null ? "null" : batch.noveltyRate.toFixed(3)} | mean sim{" "}
                {batch.meanMaxSim === null ? "null" : batch.meanMaxSim.toFixed(3)}
                {batch.clusterCount !== undefined ? ` | groups ${batch.clusterCount}` : ""}
              </Text>
            ))}
            <Text color={theme.fg.tertiary}>Novelty trend:</Text>
            <TrendMiniChart values={runState.noveltyTrend} />
            {hasClusters ? (
              <Text color={theme.fg.tertiary}>
                Embedding groups reflect similarity in the embedding space, not semantic meaning.
              </Text>
            ) : null}
          </Box>
        ) : null}
        {stopStatus ? (
          <Text color={theme.fg.secondary}>
            Sampling:{" "}
            {stopStatus.shouldStop
              ? "stopped due to low novelty"
              : stopStatus.wouldStop
              ? "likely to stop soon"
              : "sampling continues"}
          </Text>
        ) : null}
      </Panel>
      <Panel title="Usage">
        <Text color={theme.fg.secondary}>
          Tokens: in {runState.usage.prompt}, out {runState.usage.completion}, total{" "}
          {runState.usage.total}
        </Text>
        <Text color={theme.fg.tertiary}>Usage tracked; cost shown if provider supplies it.</Text>
      </Panel>
      <FooterHelpBar hints={["Ctrl+C graceful stop", warningHint].filter(Boolean) as string[]} />
    </Box>
  );
};
