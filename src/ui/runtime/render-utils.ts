import type { Formatter } from "../fmt.js";
import type { RenderTone } from "../runtime-view-models.js";

const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export const stripAnsi = (value: string): string =>
  value.replace(ANSI_CSI_REGEX, "").replace(/\r/g, "");

export const formatClockHMS = (inputMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(inputMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

export const renderToneLine = (text: string, tone: RenderTone | undefined, fmt: Formatter): string => {
  if (tone === "warn") {
    return fmt.warn(text);
  }
  if (tone === "error") {
    return fmt.error(text);
  }
  if (tone === "success") {
    return fmt.success(text);
  }
  if (tone === "info") {
    return fmt.info(text);
  }
  if (tone === "text") {
    return fmt.text(text);
  }
  return fmt.muted(text);
};
