import {FEED_URL, normalizeFeed, queryOptions, CATEGORIES, PAGE_SIZE, NEWS_LABELS, selectFeatured} from '../../assets/essays-feed.mjs';

function upstreamURL(options={},label='',limit=PAGE_SIZE+1) {
  const url=new URL(FEED_URL);
  if(label) url.pathname='/feeds/posts/default/-/'+encodeURIComponent(label);
  url.searchParams.set('max-results',String(limit));
  url.searchParams.set('start-index',String(options.start||1));
  if(options.q)url.searchParams.set('q',options.q);
  return url;
}
async function retrieve(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
  if(response.status===404&&new URL(url).pathname.includes('/-/'))return {feed:{entry:[]}};
  if(!response.ok)throw new Error('Blogger feed unavailable');
  return response.json();
}
export async function onRequestGet(context) {
  const options=queryOptions(context.request.url);
  const keyURL=new URL('/api/essays',context.request.url);
  keyURL.search=new URLSearchParams({category:options.category,q:options.q,start:String(options.start)}).toString();
  const key=new Request(keyURL);
  const cache=globalThis.caches?.default;
  const cached=await cache?.match(key);
  if(cached)return cached;
  let snapshot={articles:[],news:[]};
  async function getSnapshot(){
    try{const r=await context.env.ASSETS.fetch(new URL('/data/essays.json',context.request.url));if(r.ok)snapshot=await r.json();}catch{}
    return snapshot;
  }
  try {
    const category=CATEGORIES.find(c=>c.id===options.category);
    const [feed,newsResults,majorResults]=await Promise.all([
      retrieve(upstreamURL(options,category?.label)),
      Promise.allSettled(NEWS_LABELS.map(label=>retrieve(upstreamURL({},label,3)))),
      !options.category&&!options.q&&options.start===1 ? Promise.allSettled(['Featured','Major Essay'].map(label=>retrieve(upstreamURL({},label,1)))) : []
    ]);
    const entries=normalizeFeed(feed);
    const articles=entries.slice(0,PAGE_SIZE);
    const rawTotal=Number(feed.feed['openSearch$totalResults']?.$t);
    const total=Number.isFinite(rawTotal)?rawTotal:articles.length;
    const news=normalizeFeed({feed:{entry:newsResults.flatMap(r=>r.status==='fulfilled'?(r.value.feed?.entry||[]):[])}}).slice(0,3);
    const newsUnavailable=newsResults.some(r=>r.status==='rejected');
    if(newsUnavailable){const saved=await getSnapshot();for(const a of saved.news||[])if(!news.some(n=>n.url===a.url))news.push(a);news.sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));news.splice(3);}
    const majorArticles=normalizeFeed({feed:{entry:majorResults.flatMap(r=>r.status==='fulfilled'?(r.value.feed?.entry||[]):[])}});
    const result=Response.json({articles,news,featured:selectFeatured([...majorArticles,...articles]),total,hasMore:entries.length>PAGE_SIZE,status:'live',newsUnavailable,retrievedAt:new Date().toISOString()},
      {headers:{'Cache-Control':'public, max-age=900','X-Content-Type-Options':'nosniff'}});
    if(cache)context.waitUntil(cache.put(key,result.clone()));
    return result;
  } catch {
    const saved=await getSnapshot();
    const filtered=(saved.articles||[]).filter(a=>(!options.category||a.categories?.includes(options.category))&&(!options.q||(a.title+' '+a.description).toLowerCase().includes(options.q.toLowerCase())));
    return Response.json({...saved,articles:filtered.slice(options.start-1,options.start-1+PAGE_SIZE),featured:selectFeatured(filtered),total:filtered.length,hasMore:filtered.length>=options.start+PAGE_SIZE,status:'unavailable'},
      {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
}
