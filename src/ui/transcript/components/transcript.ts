import { type Component, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

import type { TranscriptEntry } from "../state.js";
import { styleEntryPrefix } from "../theme.js";

const MAX_RENDERED_ENTRIES = 300;

const KIND_TAG: Record<TranscriptEntry["kind"], string> = {
  system: "sys",
  user: "you",
  status: "ops",
  progress: "run",
  warning: "warn",
  error: "err",
  report: "report",
  verify: "verify",
  receipt: "receipt"
};

export class TranscriptComponent implements Component {
  private entries: TranscriptEntry[] = [];

  setEntries(entries: TranscriptEntry[]): void {
    this.entries = entries;
  }

  invalidate(): void {
    // no cached render state
  }

  render(width: number): string[] {
    const safeWidth = Math.max(24, width);

    if (this.entries.length === 0) {
      return ["", "[system] type /new to begin, /help for commands.", ""];
    }

    const lines: string[] = [];
    const entries = this.entries.slice(-MAX_RENDERED_ENTRIES);
    const hiddenEntries = this.entries.length - entries.length;
    if (hiddenEntries > 0) {
      lines.push(`[system] ... ${hiddenEntries} earlier transcript entries hidden ...`);
      lines.push("");
    }

    for (const entry of entries) {
      const tag = KIND_TAG[entry.kind] ?? "log";
      const prefix = `${styleEntryPrefix(entry.kind, entry.timestamp)} ${tag}> `;
      const prefixWidth = visibleWidth(prefix);
      const contentWidth = Math.max(8, safeWidth - prefixWidth);
      const rawLines = entry.content.split("\n");

      rawLines.forEach((rawLine, rawIndex) => {
        const wrapped = wrapTextWithAnsi(rawLine || " ", contentWidth);
        wrapped.forEach((segment, segmentIndex) => {
          const usePrefix = rawIndex === 0 && segmentIndex === 0;
          if (usePrefix) {
            lines.push(`${prefix}${segment}`);
          } else {
            lines.push(`${" ".repeat(prefixWidth)}${segment}`);
          }
        });
      });
    }

    return lines;
  }
}
