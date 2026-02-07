export type BatchStopSignal = {
  stop: boolean;
};

export type RunBatchWithWorkersOptions<Entry, Result> = {
  entries: Entry[];
  workerCount: number;
  shouldStop: () => BatchStopSignal;
  execute: (entry: Entry) => Promise<Result>;
};

export const runBatchWithWorkers = async <Entry, Result>(
  options: RunBatchWithWorkersOptions<Entry, Result>
): Promise<Result[]> => {
  const results: Result[] = [];
  let index = 0;
  let inFlight = 0;

  return new Promise((resolve, reject) => {
    const launch = (): void => {
      while (
        inFlight < options.workerCount &&
        index < options.entries.length &&
        !options.shouldStop().stop
      ) {
        const entry = options.entries[index];
        index += 1;
        inFlight += 1;
        options.execute(entry)
          .then((result) => {
            results.push(result);
            inFlight -= 1;
            launch();
          })
          .catch((error) => {
            reject(error);
          });
      }

      if ((index >= options.entries.length || options.shouldStop().stop) && inFlight === 0) {
        resolve(results);
      }
    };

    launch();
  });
};
