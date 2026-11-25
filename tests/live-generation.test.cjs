// No HTTP requests, no database writes outside the in-memory fake.
// Run: node --test tests/live-generation.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const nodeCrypto = require("node:crypto");

function fixture({
  researchStatus = "none",
  writingStatus = "none",
  enabled = true,
  responses = [],
} = {}) {
  const state = {
    enabled,
    responses: [...responses],
    stages: [],
    calls: [],
    articleId: null,
    job: {
      id: "story-12345678901234567890",
      topic_prompt: "Labor reform",
      requested_framing: "Context",
      additional_instructions: null,
      status: "queued",
      error_message: null,
    },
    checkpoint: {
      request_id: "story-12345678901234567890",
      research_status: researchStatus,
      writing_status: writingStatus,
      research_notes:
        researchStatus === "completed"
          ? "This is sufficiently detailed saved research, with primary sources and context on current events."
          : null,
      sources_json:
        researchStatus === "completed"
          ? '[{"url":"https://example.com/source","title":"Source"}]'
          : "[]",
      article_id: null,
    },
  };
  const simplify = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
  function statement(sql, vals = []) {
    return {
      bind(...params) {
        return statement(sql, params);
      },
      async run() {
        const q = simplify(sql);
        const id = vals[vals.length - 1];
        if (q.startsWith("insert or ignore into ai_calibrations"))
          return { meta: { changes: 0 } };
        if (q.startsWith("update generation_requests set status = 'running'")) {
          if (!["queued", "failed"].includes(state.job.status))
            return { meta: { changes: 0 } };
          state.job.status = "running";
          return { meta: { changes: 1 } };
        }
        if (q.startsWith("update generation_requests set status = 'failed'")) {
          state.job.status = "failed";
          state.job.error_message = vals[0];
          return { meta: { changes: 1 } };
        }
        if (
          q.startsWith("update generation_requests set status = 'completed'")
        ) {
          state.job.status = "completed";
          return { meta: { changes: 1 } };
        }
        if (
          q.startsWith("update ai_calibrations set research_status = 'running'")
        ) {
          if (
            !["none", "failed"].includes(state.checkpoint.research_status) ||
            state.checkpoint.writing_status !== "none"
          )
            return { meta: { changes: 0 } };
          state.checkpoint.research_status = "running";
          return { meta: { changes: 1 } };
        }
        if (q.startsWith("update ai_calibrations set research_status = ?")) {
          state.checkpoint.research_status = vals[0];
          state.checkpoint.research_notes = vals[1];
          state.checkpoint.sources_json = vals[2];
          return { meta: { changes: 1 } };
        }
        if (
          q.startsWith("update ai_calibrations set writing_status = 'running'")
        ) {
          if (
            !["none", "failed"].includes(state.checkpoint.writing_status) ||
            state.checkpoint.research_status !== "completed"
          )
            return { meta: { changes: 0 } };
          state.checkpoint.writing_status = "running";
          return { meta: { changes: 1 } };
        }
        if (
          q.startsWith(
            "update ai_calibrations set writing_status = 'completed'",
          )
        ) {
          state.checkpoint.writing_status = "completed";
          state.checkpoint.article_id = vals[0];
          return { meta: { changes: 1 } };
        }
        if (
          q.startsWith("update ai_calibrations set writing_status = 'failed'")
        ) {
          state.checkpoint.writing_status = "failed";
          return { meta: { changes: 1 } };
        }
        if (
          q.startsWith("update ai_calibrations set research_status = 'failed'")
        ) {
          state.checkpoint.research_status = "failed";
          return { meta: { changes: 1 } };
        }
        if (q.startsWith("insert into articles ")) {
          state.articleId = vals[0];
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      },
      async first() {
        const q = simplify(sql);
        if (q.startsWith("select topic_prompt")) return state.job;
        if (q.startsWith("select raw_text from ai_calibration_calls")) {
          const prior = state.calls.findLast(
            (x) => x.stage === "writing" && x.status === "completed",
          );
          return prior ? { raw_text: prior.rawText } : null;
        }
        return null;
      },
    };
  }
  const db = {
    prepare: statement,
    async batch(queries) {
      for (const query of queries) await query.run();
      return queries.map(() => ({ success: true }));
    },
  };
  const orm = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () =>
                  state.articleId ? [{ id: state.articleId }] : [],
              };
            },
          };
        },
      };
    },
  };
  const fakeModules = {
    "server-only": {},
    "@/db/client": { getDb: async () => orm },
    "@/db/schema": {
      articles: { generationRequestId: "generationRequestId", id: "id" },
      editorialProfiles: { isDefault: "isDefault" },
    },
    "@/lib/calibration-db": {
      getCalibrationDb: async () => db,
      getCalibration: async () => ({ ...state.checkpoint }),
      saveReceipt: async (_db, _id, receipt) => {
        state.calls.push(receipt);
      },
    },
    "@/lib/calibration-openai": {
      paidCallsEnabled: () => state.enabled,
      executeStage: async (stage) => {
        state.stages.push(stage);
        const next = state.responses.shift();
        if (!next) throw Error("No mocked response");
        return next;
      },
      parseDraft: (raw) => JSON.parse(raw),
      researchPrompt: () => ({ instructions: "research", input: "brief" }),
      writingPrompt: () => ({ instructions: "writing", input: "notes" }),
    },
    "drizzle-orm": { eq: (key, value) => ({ key, value }) },
  };
  const location = path.join(__dirname, "../src/lib/live-generation.ts");
  const compiled = ts.transpileModule(fs.readFileSync(location, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      require: (name) => {
        if (!(name in fakeModules)) throw Error("Unknown import " + name);
        return fakeModules[name];
      },
      module,
      exports: module.exports,
      console,
      crypto: nodeCrypto,
    },
    { filename: location },
  );
  return { state, run: module.exports.runLiveGeneration };
}
const research = (status = "completed") => ({
  receipt: {
    stage: "research",
    model: "test",
    status,
    reason: status === "completed" ? null : "max_output_tokens",
    rawText:
      "Source-supported findings with enough words to be useful as a real research note for the writing step.",
    webCalls: 1,
  },
  sources: [{ url: "https://example.com/source", title: "Source" }],
});
const draft = {
  title: "An example analysis",
  dek: "An example article introduction",
  section: "Labor",
  paragraphs: [
    "First sufficiently detailed paragraph",
    "Second sufficiently detailed paragraph",
    "Third sufficiently detailed paragraph",
  ],
  quotes: [],
  changeSummary: "Draft",
};
const writing = (status = "completed") => ({
  receipt: {
    stage: "writing",
    model: "test",
    status,
    reason: status === "completed" ? null : "max_output_tokens",
    rawText: status === "completed" ? JSON.stringify(draft) : "",
    webCalls: 0,
  },
  sources: [],
});

