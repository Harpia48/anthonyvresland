export const FEED_URL = 'https://fatlots.blogspot.com/feeds/posts/default?alt=json&max-results=100&orderby=published';
export const PAGE_SIZE = 12;
export const CATEGORIES = [
  {id:'philosophy',label:'Philosophy & Ancient Wisdom'},
  {id:'mythology',label:'Mythology Decoded'},
  {id:'research',label:'Research & Discoveries'},
  {id:'notebook',label:"Author's Notebook"},
  {id:'academy',label:'The Academy'}
];
export const NEWS_LABELS = ['News','Book Announcement','Author Update'];
export const labelKey = value => text(value).replace(/[’‘]/g,"'").toLowerCase();
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',hellip:'…'};
export function text(html = '') {
  return String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(all,key)=>{
    if(key[0] !== '#') return entities[key.toLowerCase()] ?? all;
    const n = key[1].toLowerCase()==='x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  }).replace(/\s+/g,' ').replace(/\s+([:;,!?])/g,'$1').trim();
}
function safeURL(value, image = false) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password &&
      (image ? ['blogger.googleusercontent.com','1.bp.blogspot.com','2.bp.blogspot.com','3.bp.blogspot.com','4.bp.blogspot.com'].includes(u.hostname) : u.hostname === 'fatlots.blogspot.com') ? u.href : null;
  } catch { return null; }
}
export function normalizeFeed(data) {
  if (!data?.feed || (data.feed.entry !== undefined && !Array.isArray(data.feed.entry))) throw new Error('Invalid Blogger feed');
  const articles = (data.feed.entry ?? []).flatMap(entry => {
    if(entry['app$control']?.['app$draft']?.$t === 'yes') return [];
    const url = safeURL(entry.link?.find(l=>l.rel==='alternate' && (!l.type || l.type==='text/html'))?.href);
    const published = entry.published?.$t;
    if(!url || !published || !Number.isFinite(Date.parse(published))) return [];
    const content = entry.content?.$t ?? entry.summary?.$t ?? '';
    const blocks = [...content.matchAll(/<(h[1-6]|p|div)\b[^>]*>([\s\S]*?)<\/\1>/gi)].flatMap(m=>m[2].split(/<br\s*\/?\s*>/gi)).map(text).filter(Boolean);
    const heading = content.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    // Blogger permits untitled posts. Recover human-authored headings before a URL-slug fallback.
    const candidate = blocks.find(s=>s.length>=8 && s.length<=180 && !/^by\s/i.test(s));
    const slug = new URL(url).pathname.split('/').pop().replace(/\.html$/,'').replace(/-/g,' ');
    const originalTitle = text(entry.title?.$t);
    const title = originalTitle || text(heading?.[1]) || candidate || slug || 'Untitled reflection';
    const source = originalTitle ? 'feed' : heading ? 'content-heading' : candidate ? 'content-block' : 'permalink';
    const img = content.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
    const alt = content.match(/<img\b[^>]*\balt\s*=\s*["']([^"']*)["']/i);
    const image = safeURL(text(img?.[1] || entry['media$thumbnail']?.url || ''),true);
    const isKollyva = /kollyva/i.test(title) && /gates.of.hades/i.test(title);
    const subtitle = isKollyva ? 'From Cerberus and Charon to the Ancient Greek Mystery of Remembrance.' : '';
    const body = blocks.filter(s=>s!==title && !/^by\s/i.test(s) && !s.startsWith('From Cerberus'));
    const description = isKollyva ? 'An offering of wheat, an act of remembrance: tracing the ancient Greek mysteries behind a living tradition.' : (body.find(s=>s.length>=45) || 'A reflection on ancient wisdom and the human soul.').slice(0,220);
    const labels = [...new Set((entry.category??[]).filter(c=>c.scheme==='http://www.blogger.com/atom/ns#'||!c.scheme).map(c=>text(c.term)).filter(Boolean))];
    const categories = CATEGORIES.filter(c=>labels.some(l=>labelKey(l)===labelKey(c.label))).map(c=>c.id);
    const isNews = labels.some(l=>NEWS_LABELS.some(n=>labelKey(l)===labelKey(n)));
    const major = labels.some(l=>['featured','major essay'].includes(labelKey(l)));
    return [{labels,categories,isNews,major,title,url,published,image,alt:text(alt?.[1]) || `Illustration accompanying “${title}”`,subtitle,description,titleSource:source,isKollyva}];
  });
  return [...new Map(articles.sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).map(a=>[a.url,a])).values()];
}
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function renderCard(a, featured=false) {
  const e = escapeHTML;
  const date = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Athens'}).format(new Date(a.published));
  return `<article class="essay-card${featured?' essay-featured':''}">${a.image?`<div class="essay-image"><img src="${e(a.image)}" alt="${e(a.alt)}" ${featured?'fetchpriority="high"':'loading="lazy"'} decoding="async"></div>`:''}<div class="essay-copy"><p class="essay-kicker">${featured?'Featured reflection · ':''}<time datetime="${e(a.published)}">${date}</time></p><h${featured?'2':'3'}>${e(a.title)}</h${featured?'2':'3'}>${a.labels?.length?`<ul class="essay-labels" aria-label="Blogger labels">${a.labels.map(label=>`<li>${e(label)}</li>`).join('')}</ul>`:''}${a.subtitle?`<p class="essay-subtitle">${e(a.subtitle)}</p>`:''}<p class="essay-description">${e(a.description)}</p><a class="essay-read" href="${e(a.url)}" aria-label="${e('Read Essay: '+a.title)}">Read Essay <span aria-hidden="true">↗</span></a></div></article>`;
}
export function queryOptions(url) {
  const params=new URL(url).searchParams;
  const category=CATEGORIES.some(c=>c.id===params.get('category'))?params.get('category'):'';
  const q=(params.get('q')||'').trim().slice(0,150);
  const raw=Number(params.get('start')||1);
  const start=Number.isInteger(raw)&&raw>=1&&raw<=100000?raw:1;
  return {category,q,start};
}
export function journalURL(options={}) {
  const p=new URLSearchParams();
  if(options.category)p.set('category',options.category);
  if(options.q)p.set('q',options.q);
  if(options.start>1)p.set('start',options.start);
  return '/essays'+(p.size?'?'+p:'');
}
export function selectFeatured(articles) {
  const candidates=[...articles].filter(a=>!a.isNews).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));
  return candidates.find(a=>a.major)||candidates[0]||null;
}
export function renderArticles(articles) {
  const featured=selectFeatured(articles);
  return (featured?renderCard(featured,true):'')+'<div class="essays-grid">'+articles.filter(a=>a!==featured).map(a=>renderCard(a)).join('')+'</div>';
}
export function renderJournal(data,options={category:'',q:'',start:1}) {
  const e=escapeHTML;
  const articles=data.articles||[];
  const featured=!options.category&&!options.q&&options.start===1?data.featured:null;
  const rest=articles.filter(a=>a.url!==featured?.url);
  const categoryLinks=[{id:'',label:'All Entries'},...CATEGORIES].map(c=>`<a class="journal-filter${options.category===c.id?' selected':''}" href="${e(journalURL({category:c.id,q:options.q}))}"${options.category===c.id?' aria-current="page"':''}>${e(c.label)}</a>`).join('');
  return `${featured?renderCard(featured,true):''}
<section class="journal-archive" aria-labelledby="journal-heading"><div class="journal-heading"><h2 id="journal-heading">The journal archive</h2><span>Newest first</span></div>
<nav class="journal-filters" aria-label="Filter journal by category">${categoryLinks}</nav>
<form class="journal-search" action="/essays" method="get"><input type="hidden" name="category" value="${e(options.category)}"><label for="journal-query">Search the archive</label><div><input id="journal-query" type="search" name="q" value="${e(options.q)}" maxlength="150" placeholder="Homer, Plato, the human soul…"><button type="submit">Search</button></div></form>
<p class="journal-count">${data.total??articles.length} ${(data.total??articles.length)===1?'entry':'entries'}${options.category?' · '+e(CATEGORIES.find(c=>c.id===options.category)?.label||''):''}${options.q?' matching “'+e(options.q)+'”':''}</p>
${rest.length?'<div class="essays-grid">'+rest.map(a=>renderCard(a)).join('')+'</div>':`<p class="journal-empty">${featured?'More reflections will appear here as they are published.':options.category?'No posts have this Blogger category label yet. Browse All Entries to read unlabelled posts.':options.q?'No entries match your search.':'No entries are available yet.'}</p>`}
<nav class="journal-pagination" aria-label="Archive pages">${options.start>1?`<a href="${e(journalURL({...options,start:Math.max(1,options.start-PAGE_SIZE)}))}">← Newer entries</a>`:''}${data.hasMore?`<a href="${e(journalURL({...options,start:options.start+PAGE_SIZE}))}">Older entries →</a>`:''}</nav></section>
<section class="journal-news" aria-labelledby="news-heading"><div class="journal-heading"><h2 id="news-heading">Latest News</h2><span>Books &amp; author updates</span></div>${data.news?.length?'<div class="essays-grid">'+data.news.map(a=>renderCard(a)).join('')+'</div>':'<p class="journal-empty">Book announcements and author updates will appear here when published in the journal.</p>'}${data.newsUnavailable?'<p role="status">News updates are temporarily unavailable. Visit the journal on Blogger for the latest.</p>':''}</section>`;
}
export function structuredData(articles) {
  return {'@context':'https://schema.org','@type':'CollectionPage',name:'Essays & Journal',url:'https://anthonyvresland.com/essays',author:{'@type':'Person',name:'Anthony Vresland',url:'https://anthonyvresland.com/about'},mainEntity:{'@type':'ItemList',itemListElement:articles.map((a,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'BlogPosting',headline:a.title,url:a.url,mainEntityOfPage:a.url,datePublished:a.published,description:a.description,...(a.image?{image:a.image}:{}),author:{'@type':'Person',name:'Anthony Vresland'}}}))}};
}

