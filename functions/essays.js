import {onRequestGet as getFeed} from './api/essays.js';
import {renderJournal, structuredData, escapeHTML, queryOptions} from '../assets/essays-feed.mjs';

export async function onRequestGet(context) {
  const [template, feed] = await Promise.all([
    context.env.ASSETS.fetch(new URL('/essays.html',context.request.url)),
    getFeed(context).then(r=>r.json())
  ]);
  if(!template.ok) return template;
  const status = feed.status === 'live' ? '' : 'Live updates are temporarily unavailable. Previously retrieved essays are shown below; the journal on Blogger may have newer posts.';
  const html = (await template.text())
    .replace(/<!-- essays:start -->[\s\S]*?<!-- essays:end -->/,()=> '<!-- essays:start -->'+renderJournal(feed,queryOptions(context.request.url))+'<!-- essays:end -->')
    .replace(/(<p id="feed-status"[^>]*>)[\s\S]*?(<\/p>)/,(_,a,b)=>a+escapeHTML(status)+b)
    .replace(/(<script id="essay-schema"[^>]*>)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(structuredData([...new Map([feed.featured,...feed.articles,...(feed.news||[])].filter(Boolean).map(a=>[a.url,a])).values()])).replace(/</g,'\\u003c')+b);
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
}
