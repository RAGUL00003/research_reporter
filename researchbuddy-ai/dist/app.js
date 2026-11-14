import * as pdfjs from './vendor/pdf.mjs';
import { extractPageText, retrieve, overview } from './retrieval.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.mjs';

const paths = {
  book:'<path d="M3 4h5a4 4 0 0 1 4 4v13a5 5 0 0 0-5-3H3zM21 4h-5a4 4 0 0 0-4 4v13a5 5 0 0 1 5-3h4z"/>',
  sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  library:'<path d="M4 4v16M8 4v16M13 4v16M17 4l4 15M3 20h19"/>',
  bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',
  file:'<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h6"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m7 10 5 5 5-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4M12 17h.01"/>',
  leaf:'<path d="M20 3C8 2 2 8 5 16c3 6 14 4 15-13ZM5 20 16 9M5 15h6v-6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  quote:'<path d="M10 5H4v7h6v-7ZM20 5h-6v7h6v-7ZM10 12c0 5-3 6-6 7M20 12c0 5-3 6-6 7"/>',
  bulb:'<path d="M9 18h6M10 21h4M8 14a7 7 0 1 1 8 0l-1 4H9z"/>',
  flask:'<path d="M9 3h6M10 3v7L4 20h16l-6-10V3M7 15h10"/>',
  chart:'<path d="M4 3v17h17M8 15v-4M13 15V7M18 15V4"/>',
  alert:'<path d="m12 3 10 17H2zM12 9v4M12 17h.01"/>',
  text:'<path d="M4 5h16M4 10h16M4 15h11M4 20h8"/>',
  send:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  trash:'<path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M4 12h16m-5-5 5 5-5 5"/>',
  external:'<path d="M14 3h7v7M10 14 21 3M10 3H3v18h18v-7"/>',
  sort:'<path d="M8 4v16m-4-4 4 4 4-4M15 5h6M15 10h4M15 15h2"/>'
};
const icon = (name, cls='') => `<svg aria-hidden="true" class="${cls}" viewBox="0 0 24 24">${paths[name] || paths.file}</svg>`;
const esc = text => String(text ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const demo = { id:'demo-lost-in-middle', title:'Lost in the Middle: How Language Models Use Long Contexts', author:'Nelson F. Liu et al.', year:'2024', tags:['Natural language processing','Long contexts'], demo:true, added:1, pages:[], chats:[] };
const state = { papers:[], notes:[], selected:demo.id, view:'workspace', tab:'overview', page:1, loading:true, error:'', search:'', sort:'recent', busy:false, sidebar:false, draft:'' };
const pdfCache=new Map();
let db;
let rendering=0;
const current = () => state.papers.find(p=>p.id===state.selected);
const sourceButton=(page,label)=>`<button class="source-link" data-action="source" data-page="${page}">${icon('file')}${esc(label || `p. ${page}`)} ${icon('chevron')}</button>`;
const empty=(title,text,action='')=>`<div class="empty-state">${icon('book')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;

function render() {
  const paper=current();
  const headings={workspace:['Make sense of your research.','Read deeper, connect ideas, and find answers grounded in your papers.'],library:['A home for your curiosity.','All your papers, ready for the next question.'],notes:['Keep the ideas that matter.','Your notes and saved evidence, in one thoughtful place.']};
  const [title,subtitle]=headings[state.view];
  app.innerHTML=`<div class="app-shell"><div class="mobile-backdrop ${state.sidebar?'visible':''}" data-action="close-sidebar"></div>
    <aside class="sidebar ${state.sidebar?'open':''}" aria-label="Main navigation">
      <a class="brand" href="#" data-action="workspace" aria-label="ResearchBuddy home"><span class="brand-mark">${icon('book')}</span><span class="brand-name">ResearchBuddy<small>AI</small></span></a>
      <p class="nav-label">YOUR SPACE</p>
      <nav class="nav-group">
        <button class="nav-item ${state.view==='workspace'?'active':''}" data-action="workspace">${icon('grid')}Workspace</button>
        <button class="nav-item ${state.view==='library'?'active':''}" data-action="library">${icon('library')}My library<span class="nav-count">${state.papers.length}</span></button>
        <button class="nav-item ${state.view==='notes'?'active':''}" data-action="notes">${icon('bookmark')}Saved notes<span class="nav-count">${state.notes.length}</span></button>
      </nav>
      <div class="recent-section"><p class="nav-label">RECENT PAPERS</p>${state.papers.slice(-3).reverse().map(p=>`<button class="recent-paper" data-action="select" data-id="${esc(p.id)}">${icon('file')}<span>${esc(p.title)}</span></button>`).join('') || '<p class="recent-paper">Your next discovery starts here.</p>'}</div>
      <div class="sidebar-bottom"><div class="sidebar-note"><div class="leaf">${icon('leaf')}</div><h4>A little less noise.<br>A little more insight.</h4><p>Make room for the ideas<br>that move your research forward.</p></div>
      <div class="side-footer"><span class="avatar">R</span><div><strong>My workspace</strong><small>Personal research space</small></div><button class="icon-button" data-action="help" aria-label="Workspace information">${icon('more')}</button></div></div>
    </aside>
    <main class="main"><header class="topbar"><div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="Open navigation">${icon('menu')}</button>${icon('grid')}<span>My workspace</span>${icon('chevron')}<span class="current">${state.view==='workspace'?'Overview':state.view==='library'?'My library':'Saved notes'}</span></div><div class="top-actions"><button class="icon-button" data-action="help" aria-label="How ResearchBuddy works">${icon('help')}</button><span class="top-divider"></span><span class="avatar" title="Personal workspace">R</span></div></header>
      <div class="content"><div class="page-heading"><div><div class="eyebrow">A SPACE FOR YOUR NEXT DISCOVERY</div><h1>${title}</h1><p>${subtitle}</p></div><button class="primary" data-action="upload">${icon('plus')}Upload paper</button></div>
      ${state.error?`<div class="error-banner" role="alert">${esc(state.error)} <button class="text-button" data-action="retry">Try again</button></div>`:''}
      ${state.view==='workspace'?workspace(paper):state.view==='library'?library():notesView()}
      <footer class="page-footer">${icon('lock')}Your papers stay in this browser. Your next discovery is yours.</footer></div>
    </main></div>`;
  if (state.tab==='reader' && state.view==='workspace' && paper?.pages.length) drawPage();
  if (paper?.chats?.length) requestAnimationFrame(()=>{const el=document.querySelector('.chat-body');if(el)el.scrollTop=el.scrollHeight;});
}
function workspace(paper) {
  return `<div class="upload-banner" id="dropzone"><div class="upload-art">${icon('file')}</div><div class="upload-copy"><h3>Good research starts with a great paper.</h3><p>Drop a PDF here to get started <span>·</span> Up to 25 MB per paper</p></div><button class="secondary" data-action="upload">${icon('upload')}Browse files</button></div>
    <div class="workspace-top"><h2>On your reading desk <span class="count-pill">${state.papers.length} ${state.papers.length===1?'paper':'papers'}</span></h2><button class="text-button" data-action="library">View library ${icon('arrow')}</button></div>
    ${paper?`<div class="paper-strip">${paperIdentity(paper)}<span class="ready-badge"><span></span>${state.loading?'Reading paper…':'Ready to explore'}</span><div class="paper-actions"><button class="icon-button citation-action" data-action="citation" aria-label="Cite this paper" title="Cite paper">${icon('quote')}</button><button class="icon-button" data-action="paper-menu" aria-label="Paper options">${icon('more')}</button></div></div>
      <div class="analysis-grid"><section class="panel" aria-label="Paper analysis"><div class="panel-tabs" role="tablist">${[['overview','sparkle','Overview'],['reader','book','Read paper'],['paper-notes','bookmark','Notes']].map(([key,ic,label])=>`<button role="tab" aria-selected="${state.tab===key}" class="tab ${state.tab===key?'active':''}" data-action="tab" data-tab="${key}">${icon(ic)}${label}</button>`).join('')}<button class="icon-button" data-action="download" title="Download PDF" aria-label="Download PDF">${icon('download')}</button></div><div role="tabpanel">${state.loading?'<div class="loading"><span class="spinner"></span>Reading the paper and finding its evidence…</div>':state.tab==='overview'?paperOverview(paper):state.tab==='reader'?reader(paper):paperNotes(paper)}</div></section>${assistant(paper)}</div>`:
      `<div class="blank-workspace">${empty('Make room for a new idea.','Upload a research paper or explore the example to start your reading desk.',`<button class="primary" data-action="restore-demo">${icon('book')}Explore example paper</button>`)}</div>`}`;
}
function paperIdentity(p) {
  return `<div class="pdf-icon">${icon('file')}<small>PDF</small></div><div class="paper-meta"><h2>${esc(p.title)}</h2><p><span>${esc(p.author || 'Uploaded paper')}</span>${p.year?`<span class="meta-dot">·</span><span>${esc(p.year)}</span>`:''}<span class="meta-dot">·</span><span>${p.pages.length || '—'} pages</span>${p.demo?'<span class="tag mint">EXAMPLE PAPER</span>':'<span class="tag">YOUR LIBRARY</span>'}</p></div>`;
}
function paperOverview(p) {
  if(!p.pages.length)return empty('This paper isn’t ready yet.','Try loading the example again or upload a text-based PDF.');
  const info=overview(p.pages);
  let summary, takeaways;
  if(p.demo){
    summary='A longer context window doesn’t always mean better understanding. This study explores how language models use information across long inputs—and why where you place the evidence can matter as much as the evidence itself.';
    takeaways=[['Position changes performance','Models often perform best when relevant information appears at the beginning or end of the context.',1],['The middle is a blind spot','Performance can drop when the information needed to answer is buried in the middle—even for long-context models.',1],['Two tasks, a consistent question','Multi-document question answering and key-value retrieval test whether models can find and use relevant information.',1]];
  } else {
    summary=info.abstract || 'Explore the passages below to get oriented. Ask about methodology, findings, or a specific PDF page to retrieve supporting evidence.';
    takeaways=info.findings.map((x,i)=>[x.section || `Relevant passage ${i+1}`,x.excerpt,x.page]);
  }
  return `<div class="overview"><div class="big-picture"><h3 class="section-title">${icon('sparkle')}${p.demo?'The big picture':info.abstract?'From the abstract':'Start with the evidence'}</h3><p>${esc(summary)}</p>${sourceButton(1)}</div>
    <h3 class="section-title">${icon('bulb')}${p.demo?'Key takeaways':'Findings in the paper'}</h3><div class="takeaways">${takeaways.map(([title,text,page],i)=>`<div class="takeaway"><span class="takeaway-num">0${i+1}</span><div><h4>${esc(title)}</h4><p>${esc(text)}</p>${sourceButton(page)}</div></div>`).join('') || '<p class="answer-intro">Ask a question to explore the paper’s evidence.</p>'}</div>
    <hr class="overview-divider"><h3 class="section-title">${icon('flask')}Explore the methodology</h3><p style="font-size:10.5px;line-height:1.8;color:#8a958c">Look closer at the study’s design, evaluation, and evidence.</p><div class="topic-row">${(p.tags || ['Study design','Evaluation','Results']).map(tag=>`<button class="topic" data-action="ask" data-question="${esc(`What does this paper say about ${tag}?`)}">${esc(tag)}</button>`).join('')}<button class="topic" data-action="ask" data-question="What methodology and evaluation tasks are used?">View methodology ${icon('chevron').replace('<svg ','<svg style="width:9px;height:9px;vertical-align:middle" ')}</button></div>
    <div class="overview-footer">${icon('shield')}<span>${p.demo?'Example overview curated from the paper.':'Overview uses extracted paper text.'} Always check the original source.${p.demo?' <a href="https://aclanthology.org/2024.tacl-1.9/" target="_blank" rel="noopener">Liu et al., 2024</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>':''}</span></div></div>`;
}
function assistant(p) {
  const prompts=[['flask','Methodology','How was it studied?','What methodology and evaluation tasks are used?'],['chart','Key findings','What did they discover?','What are the key findings?'],['alert','Limitations','Where are the gaps?','What limitations and open questions are discussed?'],['text','Explain a section','Go a little deeper','What does the introduction on page 1 say?']];
  return `<section class="panel assistant-panel" aria-label="Research assistant"><div class="assistant-heading"><div class="mini-mark">${icon('sparkle')}</div><h3>Ask ResearchBuddy</h3><span class="grounded">${icon('shield')}Grounded in your paper</span></div><div class="context-bar">${icon('file')}<span>${esc(p.title)}</span><i class="dot"></i></div>
    <div class="chat-body" role="log" aria-label="Research conversation" aria-live="polite">${p.chats?.length?p.chats.map((m,i)=>message(m,i)).join(''):`<div class="chat-welcome"><div class="welcome-mark">${icon('sparkle')}</div><h3>Good questions.<br>Better understanding.</h3><p>Your paper has a story to tell. Let’s unpack the methods, make sense of the findings, and follow the evidence together.</p><div class="suggestion-label">A FEW PLACES TO START</div><div class="suggestions">${prompts.map(([ic,title,sub,q])=>`<button class="suggestion" data-action="ask" data-question="${q}" ${state.loading?'disabled':''}>${icon(ic)}<div><strong>${title}</strong><span>${sub}</span></div></button>`).join('')}</div><div class="evidence-note">${icon('quote')}Every passage links back to its source.</div></div>`}</div>
    <div class="composer-area"><form id="question-form" class="composer"><textarea id="question" aria-label="Ask about this paper" placeholder="Ask anything about this paper…" rows="2" maxlength="2000" ${state.loading?'disabled':''}>${esc(state.draft)}</textarea><div class="composer-bottom"><span class="composer-context">${icon('file')}1 paper in context</span><button type="submit" class="send-button" aria-label="Send question" ${state.loading?'disabled':''}>${icon('send')}</button></div></form><p class="composer-footnote">Local evidence search · Check cited passages in the original paper.</p></div></section>`;
}
function message(m,index) {
  if(m.role==='user')return `<div class="message user-message">${esc(m.text)}</div>`;
  return `<div class="message assistant-message"><div class="message-label">${icon('sparkle')}ResearchBuddy <span class="tag mint">EVIDENCE</span></div><p class="answer-intro">${esc(m.text)}</p>${(m.evidence || []).map(e=>`<div class="evidence-item"><p>“${esc(e.excerpt)}”</p>${sourceButton(e.page)}<span class="evidence-section">${esc(e.section)}</span></div>`).join('')}${m.evidence?.length?`<div class="answer-tools"><button data-action="save-answer" data-index="${index}">${icon('bookmark')}Save to notes</button><button data-action="copy-answer" data-index="${index}">${icon('copy')}Copy</button></div>`:''}</div>`;
}
function reader(p) {
  state.page=Math.max(1,Math.min(p.pages.length,state.page));
  return `<div class="reader-toolbar"><button class="icon-button" data-action="prev-page" aria-label="Previous page" ${state.page<=1?'disabled':''}>${icon('chevron').replace('<svg ','<svg style="transform:rotate(180deg)" ')}</button><span>Page</span><form id="page-form"><input id="page-input" type="number" aria-label="PDF page number" min="1" max="${p.pages.length}" value="${state.page}"></form><span>of ${p.pages.length}</span><button class="icon-button" data-action="next-page" aria-label="Next page" ${state.page>=p.pages.length?'disabled':''}>${icon('chevron')}</button></div><div class="reader-page" id="reader-page"><div class="loading"><span class="spinner"></span>Loading page ${state.page}…</div></div><p class="reader-caption">References use PDF page numbers. Printed journal page numbers may differ.</p><details class="page-transcript"><summary>Extracted page text</summary><p>${esc(p.pages[state.page-1].text)}</p></details>`;
}
function library() {
  const query=state.search.toLowerCase();
  const papers=state.papers.filter(p=>`${p.title} ${p.author} ${p.tags?.join(' ')}`.toLowerCase().includes(query)).sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title):b.added-a.added);
  return `<div class="workspace-top"><h2>Your library <span class="count-pill">${state.papers.length}</span></h2></div><div class="library-toolbar"><label class="search-field">${icon('search')}<input id="library-search" type="search" placeholder="Search by title, author, or topic…" aria-label="Search papers" value="${esc(state.search)}"></label><button class="secondary" data-action="sort">${icon('sort')}${state.sort==='recent'?'Most recent':'Title A–Z'}</button></div><div class="library-list">${papers.map(p=>`<article class="library-card"><div class="pdf-icon">${icon('file')}<small>PDF</small></div><div class="paper-meta"><h2><button style="padding:0;text-align:left;font:inherit" data-action="select" data-id="${esc(p.id)}">${esc(p.title)}</button></h2><p>${esc(p.author)} <span class="meta-dot">·</span> ${p.pages.length} pages ${p.demo?'<span class="tag mint">EXAMPLE</span>':''}</p></div><button class="secondary" data-action="select" data-id="${esc(p.id)}">Explore ${icon('arrow')}</button></article>`).join('') || empty(state.search?'No matching papers.':'Your library starts with one paper.',state.search?'Try another title, author, or topic.':'Upload a PDF to begin building your research library.')}</div>`;
}
function notesView(){return `<div class="workspace-top"><h2>Saved notes <span class="count-pill">${state.notes.length}</span></h2><button class="secondary" data-action="export-notes" ${!state.notes.length?'disabled':''}>${icon('download')}Export notes</button></div><div class="note-list">${[...state.notes].reverse().map(noteCard).join('') || empty('A good idea deserves a bookmark.','Save an answer from ResearchBuddy or add your own notes while reading a paper.')}</div>`;}
function paperNotes(p){const notes=state.notes.filter(n=>n.paperId===p.id);return `<div class="notes-panel"><form id="note-form" class="new-note"><textarea id="note-text" aria-label="Write a note" maxlength="10000" placeholder="A connection, a question, a thought worth keeping…"></textarea><button class="primary" type="submit">${icon('plus')}Add note</button></form><div class="note-list">${notes.reverse().map(noteCard).join('') || empty('Leave a thought for your future self.','Write a note above, or save a cited answer from the assistant.')}</div></div>`;}
function noteCard(n){return `<article class="note-card"><div class="note-title"><div><h3>${esc(n.title)}</h3><small>${esc(n.paperTitle)} · ${new Date(n.created).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></div><button class="icon-button" data-action="delete-note" data-id="${esc(n.id)}" aria-label="Delete note">${icon('trash')}</button></div><p>${esc(n.text)}</p>${(n.pages || []).map(page=>`<button class="source-link" data-action="note-source" data-id="${esc(n.paperId)}" data-page="${page}">${icon('file')}p. ${page} ${icon('chevron')}</button>`).join('')}</article>`;}

async function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('researchbuddy-v1',1);request.onupgradeneeded=()=>{request.result.createObjectStore('papers',{keyPath:'id'});request.result.createObjectStore('notes',{keyPath:'id'});request.result.createObjectStore('settings',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function readAll(store){return new Promise((resolve,reject)=>{const request=db.transaction(store).objectStore(store).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function persist(store,value,remove=false){if(!db)return Promise.resolve(false);return new Promise(resolve=>{const tx=db.transaction(store,'readwrite');const s=tx.objectStore(store);remove?s.delete(value):s.put(value);tx.oncomplete=()=>resolve(true);tx.onerror=()=>{toast('Browser storage is full or unavailable. This change is kept for this session.');resolve(false);};});}

async function parsePdf(blob,onProgress=()=>{}) {
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const task=pdfjs.getDocument({data:bytes,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',isEvalSupported:false});
  const doc=await task.promise;
  if(doc.numPages>300){await doc.destroy();throw new Error('Please use a PDF with 300 pages or fewer.');}
  const pages=[];
  for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i);const content=await page.getTextContent();
    pages.push({number:i,...extractPageText(content.items)});onProgress(i,doc.numPages);
  }
  if(pages.reduce((n,p)=>n+p.text.length,0)<120){await doc.destroy();throw new Error('This PDF has no usable text layer. Please upload a searchable PDF; scanned pages need OCR first.');}
  const metadata=await doc.getMetadata().catch(()=>({info:{}}));
  return {doc,pages,metadata:metadata.info || {}};
}
async function loadDemo(){
  state.loading=true;state.error='';
  if(!state.papers.some(p=>p.id===demo.id))state.papers.push({...demo,chats:[]});
  state.selected=demo.id;state.view='workspace';state.tab='overview';render();
  try{
    const response=await fetch('/assets/lost-in-the-middle.pdf');if(!response.ok)throw new Error('The example PDF could not be loaded.');
    const blob=await response.blob();const parsed=await parsePdf(blob);
    const paper={...demo,blob,pages:parsed.pages,chats:[],size:blob.size};
    state.papers=state.papers.filter(p=>p.id!==demo.id).concat(paper);pdfCache.set(paper.id,parsed.doc);await persist('papers',paper);await persist('settings',{id:'demo-removed',value:false});
  }catch(error){state.error=`Couldn’t load the example. ${error.message}`;}
  state.loading=false;render();
}
async function drawPage(){
  const p=current(),token=++rendering,pageNumber=state.page;
  try{
    let doc=pdfCache.get(p.id);
    if(!doc){doc=await pdfjs.getDocument({data:new Uint8Array(await p.blob.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',isEvalSupported:false}).promise;pdfCache.set(p.id,doc);}
    const page=await doc.getPage(pageNumber);const viewport=page.getViewport({scale:1.65});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.setAttribute('aria-label',`Page ${pageNumber} of ${p.title}`);canvas.setAttribute('role','img');
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    if(token!==rendering || state.tab!=='reader')return;
    const container=document.querySelector('#reader-page');if(container)container.replaceChildren(canvas);
  }catch(error){const el=document.querySelector('#reader-page');if(el)el.innerHTML=empty('This page couldn’t be displayed.','Download the PDF to open it in your preferred reader.');}
}
function showModal(title,body){modal.innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${body}</div>`;if(!modal.open)modal.showModal();}
function uploadDialog(){
  showModal('Bring a paper to your desk',`<p>Add a research paper and follow its ideas from the first question to the original source.</p><div class="modal-drop" id="modal-drop" role="button" tabindex="0" aria-label="Choose PDF files">${icon('upload')}<strong>Drop your PDFs here</strong><p>PDF files · Up to 25 MB each · Up to 300 pages</p><button class="primary" data-action="choose-files">Browse files ${icon('arrow')}</button></div><input id="file-input" type="file" accept=".pdf,application/pdf" multiple hidden><div id="upload-status" class="upload-status" role="status" aria-live="polite"></div><div class="privacy-line">${icon('lock')}Files are processed and stored only in this browser.</div>`);
  const input=document.querySelector('#file-input');
  const selected=()=>{if(input.files.length){document.querySelector('#upload-status').textContent=[...input.files].map(file=>file.name).join(', ');}};
  input.addEventListener('change',selected);
  input.addEventListener('input',selected);
  document.querySelector('#upload-status').insertAdjacentHTML('afterend',`<div class="modal-actions"><button class="primary" data-action="process-files">${icon('sparkle')}Analyze selected files</button></div>`);
}
async function handleFiles(files){
  if(state.busy)return;
  if(!modal.open || !document.querySelector('#upload-status'))uploadDialog();
  const status=document.querySelector('#upload-status');
  const list=[...files];if(!list.length)return;
  state.busy=true;let added=0;const errors=[];
  for(const file of list){
    try{
      if(!/\.pdf$/i.test(file.name) && file.type!=='application/pdf')throw new Error('Please choose a PDF file.');
      if(file.size>25*1024*1024)throw new Error('This file exceeds the 25 MB limit.');
      const parsed=await parsePdf(file,(page,total)=>{status.className='upload-status';status.innerHTML=`Reading ${esc(file.name)} · ${page} of ${total} pages<div class="progress-bar"><i style="width:${page/total*100}%"></i></div>`;});
      const md=parsed.metadata;const metadataTitle=typeof md.Title==='string'?md.Title.trim():'';
      const title=metadataTitle.length>4 && !/^(untitled|microsoft|word|latex|template)/i.test(metadataTitle)?metadataTitle.slice(0,200):file.name.replace(/\.pdf$/i,'').replace(/[_-]/g,' ');
      const paper={id:crypto.randomUUID(),title,author:typeof md.Author==='string'&&md.Author.trim()?md.Author.slice(0,200):'Uploaded paper',year:'',tags:['Study design','Findings'],added:Date.now(),blob:file,size:file.size,pages:parsed.pages,chats:[]};
      state.papers.push(paper);pdfCache.set(paper.id,parsed.doc);state.selected=paper.id;await persist('papers',paper);added++;
    }catch(error){errors.push(`${file.name}: ${error.name==='PasswordException'?'This PDF is password-protected. Upload an unlocked copy.':error.name==='InvalidPDFException'?'This file is not a valid PDF.':error.message}`);}
  }
  state.busy=false;state.loading=false;state.view='workspace';state.tab='overview';state.page=1;state.draft='';render();
  if(errors.length){status.className='upload-status error';status.textContent=(added?`${added} paper(s) added. `:'')+errors.join(' ');}else{modal.close();toast(`${added} ${added===1?'paper is':'papers are'} ready to explore.`);}
}
async function ask(question){
  const p=current();const q=question.trim();if(!q || state.loading || !p?.pages.length)return;
  const result=retrieve(p.pages,q,4);
  const text=result.evidence.length?`${result.intent==='limitations'?'These passages may help identify limitations or open questions; a dedicated limitations statement is not guaranteed.':'Here are the passages most relevant to your question.'} These are excerpts from the paper, not a generated interpretation.`:result.reason;
  p.chats ||= [];p.chats.push({role:'user',text:q},{role:'assistant',text,evidence:result.evidence,question:q});state.draft='';render();await persist('papers',p);
}
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4000);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard.');}catch{showModal('Copy this text',`<textarea aria-label="Text to copy" style="width:100%;min-height:200px;padding:12px;border:1px solid #dbe4d5;border-radius:6px">${esc(text)}</textarea>`);}}
function answerText(m){return `${m.question}\n\n${m.text}\n\n${(m.evidence || []).map(e=>`“${e.excerpt}”\n[PDF p. ${e.page} · ${e.section}]`).join('\n\n')}`;}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function cite(){const p=current();const citation=p.demo?'Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., & Liang, P. (2024). Lost in the Middle: How Language Models Use Long Contexts. Transactions of the Association for Computational Linguistics, 12, 157–173. https://doi.org/10.1162/tacl_a_00638':`${p.author}. ${p.title}. [Uploaded PDF; verify author, date, and publication metadata before citing.]`;showModal('Keep the source close',`<p>${p.demo?'APA-style reference for this example paper.':'A reference draft from PDF metadata. Complete and verify it before use.'}</p><div class="citation-box">${esc(citation)}</div><button class="primary" data-action="copy-citation" data-text="${esc(citation)}">${icon('copy')}Copy reference</button>`);}
function help(){showModal('A closer look at ResearchBuddy',`<p>A calm space to read academic papers and explore the evidence behind their ideas.</p><div class="help-row">${icon('upload')}<div><h3>Start with a paper</h3><p>Upload text-based PDFs up to 25 MB and 300 pages. Scanned documents need an OCR text layer first.</p></div></div><div class="help-row">${icon('search')}<div><h3>Ask, then follow the evidence</h3><p>This version uses local keyword retrieval and extractive answers. It does not use a generative language model. A passage can be relevant without fully answering your question. Check the original PDF.</p></div></div><div class="help-row">${icon('bookmark')}<div><h3>Keep your discoveries</h3><p>Save evidence to notes, add your own thoughts, and export them as Markdown. Citations refer to PDF page numbers, which may differ from printed journal pages.</p></div></div><div class="help-row">${icon('lock')}<div><h3>Your library lives here</h3><p>Papers, conversations, and notes stay in this browser’s local storage. Clearing browser data removes them. There is no account sync; download your files and notes to keep a backup.</p></div></div>`);}
async function handleAction(action,el){
  const p=current();
  switch(action){
    case 'workspace':case 'library':case 'notes':state.view=action;state.sidebar=false;render();break;
    case 'menu':state.sidebar=!state.sidebar;render();break;
    case 'close-sidebar':state.sidebar=false;render();break;
    case 'select':state.selected=el.dataset.id;state.view='workspace';state.tab='overview';state.page=1;state.sidebar=false;state.draft='';render();break;
    case 'tab':state.tab=el.dataset.tab;render();break;
    case 'upload':uploadDialog();break;
    case 'choose-files':document.querySelector('#file-input')?.click();break;
    case 'process-files':{const input=document.querySelector('#file-input');if(input?.files.length)await handleFiles(input.files);else toast('Choose at least one PDF first.');break;}
    case 'close-modal':if(state.busy)toast('Your paper is still being read.');else modal.close();break;
    case 'restore-demo':case 'retry':await loadDemo();break;
    case 'ask':await ask(el.dataset.question);break;
    case 'source':state.tab='reader';state.page=Number(el.dataset.page);render();document.querySelector('.panel-tabs')?.scrollIntoView({behavior:'smooth',block:'nearest'});break;
    case 'note-source':if(!state.papers.some(paper=>paper.id===el.dataset.id)){toast('The source paper is no longer in your library.');break;}state.selected=el.dataset.id;state.view='workspace';state.tab='reader';state.page=Number(el.dataset.page);render();break;
    case 'next-page':state.page++;render();break;
    case 'prev-page':state.page--;render();break;
    case 'help':help();break;
    case 'citation':cite();break;
    case 'copy-citation':await copy(el.dataset.text);break;
    case 'copy-answer':await copy(answerText(p.chats[Number(el.dataset.index)]));break;
    case 'save-answer':{
      const m=p.chats[Number(el.dataset.index)];
      if(state.notes.some(n=>n.paperId===p.id && n.title===m.question && n.text===m.evidence.map(e=>e.excerpt).join('\n\n'))){toast('This answer is already in your notes.');break;}
      const note={id:crypto.randomUUID(),paperId:p.id,paperTitle:p.title,title:m.question,text:m.evidence.map(e=>e.excerpt).join('\n\n'),pages:[...new Set(m.evidence.map(e=>e.page))],created:Date.now()};state.notes.push(note);await persist('notes',note);render();toast('Evidence saved to your notes.');break;
    }
    case 'delete-note':{const id=el.dataset.id;const note=state.notes.find(n=>n.id===id);if(!note)break;showModal('Remove this note?',`<p>“${esc(note.title)}” will be removed from this browser.</p><div class="modal-actions"><button class="secondary" data-action="close-modal">Keep note</button><button class="secondary danger" data-action="confirm-delete-note" data-id="${esc(id)}">Remove note</button></div>`);break;}
    case 'confirm-delete-note':state.notes=state.notes.filter(n=>n.id!==el.dataset.id);await persist('notes',el.dataset.id,true);modal.close();render();toast('Note removed.');break;
    case 'sort':state.sort=state.sort==='recent'?'title':'recent';render();break;
    case 'download':if(p?.blob)downloadBlob(p.blob,`${p.title.replace(/[^\p{L}\p{N} ._-]/gu,'').slice(0,120)}.pdf`);else toast('The PDF is still loading.');break;
    case 'export-notes':{const content='# ResearchBuddy — Research notes\n\n'+state.notes.map(n=>`## ${n.title}\n\nSource: ${n.paperTitle}\n\n${n.text}\n\n${n.pages?.length?'PDF pages: '+n.pages.join(', '):''}\n`).join('\n---\n\n');downloadBlob(new Blob([content],{type:'text/markdown;charset=utf-8'}),'researchbuddy-notes.md');break;}
    case 'paper-menu':showModal('Paper options',`<p>${esc(p.title)}</p><div class="nav-group"><button class="nav-item" data-action="citation">${icon('quote')}Copy a reference</button><button class="nav-item" data-action="download">${icon('download')}Download original PDF</button><button class="nav-item" data-action="clear-chat">${icon('text')}Start a new conversation</button><button class="nav-item danger" data-action="remove-paper">${icon('trash')}Remove from library</button></div>`);break;
    case 'clear-chat':showModal('Start a fresh conversation?',`<p>This clears the conversation for this paper. Saved notes are kept.</p><div class="modal-actions"><button class="secondary" data-action="close-modal">Keep conversation</button><button class="primary" data-action="confirm-clear-chat">Start fresh</button></div>`);break;
    case 'confirm-clear-chat':p.chats=[];await persist('papers',p);modal.close();render();break;
    case 'remove-paper':showModal('Remove this paper?',`<p>This removes the PDF and its conversation from this browser. Saved notes are kept, but their page links will no longer open.</p><div class="modal-actions"><button class="secondary" data-action="close-modal">Keep paper</button><button class="secondary danger" data-action="confirm-remove">Remove paper</button></div>`);break;
    case 'confirm-remove':state.papers=state.papers.filter(x=>x.id!==p.id);await persist('papers',p.id,true);if(p.demo)await persist('settings',{id:'demo-removed',value:true});await pdfCache.get(p.id)?.destroy();pdfCache.delete(p.id);state.selected=state.papers.at(-1)?.id;state.tab='overview';state.page=1;state.draft='';modal.close();render();toast('Paper removed from this browser.');break;
  }
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el){event.preventDefault();handleAction(el.dataset.action,el).catch(()=>toast('That action couldn’t be completed. Please try again.'));}else if(event.target.closest('#modal-drop'))document.querySelector('#file-input')?.click();});
document.addEventListener('input',event=>{if(event.target.id==='question')state.draft=event.target.value;if(event.target.id==='library-search'){state.search=event.target.value;const position=event.target.selectionStart;render();const search=document.querySelector('#library-search');search.focus();try{search.setSelectionRange(position,position);}catch{}}});
document.addEventListener('change',event=>{if(event.target.id==='page-input'){state.page=Math.max(1,Math.min(current().pages.length,Number(event.target.value)||1));render();}});
document.addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.target.id==='question-form')await ask(document.querySelector('#question').value);
  if(event.target.id==='page-form'){state.page=Number(document.querySelector('#page-input').value)||1;render();}
  if(event.target.id==='note-form'){const text=document.querySelector('#note-text').value.trim();if(!text){toast('Write a thought before saving it.');return;}const p=current();const note={id:crypto.randomUUID(),paperId:p.id,paperTitle:p.title,title:text.split('\n')[0].slice(0,80),text,pages:[],created:Date.now()};state.notes.push(note);await persist('notes',note);render();toast('Note added.');}
});
document.addEventListener('keydown',event=>{if(event.target.id==='question' && event.key==='Enter' && !event.shiftKey){event.preventDefault();ask(event.target.value);}if(event.target.id==='modal-drop' && ['Enter',' '].includes(event.key)){event.preventDefault();document.querySelector('#file-input')?.click();}});
for(const name of ['dragenter','dragover'])document.addEventListener(name,event=>{if(!event.dataTransfer.types.includes('Files'))return;event.preventDefault();event.target.closest('#dropzone,#modal-drop')?.classList.add('dragging');});
document.addEventListener('dragleave',event=>event.target.closest('#dropzone,#modal-drop')?.classList.remove('dragging'));
document.addEventListener('drop',event=>{event.preventDefault();document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));if(event.dataTransfer.files.length)handleFiles(event.dataTransfer.files);});
modal.addEventListener('cancel',event=>{if(state.busy)event.preventDefault();});

async function init(){
  state.papers=[{...demo,chats:[]}];render();
  try{db=await openDb();const [papers,notes,settings]=await Promise.all([readAll('papers'),readAll('notes'),readAll('settings')]);state.papers=papers;state.notes=notes;if(!papers.length && !settings.find(s=>s.id==='demo-removed'&&s.value)){await loadDemo();return;}state.selected=papers.at(-1)?.id;for(const paper of papers){if(paper.blob && !paper.pages[0]?.bodyText){const parsed=await parsePdf(paper.blob);paper.pages=parsed.pages;pdfCache.set(paper.id,parsed.doc);await persist('papers',paper);}}}
  catch{await loadDemo();state.error='Browser storage is unavailable. You can still explore papers for this session, but changes will not persist.';render();return;}
  state.loading=false;render();
}
init();
