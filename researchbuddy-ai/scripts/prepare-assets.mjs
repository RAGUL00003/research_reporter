import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist/vendor', { recursive: true });
await copyFile('node_modules/pdfjs-dist/build/pdf.mjs', 'dist/vendor/pdf.mjs');
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs', 'dist/vendor/pdf.worker.mjs');
await copyFile('node_modules/pdfjs-dist/LICENSE', 'dist/vendor/PDFJS-LICENSE.txt');
await cp('node_modules/pdfjs-dist/cmaps', 'dist/vendor/cmaps', { recursive: true });
await cp('node_modules/pdfjs-dist/standard_fonts', 'dist/vendor/standard_fonts', { recursive: true });
console.log('Prepared local PDF reader assets.');
