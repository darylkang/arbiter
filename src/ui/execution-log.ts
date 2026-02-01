import { createWriteStream } from "node:fs";

import type { EventBus } from "../events/event-bus.js";

export class ExecutionLogger {
  private stream: ReturnType<typeof createWriteStream> | null;
  private unsubs: Array<() => void> = [];

  constructor(private readonly logPath: string) {
    this.stream = createWriteStream(logPath, { flags: "a" });
  }

  private append(line: string): void {
    if (!this.stream) {
      return;
    }
    this.stream.write(`${new Date().toISOString()} ${line}\n`);
  }

  attach(bus: EventBus): void {
    this.unsubs.push(
      bus.subscribe("run.started", (payload) => {
        const question = payload.resolved_config.question?.text ?? "";
        const protocol = payload.resolved_config.protocol?.type ?? "unknown";
        const kMax = payload.resolved_config.execution.k_max;
        const batchSize = payload.resolved_config.execution.batch_size;
        const workers = payload.resolved_config.execution.workers;
        const models = payload.resolved_config.sampling.models
          .map((model) => model.model)
          .join(", ");
        this.append(`Run started: ${payload.run_id}`);
        this.append(`Question: ${question}`);
        this.append(
          `Protocol: ${protocol} | trials ${kMax} | batch ${batchSize} | workers ${workers}`
        );
        this.append(`Models: ${models}`);
      })
    );

    this.unsubs.push(
      bus.subscribe("batch.completed", (payload) => {
        this.append(
          `Batch ${payload.batch_number} complete: ${payload.trial_ids.length} trials, ${payload.elapsed_ms}ms`
        );
      })
    );

    this.unsubs.push(
      bus.subscribe("trial.completed", (payload) => {
        const status = payload.trial_record.status;
        if (status !== "success") {
          this.append(`Trial ${payload.trial_record.trial_id} status: ${status}`);
        }
      })
    );

    this.unsubs.push(
      bus.subscribe("run.completed", (payload) => {
        this.append(`Run completed: ${payload.run_id} (${payload.stop_reason})`);
      })
    );

    this.unsubs.push(
      bus.subscribe("run.failed", (payload) => {
        this.append(`Run failed: ${payload.run_id} (${payload.error})`);
      })
    );
  }

  async close(): Promise<void> {
    if (!this.stream) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.stream?.end(() => resolve());
      this.stream?.on("error", (error) => reject(error));
    });
    this.stream = null;
  }

  detach(): void {
    this.unsubs.forEach((unsubscribe) => unsubscribe());
    this.unsubs = [];
  }
}
