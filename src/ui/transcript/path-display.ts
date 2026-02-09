export const compactPath = (value: string, maxWidth = 72): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "-";
  }
  if (trimmed.length <= maxWidth) {
    return trimmed;
  }

  const safeWidth = Math.max(24, maxWidth);
  const head = Math.max(10, Math.floor(safeWidth * 0.45));
  const tail = Math.max(10, safeWidth - head - 1);
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
};
