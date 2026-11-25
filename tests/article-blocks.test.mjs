import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArticleBlocks, articleWordCount, unfinishedImageIdeas } from '../src/lib/article-blocks.ts';

test('accepts existing paragraphs and headings without any schema migration', () => {
  const blocks = validateArticleBlocks([{type:'paragraph',text:'A cited paragraph [1].'}, {type:'heading',level:2,text:'Background'}]);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(articleWordCount(blocks), 5);
});
test('accepts attributed image and split media blocks', () => {
  const blocks = validateArticleBlocks([
    {type:'image',src:'https://images.example.org/news.jpg',alt:'Exterior of the city council building',caption:'City council',credit:'City Archive',sourceUrl:'https://example.org/license'},
    {type:'split',src:'/assets/hero.webp',alt:'Conceptual illustration of an economy',caption:'Illustration',credit:'Editorial staff',text:'Context from the source',position:'right'},
  ]);
  assert.equal(blocks[1].type,'split');
});
test('rejects javascript and HTTP images and missing image credit',()=>{
  const base={type:'image',src:'https://example.org/photo.jpg',alt:'An illustrative image',caption:'',credit:'Photo archive'};
  for(const src of ['javascript:alert(1)','http://example.org/pic.jpg','data:image/svg+xml;base64,AAA']) {
    assert.throws(()=>validateArticleBlocks([{...base,src}]),/HTTPS/);
  }
  assert.throws(()=>validateArticleBlocks([{...base,credit:''}]),/credit/);
});
test('tracks editor-only image briefs',()=>{
  const blocks=validateArticleBlocks([{type:'paragraph',text:'Lead content'}, {type:'imageIdea',prompt:'Non-photoreal editorial illustration of a city skyline',placementNote:'After paragraph 1'}]);
  assert.equal(unfinishedImageIdeas(blocks),1);
});
test('rejects invalid H1 and empty blocks',()=>{
  assert.throws(()=>validateArticleBlocks([{type:'heading',text:'Wrong',level:1}]),/H2 or H3/);
  assert.throws(()=>validateArticleBlocks([]),/between 1 and 160/);
});
