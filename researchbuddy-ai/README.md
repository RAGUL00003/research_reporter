# ResearchBuddy AI

A responsive academic reading workspace with local PDF upload, evidence retrieval, page-linked citations, PDF rendering, persistent notes, and Markdown export.

## Run locally

```sh
npm install
npm run prepare:assets
npm run dev
```

Open http://127.0.0.1:4173. The deployment is buildless: the `dist` directory contains the complete site, including the bundled PDF.js reader and example PDF.

## Features

- Upload multiple searchable PDFs (25 MB and 300 pages per PDF).
- Browser-side PDF text extraction with page and detected section references.
- Ask about methodology, findings, limitations, or a particular PDF page.
- Follow evidence links into the original rendered document.
- Search and sort a persistent paper library.
- Save cited evidence or write personal notes; export notes as Markdown.
- Copy a reference and download the original PDF.
- Responsive desktop/mobile navigation and keyboard-accessible dialogs.

## Scope and limitations

The assistant uses local lexical retrieval and extractive answers. No generative language model or external inference API is connected. The example overview is manually curated; uploaded-paper overviews show extracted abstracts and relevant passages. Evidence is not a substitute for checking the original paper. Section detection and reading order can be imperfect for complex PDF layouts, figures, and tables. Small-print footnotes are deprioritized in retrieval. Scanned PDFs require OCR before upload. Browser storage is local to the origin and browser profile; clearing it removes files and notes. There is no account sync or multi-paper inference.

## Validation

```sh
npm test
```

The tests parse the actual bundled paper and verify methodology retrieval, citation fidelity, page filters, abstract extraction, footnote handling, and abstention on unrelated questions.

Browser checks also cover a synthetic two-page PDF upload, page-reference navigation, invalid-PDF feedback, note persistence after reload, Markdown export, library search, and a 390-pixel mobile layout.

## Third-party attribution

Example paper: Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, and Percy Liang (2024). *Lost in the Middle: How Language Models Use Long Contexts*. Transactions of the Association for Computational Linguistics, 12:157–173. [Source](https://aclanthology.org/2024.tacl-1.9/), [DOI](https://doi.org/10.1162/tacl_a_00638). Distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The PDF is unmodified; the overview paraphrases the abstract.

PDF.js is distributed under Apache-2.0; its license is included in `dist/vendor/PDFJS-LICENSE.txt`. DM Sans and Manrope are loaded from Google Fonts with system sans-serif fallbacks. Uploaded PDF content is never sent to those services.
