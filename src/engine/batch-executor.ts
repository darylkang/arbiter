export type BatchStopSignal = {
  stop: boolean;
};

export type RunBatchWithWorkersOptions<Entry, Result> = {
  entries: Entry[];
  workerCount: number;
  shouldStop: () => BatchStopSignal;
  execute: (entry: Entry) => Promise<Result>;
  onWorkerStatus?: (input: {
    workerId: number;
    status: "busy" | "idle";
    entry: Entry;
    result?: Result;
    error?: unknown;
  }) => void;
};

/**
 * Executes entries with bounded concurrency.
 *
 * Results are returned in completion order, not input order.
 */
export const runBatchWithWorkers = async <Entry, Result>(
  options: RunBatchWithWorkersOptions<Entry, Result>
): Promise<Result[]> => {
  const normalizedWorkerCount = Math.floor(options.workerCount);
  if (!Number.isFinite(normalizedWorkerCount) || normalizedWorkerCount < 1) {
    throw new Error(`workerCount must be >= 1, got ${options.workerCount}`);
  }

  const results: Result[] = [];
  const availableWorkers = Array.from({ length: normalizedWorkerCount }, (_, index) => index + 1);
  let index = 0;
  let inFlight = 0;
  let settled = false;
  let firstError: unknown;

  return new Promise((resolve, reject) => {
    const launch = (): void => {
      if (settled) {
        return;
      }
      while (
        inFlight < normalizedWorkerCount &&
        index < options.entries.length &&
        !firstError &&
        !options.shouldStop().stop &&
        availableWorkers.length > 0
      ) {
        const entry = options.entries[index];
        const workerId = availableWorkers.shift() ?? normalizedWorkerCount;
        index += 1;
        inFlight += 1;
        options.onWorkerStatus?.({
          workerId,
          status: "busy",
          entry
        });
        options.execute(entry)
          .then((result) => {
            if (settled) {
              return;
            }
            results.push(result);
            inFlight -= 1;
            availableWorkers.push(workerId);
            options.onWorkerStatus?.({
              workerId,
              status: "idle",
              entry,
              result
            });
            launch();
          })
          .catch((error) => {
            inFlight -= 1;
            availableWorkers.push(workerId);
            options.onWorkerStatus?.({
              workerId,
              status: "idle",
              entry,
              error
            });
            if (!firstError) {
              firstError = error;
            }
            if (inFlight === 0) {
              settled = true;
              reject(firstError);
              return;
            }
            launch();
          });
      }

      if (firstError && inFlight === 0) {
        settled = true;
        reject(firstError);
        return;
      }
      if ((index >= options.entries.length || options.shouldStop().stop) && inFlight === 0) {
        settled = true;
        resolve(results);
      }
    };

    launch();
  });
};
