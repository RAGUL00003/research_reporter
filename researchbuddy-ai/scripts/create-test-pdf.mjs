import {mkdir,writeFile} from 'node:fs/promises';
const pages=[[
  'ResearchBuddy Upload Test',
  'Abstract',
  'This original test document checks paper upload and page-linked evidence retrieval.',
  '1 Methods',
  'We evaluated a retrieval system using 120 questions across four academic subjects.',
  'The experiment compared keyword retrieval against a manually curated reference set.',
  'Two reviewers independently checked every retrieved passage for relevance.'
],[
  '2 Results',
  'The system retrieved relevant evidence for 108 of the 120 evaluation questions.',
  'Reviewers agreed on the relevance of 95 percent of the retrieved passages.',
  '3 Limitations',
  'The study is limited by a small dataset and only English language documents.',
  'Future work should evaluate scanned documents and multilingual research papers.',
  'These numbers are synthetic test data, not actual research findings.'
]];
const stream=lines=>'BT /F1 12 Tf 48 740 Td 22 TL '+lines.map((line,i)=>(i?'T* ':'')+'('+line.replace(/[()\\]/g,'\\$&')+') Tj').join('\n')+' ET';
const streams=pages.map(stream);
const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(streams[0])} >>\nstream\n${streams[0]}\nendstream`,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
  `<< /Length ${Buffer.byteLength(streams[1])} >>\nstream\n${streams[1]}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Title (ResearchBuddy Upload Test) /Author (ResearchBuddy QA - synthetic fixture) >>'
];
let pdf='%PDF-1.4\n';const offsets=[0];
objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
const start=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${start}\n%%EOF`;
await mkdir('tests/fixtures',{recursive:true});await writeFile('tests/fixtures/upload.pdf',pdf);await writeFile('tests/fixtures/invalid.pdf','This is deliberately not a PDF.');
console.log('Created synthetic upload and invalid-PDF fixtures.');
