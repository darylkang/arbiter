export type WelcomeAction = "new" | "learn" | "run-existing" | "analyze" | "help" | "quit";

export type WelcomeOutcome =
  | { kind: "screen"; screen: "question" | "review" | "analyze"; runMode?: "mock" | "live" }
  | { kind: "help" }
  | { kind: "exit" };

export const resolveWelcomeAction = (action: WelcomeAction): WelcomeOutcome => {
  switch (action) {
    case "new":
      return { kind: "screen", screen: "question", runMode: "live" };
    case "learn":
      return { kind: "screen", screen: "question", runMode: "mock" };
    case "run-existing":
      return { kind: "screen", screen: "review", runMode: "live" };
    case "analyze":
      return { kind: "screen", screen: "analyze" };
    case "help":
      return { kind: "help" };
    case "quit":
      return { kind: "exit" };
    default:
      return { kind: "screen", screen: "question", runMode: "live" };
  }
};
