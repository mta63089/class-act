const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/calibration-openai.ts'), 'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context = {module:{exports:{}},exports:{},URL,AbortSignal,Date,process:{env:{}}};
  context.exports=context.module.exports;
  vm.runInNewContext(js,context);
  return context.module.exports;
}
test('new writer requests longer, evidence-supported articles and image briefs without image API calls',()=>{
  const {writingPrompt}=load();
  const prompt=writingPrompt({topic:'Labor news',framing:null,instructions:null,notes:'Public source notes',sources:[{title:'Official source',url:'https://example.org/source'}]});
  assert.match(prompt.instructions,/1,100–1,500 words/);
  assert.match(prompt.instructions,/visualBriefs/);
  assert.match(prompt.instructions,/Never pad/i);
});
test('accepts structured visual briefs and still accepts earlier saved drafts',()=>{
  const {parseDraft}=load();
  const sources=[{title:'Official',url:'https://example.org/report'}];
  const draft={title:'Test article title',dek:'Test description',section:'Labor',paragraphs:['A documented fact is available [1].','The record provides supporting evidence [1].','The conclusion follows from evidence [1].'],quotes:[],changeSummary:'Created'};
  assert.equal(parseDraft(JSON.stringify(draft),sources).title,draft.title);
  draft.visualBriefs=[{afterParagraph:0,prompt:'Licensed photo of an ordinary workplace, no invented event',searchQuery:'public domain office photo'}];
  assert.equal(parseDraft(JSON.stringify(draft),sources).visualBriefs.length,1);
});
test('rejects impossible visual placement',()=>{
  const {parseDraft}=load();
  const draft={title:'Test article title',dek:'Test description',section:'Labor',paragraphs:['Documented statement in paragraph one.','Another paragraph with explanatory text.','A third paragraph about relevant context.'],quotes:[],changeSummary:'Created',visualBriefs:[{afterParagraph:50,prompt:'Photograph of the city hall entrance',searchQuery:'city hall'}]};
  assert.throws(()=>parseDraft(JSON.stringify(draft),[{url:'https://example.org/',title:'Example'}]),/image placements/);
});
