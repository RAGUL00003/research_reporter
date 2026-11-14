import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractPageText,retrieve} from '../dist/retrieval.mjs';
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('dist/assets/lost-in-the-middle.pdf')),isEvalSupported:false}).promise;
const pages=[];
for(let number=1;number<=doc.numPages;number++) {
  const page=await doc.getPage(number);const content=await page.getTextContent();
  pages.push({number,...extractPageText(content.items)});
}
for(const query of ['What methodology and evaluation tasks are used?','What are the key findings?','What are the limitations?','How does photosynthesis work?'])console.log(JSON.stringify({query,...retrieve(pages,query)}));
await doc.destroy();