test("disabled mode makes no API calls", async () => {
  const f = fixture({ enabled: false, responses: [research(), writing()] });
  await assert.rejects(f.run(f.state.job.id, "editor"), /not enabled/);
  assert.deepEqual(f.state.stages, []);
});

test("one click researches and writes, preserving receipts", async () => {
  const f = fixture({ responses: [research(), writing()] });
  const articleId = await f.run(f.state.job.id, "editor");
  assert.equal(typeof articleId, "string");
  assert.deepEqual(f.state.stages, ["research", "writing"]);
  assert.equal(f.state.calls.length, 2);
  assert.equal(f.state.job.status, "completed");
});

test("writing failure saves research; retry calls writing only", async () => {
  const f = fixture({
    responses: [research(), writing("incomplete"), writing()],
  });
  await assert.rejects(f.run(f.state.job.id, "editor"), /max_output_tokens/);
  assert.equal(f.state.checkpoint.research_status, "completed");
  assert.equal(f.state.job.status, "failed");
  assert.equal(f.state.calls.length, 2);
  const articleId = await f.run(f.state.job.id, "editor");
  assert.equal(typeof articleId, "string");
  assert.deepEqual(f.state.stages, ["research", "writing", "writing"]);
});

test("incomplete research saves notes and never calls writing", async () => {
  const f = fixture({ responses: [research("incomplete"), writing()] });
  await assert.rejects(f.run(f.state.job.id, "editor"), /max_output_tokens/);
  assert.deepEqual(f.state.stages, ["research"]);
  assert.equal(f.state.checkpoint.research_status, "failed");
  assert.match(f.state.checkpoint.research_notes, /Source-supported/);
});

test("already-completed research skips research and pays only for writing", async () => {
  const f = fixture({ researchStatus: "completed", responses: [writing()] });
  await f.run(f.state.job.id, "editor");
  assert.deepEqual(f.state.stages, ["writing"]);
});

test("previously completed writing receipt recovers without any API call", async () => {
  const f = fixture({ researchStatus: "completed", writingStatus: "failed" });
  f.state.calls.push({
    stage: "writing",
    status: "completed",
    rawText: JSON.stringify(draft),
  });
  const articleId = await f.run(f.state.job.id, "editor");
  assert.equal(typeof articleId, "string");
  assert.deepEqual(f.state.stages, []);
});

test("malformed completed output does not get treated as recoverable writing", async () => {
  const bad = {
    receipt: {
      stage: "writing",
      model: "test",
      status: "completed",
      reason: null,
      rawText: "not json",
      webCalls: 0,
    },
    sources: [],
  };
  const f = fixture({
    researchStatus: "completed",
    responses: [bad, writing()],
  });
  await assert.rejects(f.run(f.state.job.id, "editor"), /JSON/);
  assert.equal(f.state.calls[0].status, "failed");
  assert.equal(f.state.checkpoint.research_status, "completed");
  await f.run(f.state.job.id, "editor");
  assert.deepEqual(f.state.stages, ["writing", "writing"]);
});
