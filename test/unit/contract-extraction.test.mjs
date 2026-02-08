import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContractValidator,
  buildParsedOutputWithContract,
  extractContractOutput,
  formatDecisionContractClause
} from "../../dist/protocols/contract/extraction.js";

const contract = {
  id: "binary_decision_v1",
  schema: {
    type: "object",
    required: ["decision", "rationale"],
    properties: {
      decision: { type: "string" },
      rationale: { type: "string" }
    }
  },
  embed_text_source: "rationale",
  rationale_max_chars: 16
};

test("extractContractOutput handles fenced and unfenced JSON", () => {
  const validate = buildContractValidator(contract.schema);
  const fenced = extractContractOutput(
    "```json\n{\"decision\":\"yes\",\"rationale\":\"fenced rationale\"}\n```",
    contract,
    validate
  );
  const unfenced = extractContractOutput(
    "noise {\"decision\":\"no\",\"rationale\":\"plain rationale\"}",
    contract,
    validate
  );

  assert.equal(fenced.parse_status, "success");
  assert.equal(unfenced.parse_status, "success");
  assert.equal(fenced.embed_text, "fenced rationale");
  assert.equal(unfenced.embed_text, "plain rationale");
});

test("buildParsedOutputWithContract maps invalid payload to fallback", () => {
  const parsed = buildParsedOutputWithContract({
    trialId: 7,
    content: "no valid contract output",
    contract,
    parserVersion: "test"
  });

  assert.equal(parsed.trial_id, 7);
  assert.equal(parsed.parse_status, "fallback");
  assert.equal(parsed.embed_text, "no valid contract output");
});

test("formatDecisionContractClause includes schema and response instructions", () => {
  const clause = formatDecisionContractClause(contract.schema);
  assert.equal(clause.includes("Respond with ONLY a JSON object"), true);
  assert.equal(clause.includes('"decision"'), true);
});

test("extractContractOutput truncates rationale when rationale_max_chars is exceeded", () => {
  const validate = buildContractValidator(contract.schema);
  const extracted = extractContractOutput(
    "```json\n{\"decision\":\"yes\",\"rationale\":\"this rationale is too long\"}\n```",
    contract,
    validate
  );

  assert.equal(extracted.parse_status, "success");
  assert.equal(extracted.rationale_truncated, true);
  assert.equal(extracted.rationale, "this rationale i");
  assert.equal(extracted.embed_text, "this rationale i");
});

test("extractContractOutput returns failed for empty content", () => {
  const validate = buildContractValidator(contract.schema);
  const extracted = extractContractOutput("   \n", contract, validate);

  assert.equal(extracted.parse_status, "failed");
  assert.equal(extracted.extraction_method, "raw");
  assert.equal(extracted.embed_text, "");
});
