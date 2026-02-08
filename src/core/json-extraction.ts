type JsonCandidateParser<T> = (value: unknown) => T | null;

const parseJsonCandidate = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const applyParser = <T>(
  value: unknown,
  parse?: JsonCandidateParser<T>
): T | unknown | null => {
  if (!parse) {
    return value;
  }
  try {
    return parse(value);
  } catch {
    return null;
  }
};

export function extractFencedJson(content: string): unknown | null;
export function extractFencedJson<T>(
  content: string,
  parse: JsonCandidateParser<T>
): T | null;
export function extractFencedJson<T>(
  content: string,
  parse?: JsonCandidateParser<T>
): T | unknown | null {
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content))) {
    const candidate = match[1]?.trim();
    if (!candidate) {
      continue;
    }
    const parsed = parseJsonCandidate(candidate);
    if (parsed === null) {
      continue;
    }
    const parsedWithContract = applyParser(parsed, parse);
    if (parsedWithContract !== null) {
      return parsedWithContract;
    }
  }
  return null;
}

export function extractUnfencedJson(content: string): unknown | null;
export function extractUnfencedJson<T>(
  content: string,
  parse: JsonCandidateParser<T>
): T | null;
export function extractUnfencedJson<T>(
  content: string,
  parse?: JsonCandidateParser<T>
): T | unknown | null {
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] !== "{") {
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaping = false;
    for (let j = i; j < content.length; j += 1) {
      const char = content[j];
      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (char === "\\") {
          escaping = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth !== 0) {
        continue;
      }
      const candidate = content.slice(i, j + 1);
      const parsed = parseJsonCandidate(candidate);
      if (parsed === null) {
        break;
      }
      const parsedWithContract = applyParser(parsed, parse);
      if (parsedWithContract !== null) {
        return parsedWithContract;
      }
      break;
    }
  }
  return null;
}
