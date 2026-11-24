// Self-contained tests for Responses API parsing and source validation.
// Run: node --test tests/ai-editorial.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadAiModule(fetchStub) {
  const sourceFile = path.join(__dirname, "../src/lib/ai-editorial.ts");
  const source = fs.readFileSync(sourceFile, "utf8").replace('import "server-only";', "");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    fetch: fetchStub,
    URL,
    AbortSignal,
    process: { env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-5", AI_PROVIDER: "openai" } },
    console,
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourceFile });
  return sandbox.module.exports;
}
const successfulResearch = {
  status: "completed",
  output: [
    { type: "web_search_call", action: { sources: [{ url: "https://example.org/report", title: "Original report" }] } },
    { type: "message", content: [{ type: "output_text", text: "Report found an official statement.", annotations: [
      { type: "url_citation", url: "https://example.org/report", title: "Original report" },
    ] }] },
  ],
};
function structuredDraft(sourceNumber = 1) {
  return {
    title: "Research-backed example",
    dek: "A source-based example of editorial analysis.",
    section: "Culture",
    paragraphs: [
      'The report documented a statement attributed to a spokesperson [1].',
      'The spokesperson said “An example statement from the report” during an interview [1].',
      'This raises broader questions about the public response to the event [1].',
    ],
    quotes: [{ speaker: "Spokesperson", exactText: "An example statement from the report", sourceNumber, contextNotes: "Public interview" }],
    changeSummary: "Initial researched draft",
  };
}
function fakeFetch(results) {
  let index = 0;
  return async () => ({ ok: true, json: async () => results[index++] });
}
const asResponse = (obj) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(obj) }] }] });

test("research retains a clickable source and flags a direct quote as a candidate", async () => {
  const { generateArticle } = loadAiModule(fakeFetch([successfulResearch, asResponse(structuredDraft())]));
  const { draft, sources } = await generateArticle({ topic: "Media controversy" });
  assert.equal(draft.title, "Research-backed example");
  assert.equal(sources[0].url, "https://example.org/report");
  assert.equal(draft.quotes[0].sourceNumber, 1);
});

test("rejects quotations linked to absent source numbers", async () => {
  const { generateArticle } = loadAiModule(fakeFetch([successfulResearch, asResponse(structuredDraft(8))]));
  await assert.rejects(generateArticle({ topic: "Media controversy" }), /traceable source/);
});

test("refuses to draft an article when research supplies no source links", async () => {
  const noSources = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "No links." }] }] };
  const { generateArticle } = loadAiModule(fakeFetch([noSources]));
  await assert.rejects(generateArticle({ topic: "Unknown event" }), /no source links/);
});
