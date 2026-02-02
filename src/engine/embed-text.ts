export type EmbedTextPreparation = {
  text: string;
  original_chars: number;
  final_chars: number;
  truncated: boolean;
  truncation_reason: string | null;
  was_empty: boolean;
};

export const EMBED_TEXT_NORMALIZATION = "newline_to_lf+trim_trailing";

export const normalizeEmbedText = (value: string): string => {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
};

export const prepareEmbedText = (
  value: string,
  maxChars: number
): EmbedTextPreparation => {
  const normalized = normalizeEmbedText(value);
  const originalChars = normalized.length;
  let text = normalized;
  let truncated = false;
  let truncationReason: string | null = null;

  if (maxChars > 0 && normalized.length > maxChars) {
    text = normalized.slice(0, maxChars);
    truncated = true;
    truncationReason = "max_chars_exceeded";
  }

  const finalChars = text.length;
  const wasEmpty = finalChars === 0;

  return {
    text,
    original_chars: originalChars,
    final_chars: finalChars,
    truncated,
    truncation_reason: truncationReason,
    was_empty: wasEmpty
  };
};
