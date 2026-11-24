import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMockArticle, reviseMockArticle } from "../src/lib/mock-editorial.ts";

test("mock generation creates deterministic, visibly labeled editorial drafts", () => {
  const input = { topic: "GTA 6 and culture-war commentary", framing: "Media outrage analysis" };
  const a = generateMockArticle(input);
  const b = generateMockArticle(input);
  assert.deepEqual(a, b);
  assert.equal(a.section, "Culture");
  assert.match(a.title, /^DEMO:/);
  assert.equal(a.quotes.length, 0);
  assert.ok(a.paragraphs.every(p => p.length > 20));
});
test("mock revisions keep original paragraphs and add only a demo instruction note", () => {
  const original = generateMockArticle({ topic: "Workplace organizing" });
  const result = reviseMockArticle({ ...original, instruction: "Make this sharper" });
  assert.equal(result.paragraphs.length, original.paragraphs.length + 1);
  assert.deepEqual(result.paragraphs.slice(0, -1), original.paragraphs);
  assert.match(result.paragraphs.at(-1), /DEMO REVISION NOTE/);
  assert.equal(result.quotes.length, 0);
});
