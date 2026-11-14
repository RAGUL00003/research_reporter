const STOP = new Set('a an the is are was were be been being how what which who why when where do does did can could would should will may might of in on at to from for with by and or but as it its this that these those we you your our their they i me about tell explain please paper study research give summarize summary main key specific work used use say discussed discuss question questions'.split(' '));
const stem = word => word.replace(/ies$/, 'y').replace(/s$/, '').replace(/(ing|ed)$/, '');
export function tokens(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(x => x.length > 2 && !STOP.has(x)).map(stem);
}
const INTENTS = {
  methodology: { query: /method|approach|experiment|design|dataset|data set|evaluat|conduct|protocol/i, terms: 'method experiment evaluate evaluation dataset task model setup protocol benchmark train', label: 'Methodology' },
  findings: { query: /finding|result|discover|conclusion|takeaway|contribut|summary|summarize|overview/i, terms: 'result find performance show observe conclude conclusion demonstrate', label: 'Key findings' },
  limitations: { query: /limit|weakness|caveat|shortcoming|future work|drawback/i, terms: 'limitation limited future caveat drawback fail degradation degrade however cannot constraint', label: 'Limitations & open questions' }
};
export function detectIntent(query) { return Object.entries(INTENTS).find(([,v]) => v.query.test(query))?.[0] || 'question'; }
export function cleanText(text) { return text.replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
export function extractPageText(items) {
  const weights=new Map();
  for(const item of items)if(item.str?.trim() && item.height>0){const height=Math.round(item.height*2)/2;weights.set(height,(weights.get(height)||0)+item.str.length);}
  const bodySize=[...weights].sort((a,b)=>b[1]-a[1])[0]?.[0]||10;
  let text='',bodyText='';
  for(const item of items)if('str'in item){const value=item.str+(item.hasEOL?'\n':' ');text+=value;if(!item.str.trim() || item.height>=bodySize*.86)bodyText+=value;}
  return {text:cleanText(text),bodyText:cleanText(bodyText)};
}
function isHeading(line){
  if(/^(Abstract|References|Acknowledgments|Limitations|Conclusion|Discussion|Introduction|Appendix [A-Z])$/i.test(line))return true;
  const match=line.match(/^\d+(?:\.\d+)*\s+([A-Z][A-Za-z ?:&–-]{2,90})$/);
  if(!match)return false;
  const words=match[1].split(/\s+/).filter(w=>w.length>3);
  return !/^(We|Since|See|For|There|This|These)\b/.test(match[1]) && (words.length===0 || words.filter(w=>/^[A-Z]/.test(w)).length/words.length>=.6 || /^(Materials and methods|Results and discussion|Experimental setup|Related work|Future work)$/i.test(match[1]));
}
export function splitPassages(pages) {
  const passages = [];
  let section = 'Introduction';
  let parentSection = '';
  for (const page of pages) {
    const lines = cleanText(page.bodyText || page.text).split('\n').map(x=>x.trim()).filter(Boolean);
    let buffer = '';
    function flush() {
      if (buffer.length > 70) passages.push({ page: page.number, section, text: buffer.replace(/\s+/g, ' ').trim() });
      buffer = '';
    }
    for (const line of lines) {
      const heading = isHeading(line);
      if (heading) { flush(); if(/^\d+\s/.test(line))parentSection=line; section=/^\d+\./.test(line)&&parentSection?`${parentSection} · ${line}`:line; continue; }
      if (/^\d{1,4}$/.test(line) || /^https?:\/\//.test(line)) continue;
      buffer += (buffer ? ' ' : '') + line;
      if (buffer.length > 550 && /[.!?]$/.test(line) && !/\bet al\.$/.test(line)) flush();
      if (buffer.length > 2400) flush();
    }
    flush();
  }
  return passages;
}
export function retrieve(pages, query, limit = 4) {
  const passages = splitPassages(pages);
  const intent = detectIntent(query);
  const explicitPage = query.match(/\bpage\s+(\d+)\b/i);
  const pageNumber = explicitPage ? Number(explicitPage[1]) : null;
  if (pageNumber && !pages.some(p=>p.number===pageNumber)) return { intent, evidence: [], reason: `This paper has ${pages.length} PDF pages. Page ${pageNumber} is outside the document.` };
  const base = tokens(query.replace(/page\s+\d+/gi, ''));
  const expanded = [...new Set([...base, ...tokens(INTENTS[intent]?.terms || '')])];
  const generic=new Set(tokens(Object.values(INTENTS).map(v=>v.terms).join(' ')+' methodology findings limitations open'));
  const focused=base.filter(t=>!generic.has(t));
  const frequencies = new Map(expanded.map(t=>[t, passages.filter(p=>new Set(tokens(p.text)).has(t)).length]));
  const averageLength=passages.reduce((sum,p)=>sum+tokens(p.text).length,0)/Math.max(passages.length,1);
  const ranked = passages.filter(p=>!pageNumber || p.page===pageNumber).map(p=>{
    const ts=tokens(p.text), unique=new Set(ts), heading=new Set(tokens(p.section));
    let score = 0, matched = 0;
    for (const term of expanded) if (unique.has(term) || heading.has(term)) {
      const idf = Math.log(1 + (passages.length + 1) / (1 + (frequencies.get(term) || 0)));
      const tf=ts.filter(t=>t===term).length || .5;
      score += idf * (base.includes(term) ? 1.7 : 1) * (heading.has(term) ? 1.6 : 1) * (tf*2.2/(tf+1.2*(.25+.75*ts.length/averageLength)));
      if (base.includes(term)) matched++;
    }
    if (/reference|acknowledg|bibliography/i.test(p.section)) score *= 0.08;
    if (/related work/i.test(p.section) && intent!=='question') score *= .2;
    if(intent==='methodology'){
      if(/method|experiment|setup|dataset|material|procedure/i.test(p.section))score*=2.8;
      if(/conclusion|related work|result/i.test(p.section))score*=.35;
    }
    if(intent==='findings' && /result|discussion|conclusion|abstract/i.test(p.section))score*=1.5;
    if(intent==='limitations' && /limitation|future work|caveat|constraint|we leave|we do not/i.test(p.text))score*=2.8;
    const focusedMatches=focused.filter(t=>unique.has(t)||heading.has(t)).length;
    if(focused.length && focusedMatches<Math.ceil(focused.length*.6))score=0;
    if (pageNumber) score += 2;
    return { ...p, score, matched };
  }).filter(p=>p.score>1 && (intent!=='question' || p.matched>0 || pageNumber)).sort((a,b)=>b.score-a.score);
  const evidence=[];
  for (const item of ranked) {
    if (evidence.length>=limit) break;
    if (evidence.filter(e=>e.section===item.section).length >= 1) continue;
    if (intent==='question' && base.length>=3 && item.matched < Math.min(2,base.length)) continue;
    evidence.push({...item, excerpt: excerpt(item.text, expanded, intent)});
  }
  return { intent, evidence, reason: evidence.length ? '' : 'I couldn’t find enough relevant evidence in this paper to answer that. Try a term used in the document, a PDF page number, or a more specific question.' };
}
function excerpt(text, queryTokens, intent) {
  const raw=Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(text),s=>s.segment.trim());
  const joined=[];
  for(const sentence of raw){if(joined.length && /(?:\bet al|\be\.g|\bi\.e|\bFig)\.$/.test(joined.at(-1)))joined[joined.length-1]+=' '+sentence;else joined.push(sentence);}
  const sentences=joined.filter(s=>s.length>60 && /^[A-Z“]/.test(s));
  if (!sentences.length) return text;
  const best = sentences.map((s,i)=>({s,i,score: [...new Set(tokens(s))].filter(t=>queryTokens.includes(t)).length + (/^We |^Our |^In (our|the) /i.test(s)?1:0) + (intent==='limitations' && /limitation|future work|caveat|constraint|we leave|cannot|fail/i.test(s)?5:0)})).sort((a,b)=>b.score-a.score)[0];
  return best.s.length>650 ? best.s.slice(0,647)+'…' : best.s;
}
export function overview(pages) {
  const lines=(pages[0]?.bodyText || pages[0]?.text || '').split('\n').map(line=>line.trim());
  const start=lines.findIndex(line=>/^Abstract$/i.test(line));
  const abstractLines=[];
  if(start>=0)for(const line of lines.slice(start+1)){if(isHeading(line))break;abstractLines.push(line);}
  const abstract = cleanText(abstractLines.join('\n')).replace(/\s+/g,' ').slice(0,1800);
  return { abstract, findings: retrieve(pages,'What are the key findings?',3).evidence, methods: retrieve(pages,'What methodology and evaluation tasks are used?',2).evidence };
}
