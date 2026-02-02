import { prepareEmbedText } from "../dist/engine/embed-text.js";

const input = "Line1\r\nLine2   \r\n";
const maxChars = 6;

const first = prepareEmbedText(input, maxChars);
const second = prepareEmbedText(input, maxChars);

if (JSON.stringify(first) !== JSON.stringify(second)) {
  throw new Error("prepareEmbedText is not deterministic");
}

if (first.text.includes("\r")) {
  throw new Error("Expected newline normalization to remove carriage returns");
}

if (first.text.length !== maxChars) {
  throw new Error(`Expected truncated text length ${maxChars}, got ${first.text.length}`);
}

if (!first.truncated || first.truncation_reason !== "max_chars_exceeded") {
  throw new Error("Expected truncation metadata to be set");
}

if (first.original_chars <= first.final_chars) {
  throw new Error("Expected original_chars > final_chars when truncated");
}

const empty = prepareEmbedText("   \r\n", maxChars);
if (!empty.was_empty) {
  throw new Error("Expected empty embed text after normalization and trim");
}
if (empty.text !== "") {
  throw new Error("Expected empty text after normalization");
}

console.log("Embed text normalization/truncation test OK");
