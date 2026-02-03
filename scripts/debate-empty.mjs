import { buildDebateParsedOutput } from "../dist/engine/debate-v1.js";
import { prepareEmbedText } from "../dist/engine/embed-text.js";

const empty = "   ";
const parsed = buildDebateParsedOutput(1, empty);
if (parsed.parse_status !== "failed") {
  throw new Error(`Expected failed parse_status for empty debate content, got ${parsed.parse_status}`);
}
if (parsed.embed_text !== "") {
  throw new Error("Expected empty embed_text for empty debate content");
}
const prep = prepareEmbedText(parsed.embed_text ?? "", 8000);
if (!prep.was_empty) {
  throw new Error("Expected embed_text to be treated as empty for debate failed parse");
}

const raw = "Not JSON but still content.";
const parsedFallback = buildDebateParsedOutput(2, raw);
if (parsedFallback.parse_status !== "fallback") {
  throw new Error(`Expected fallback parse_status for raw debate output, got ${parsedFallback.parse_status}`);
}
if (parsedFallback.embed_text !== raw.trim()) {
  throw new Error("Expected raw embed_text for fallback debate output");
}

console.log("Debate empty-content semantics OK");
