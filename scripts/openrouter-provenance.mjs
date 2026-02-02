import { extractActualModel, extractResponseId } from "../dist/openrouter/client.js";

const body = {
  model: "openai/gpt-4o-mini-2024-07-18",
  id: "gen-test-123"
};

if (extractActualModel(body) !== body.model) {
  throw new Error("extractActualModel did not use response body model");
}

if (extractResponseId(body) !== body.id) {
  throw new Error("extractResponseId did not use response body id");
}

if (extractActualModel({}) !== null) {
  throw new Error("extractActualModel should return null when model missing");
}

if (extractResponseId({}) !== null) {
  throw new Error("extractResponseId should return null when id missing");
}

console.log("OpenRouter provenance extraction OK");
