import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildParsedOutputWithContract } from "../dist/protocols/contract/extraction.js";
import { prepareEmbedText } from "../dist/engine/embed-text.js";

const contract = JSON.parse(
  readFileSync(resolve("contracts/binary_decision_v1.json"), "utf8")
);

const invalidContent = "This is not JSON but is still non-empty.";
const parsedFallback = buildParsedOutputWithContract({
  trialId: 1,
  content: invalidContent,
  contract,
  parserVersion: "contract-test"
});

if (parsedFallback.parse_status !== "fallback") {
  throw new Error(`Expected fallback parse_status, got ${parsedFallback.parse_status}`);
}
if (parsedFallback.embed_text_source !== "raw_content") {
  throw new Error("Expected embed_text_source raw_content for contract fallback");
}
if (!parsedFallback.embed_text || parsedFallback.embed_text !== invalidContent.trim()) {
  throw new Error("Expected embed_text to equal raw content for contract fallback");
}

const prepFallback = prepareEmbedText(parsedFallback.embed_text ?? "", 8000);
if (prepFallback.was_empty) {
  throw new Error("Expected non-empty embed_text for contract fallback");
}

const emptyContent = "   ";
const parsedEmpty = buildParsedOutputWithContract({
  trialId: 2,
  content: emptyContent,
  contract,
  parserVersion: "contract-test"
});

if (parsedEmpty.parse_status !== "failed") {
  throw new Error(`Expected failed parse_status for empty content, got ${parsedEmpty.parse_status}`);
}

const prepEmpty = prepareEmbedText(parsedEmpty.embed_text ?? "", 8000);
if (!prepEmpty.was_empty) {
  throw new Error("Expected empty embed_text to be detected for failed parse");
}

console.log("Contract fallback semantics OK");
