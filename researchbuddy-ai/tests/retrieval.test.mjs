import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractPageText,retrieve,splitPassages,overview} from '../dist/retrieval.mjs';
let doc;
const pages=[];
before(async()=>{
  doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('dist/assets/lost-in-the-middle.pdf')),isEvalSupported:false}).promise;
  for(let number=1;number<=doc.numPages;number++){const page=await doc.getPage(number);const content=await page.getTextContent();pages.push({number,...extractPageText(content.items)});}
});
after(async()=>doc?.destroy());
test('real example extracts all 17 pages and its abstract',()=>{
  assert.equal(pages.length,17);assert.match(overview(pages).abstract,/multi-document question answering/);
});
test('methodology points to experimental setup',()=>{
  const result=retrieve(pages,'What methodology and evaluation tasks are used?');
  assert.equal(result.intent,'methodology');assert.ok(result.evidence.length>1);
  assert.match(result.evidence[0].section,/Experimental Setup/);
});
test('findings preserve a relevant conclusion and exact PDF reference',()=>{
  const result=retrieve(pages,'What are the key findings?');
  assert.match(result.evidence[0].excerpt,/performance degrades/);assert.equal(result.evidence[0].page,11);
  for(const evidence of result.evidence){assert.ok(pages[evidence.page-1].bodyText.replace(/\s+/g,' ').includes(evidence.excerpt));}
});
test('unrelated questions abstain rather than matching generic words',()=>{
  for(const question of ['How does photosynthesis work?','What is the capital of France?','What findings does this paper report about whales?'])assert.equal(retrieve(pages,question).evidence.length,0,question);
});
test('page-specific questions stay on that PDF page',()=>{
  const result=retrieve(pages,'Explain page 6');assert.ok(result.evidence.length);assert.ok(result.evidence.every(e=>e.page===6));
  assert.match(retrieve(pages,'Explain page 99').reason,/outside the document/);
});
test('footnotes are not mistaken for section headings',()=>{
  assert.ok(splitPassages(pages).every(p=>!/^\d+ (We|Since|Ambiguity)/.test(p.section)));
});
test('empty documents return a useful no-evidence response',()=>{
  const result=retrieve([],'What are the findings?');assert.equal(result.evidence.length,0);assert.match(result.reason,/couldn’t find/);
});
test('abstract stops at the next section, even without an Introduction heading',()=>{
  const result=overview([{number:1,text:'Abstract\nThis is the abstract of an original test paper.\n1 Methods\nThis belongs to methods, not the abstract.'}]);
  assert.equal(result.abstract,'This is the abstract of an original test paper.');
});
