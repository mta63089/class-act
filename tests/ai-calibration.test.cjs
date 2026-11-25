// Completely offline Responses API contract tests. No network access required.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(fakeFetch, env = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/lib/calibration-openai.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = {
    module: { exports: {} },
    exports: {},
    URL,
    AbortSignal,
    Date,
    fetch: fakeFetch,
    process: {
      env: {
        AI_PROVIDER: "openai",
        AI_PAID_CALLS_ENABLED: "true",
        OPENAI_API_KEY: "fake-test-key",
        OPENAI_RESEARCH_MODEL: "gpt-5.4-mini",
        OPENAI_WRITER_MODEL: "gpt-6.2-sol",
        ...env,
      },
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(compiled, context);
  return context.module.exports;
}
const fullResearch = {
  id: "resp_research",
  model: "gpt-5.4-mini",
  status: "completed",
  usage: {
    input_tokens: 2000,
    output_tokens: 3000,
    output_tokens_details: { reasoning_tokens: 600 },
  },
  output: [
    {
      type: "web_search_call",
      action: {
        sources: [
          { title: "Official record", url: "https://example.org/record" },
        ],
      },
    },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "A primary record was published. The timing and assertions are documented in the original record. The viewpoint remains a claim to investigate before publication.",
        },
      ],
    },
  ],
};
function outputResponse(data) {
  return { ok: true, status: 200, json: async () => data };
}

test("one AI_PROVIDER setting enables paid calls when the legacy switch is absent", async () => {
  let called = 0;
  const mod = load(
    async () => {
      called++;
      return outputResponse(fullResearch);
    },
    { AI_PAID_CALLS_ENABLED: undefined },
  );
  const result = await mod.executeStage("research", "Research", "An example");
  assert.equal(result.receipt.status, "completed");
  assert.equal(called, 1);
});
test("explicit legacy false remains a kill switch to avoid surprise charges", async () => {
  let called = 0;
  const mod = load(
    async () => {
      called++;
      return outputResponse(fullResearch);
    },
    { AI_PAID_CALLS_ENABLED: "false" },
  );
  await assert.rejects(
    mod.executeStage("research", "Research", "An example"),
    /flag must not be false/,
  );
  assert.equal(called, 0);
});
test("mock mode prevents all network calls even when a key is configured", async () => {
  let called = 0;
  const mod = load(
    async () => {
      called++;
      return outputResponse(fullResearch);
    },
    { AI_PROVIDER: "mock" },
  );
  await assert.rejects(
    mod.executeStage("writing", "Draft", "An example"),
    /AI_PROVIDER=openai/,
  );
  assert.equal(called, 0);
});
test("research uses economical model and at most one web search", async () => {
  let payload;
  const mod = load(async (_, init) => {
    payload = JSON.parse(init.body);
    return outputResponse(fullResearch);
  });
  const result = await mod.executeStage(
    "research",
    "Research brief",
    "An example",
  );
  assert.equal(payload.model, "gpt-5.4-mini");
  assert.equal(payload.max_output_tokens, 25000);
  assert.equal(payload.max_tool_calls, 1);
  assert.equal(payload.tools[0].type, "web_search");
  assert.equal(result.receipt.status, "completed");
  assert.equal(result.receipt.inputTokens, 2000);
  assert.equal(result.receipt.reasoningTokens, 600);
  assert.equal(result.receipt.webCalls, 1);
  assert.equal(result.sources[0].url, "https://example.org/record");
  assert.ok(result.receipt.estimatedUsd > 0.01);
});
test("writing uses a separate higher-quality model and cannot search", async () => {
  let payload;
  const mod = load(async (_, init) => {
    payload = JSON.parse(init.body);
    return outputResponse({
      id: "resp_writer",
      status: "completed",
      usage: { input_tokens: 800, output_tokens: 1800 },
      output: [
        { type: "message", content: [{ type: "output_text", text: "{}" }] },
      ],
    });
  });
  const result = await mod.executeStage("writing", "Write brief", "Notes");
  assert.equal(payload.model, "gpt-6.2-sol");
  assert.equal(payload.max_output_tokens, 25000);
  assert.ok(!("tools" in payload));
  assert.equal(result.receipt.webCalls, 0);
  assert.equal(result.receipt.status, "completed");
});
test("incomplete response preserves usage and incomplete reason", async () => {
  const mod = load(async () =>
    outputResponse({
      id: "resp_incomplete",
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      usage: {
        input_tokens: 3000,
        output_tokens: 25000,
        output_tokens_details: { reasoning_tokens: 24000 },
      },
      output: [],
    }),
  );
  const result = await mod.executeStage("research", "Research", "Topic");
  assert.equal(result.receipt.status, "incomplete");
  assert.equal(result.receipt.reason, "max_output_tokens");
  assert.equal(result.receipt.outputTokens, 25000);
  assert.equal(result.receipt.reasoningTokens, 24000);
  assert.ok(result.receipt.estimatedUsd > 0);
});
test("network errors do not pretend to know the billable amount", async () => {
  const mod = load(async () => {
    throw new Error("Connection lost");
  });
  const result = await mod.executeStage("research", "Research", "Topic");
  assert.equal(result.receipt.status, "failed");
  assert.equal(result.receipt.estimatedUsd, null);
  assert.match(result.receipt.reason, /Billing status unknown/);
});
test("input safety preflight rejects oversized input with no fetch", async () => {
  let calls = 0;
  const mod = load(async () => {
    calls++;
    return outputResponse(fullResearch);
  });
  await assert.rejects(
    mod.executeStage("writing", "x", "y".repeat(38001)),
    /exceeds safe input-length/,
  );
  assert.equal(calls, 0);
});
test("invalid output cap aborts before fetch", async () => {
  let calls = 0;
  const mod = load(
    async () => {
      calls++;
      return outputResponse(fullResearch);
    },
    { OPENAI_WRITER_MAX_OUTPUT_TOKENS: "100000" },
  );
  await assert.rejects(
    mod.executeStage("writing", "x", "y"),
    /must be an integer/,
  );
  assert.equal(calls, 0);
});
test("draft parser rejects quotes with missing source numbers", () => {
  const mod = load(async () => outputResponse(fullResearch));
  const body = {
    title: "A new editorial test article",
    dek: "Important context about the source record.",
    section: "Politics",
    paragraphs: [
      "This is one lengthy paragraph about the documented source and its details [1].",
      "This is another sufficiently long paragraph about the historical background [1].",
      "This final paragraph describes the debate and reported context in detail [1].",
    ],
    quotes: [
      {
        speaker: "Person",
        exactText: "A long invented direct statement",
        sourceNumber: 9,
        contextNotes: "unknown",
      },
    ],
    changeSummary: "Initial draft",
  };
  assert.throws(
    () =>
      mod.parseDraft(JSON.stringify(body), [
        { title: "Record", url: "https://example.org" },
      ]),
    /unsupported quote/,
  );
});
test("live requests use the one-click resumable pipeline, not calibration redirects", () => {
  const actions = fs.readFileSync(
    path.join(__dirname, "../src/app/admin/ai-actions.ts"),
    "utf8",
  );
  assert.match(actions, /await runLiveGeneration\(id, editor.id\)/);
  assert.doesNotMatch(actions, /redirect\(`\/admin\/calibration/);
});
