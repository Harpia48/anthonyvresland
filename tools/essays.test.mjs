import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeFeed,renderArticles,text,CATEGORIES,queryOptions,renderJournal,selectFeatured,PAGE_SIZE} from '../assets/essays-feed.mjs';
import {onRequestGet} from '../functions/api/essays.js';
const entry=(title='',content='<p><b>Kollyva</b>: The Offering at the Gates of Hades</p>')=>({title:{$t:title},content:{$t:content},published:{$t:'2026-11-03T07:27:14Z'},link:[{rel:'alternate',href:'https://fatlots.blogspot.com/2026/11/kollyva.html'}]});
test('recovers a body title without hardcoding Kollyva',()=>{
  assert.equal(normalizeFeed({feed:{entry:[entry()]}})[0].title,'Kollyva: The Offering at the Gates of Hades');
  assert.equal(normalizeFeed({feed:{entry:[entry('', '<h2>A Different Reflection</h2><p>Body text</p>')]}})[0].title,'A Different Reflection');
  assert.equal(normalizeFeed({feed:{entry:[entry('An Explicit Title')]}})[0].title,'An Explicit Title');
  assert.equal(normalizeFeed({feed:{entry:[entry('', '')]}})[0].title,'kollyva');
});
test('rejects drafts, invalid dates and unsafe destinations',()=>{
  const draft={...entry(),'app$control':{'app$draft':{$t:'yes'}}};
  const unsafe={...entry(),link:[{rel:'alternate',href:'https://evil.example/post'}]};
  const badDate={...entry(),published:{$t:'not a date'}};
  assert.deepEqual(normalizeFeed({feed:{entry:[draft,unsafe,badDate]}}),[]);
});
test('orders newest first and deduplicates posts',()=>{
  const old={...entry('Old'),published:{$t:'2025-01-01'},link:[{rel:'alternate',href:'https://fatlots.blogspot.com/old.html'}]};
  const a=normalizeFeed({feed:{entry:[old,entry('New'),entry('New')]}});
  assert.deepEqual(a.map(x=>x.title),['New','Old']);
});
test('escapes unsafe text and handles no images or no entries',()=>{
  const a=normalizeFeed({feed:{entry:[entry('&lt;img src=x onerror=alert(1)&gt;','<p>A short description for this reflection about ancient wisdom.</p>')]}});
  assert.equal(a[0].image,null);
  assert.ok(!renderArticles(a).includes('<img src=x'));
  assert.match(renderArticles(a),/&lt;img/);
  assert.equal(text('Pythagoras &amp; Plato &#x2014; &#945;'),'Pythagoras & Plato — α');
  assert.deepEqual(normalizeFeed({feed:{}}),[]);
  assert.throws(()=>normalizeFeed({}));
});
test('outage preserves the metadata snapshot',async()=>{
  const saved=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('outage')};
  try{
    const response=await onRequestGet({request:new Request('https://anthonyvresland.com/api/essays'),env:{ASSETS:{fetch:async()=>new Response(await readFile('data/essays.json'))}},waitUntil:()=>{}});
    const body=await response.json();
    assert.equal(body.status,'unavailable');assert.equal(body.articles.length,2);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  }finally{globalThis.fetch=saved;}
});
test('editorial categories come only from matching Blogger labels',()=>{
  const plain=normalizeFeed({feed:{entry:[entry('Plato and Philosophy')]}})[0];
  assert.deepEqual(plain.labels,[]);assert.deepEqual(plain.categories,[]);
  const labelled={...entry('Notebook'),category:[{scheme:'http://www.blogger.com/atom/ns#',term:'Author’s Notebook'},{term:'Plato'}]};
  const a=normalizeFeed({feed:{entry:[labelled]}})[0];
  assert.deepEqual(a.categories,['notebook']);assert.deepEqual(a.labels,['Author’s Notebook','Plato']);
  assert.equal(CATEGORIES.length,5);
});
test('newest major essay is featured; news and unlabeled essays remain chronological',()=>{
  const a=[{title:'News',published:'2026-11-04',isNews:true},{title:'Newest essay',published:'2026-11-03'},{title:'Older major',published:'2026-11-02',major:true},{title:'Oldest major',published:'2026-11-01',major:true}];
  assert.equal(selectFeatured(a).title,'Older major');
  assert.equal(selectFeatured(a.filter(x=>!x.major)).title,'Newest essay');
});
test('category filtering, search, and archive cursors reach the upstream feed',async()=>{
  const saved=globalThis.fetch;const urls=[];
  globalThis.fetch=async value=>{
    const u=new URL(value);urls.push(u);
    if(u.pathname.includes('/-/')&&!u.pathname.includes('Mythology'))return Response.json({feed:{entry:[]}});
    const entries=Array.from({length:PAGE_SIZE+1},(_,i)=>({...entry('Reflection '+i),link:[{rel:'alternate',href:`https://fatlots.blogspot.com/reflection-${i}.html`}]}));
    return Response.json({feed:{entry:entries,'openSearch$totalResults':{$t:'40'}}});
  };
  try{
    const response=await onRequestGet({request:new Request('https://anthonyvresland.com/api/essays?category=mythology&q=Homer&start=13'),env:{},waitUntil:()=>{}});
    const body=await response.json();
    assert.equal(body.status,'live');assert.equal(body.articles.length,PAGE_SIZE);assert.equal(body.hasMore,true);assert.equal(body.total,40);
    const u=urls.find(u=>u.pathname.includes('Mythology'));
    assert.equal(decodeURIComponent(u.pathname),'/feeds/posts/default/-/Mythology Decoded');assert.equal(u.searchParams.get('q'),'Homer');assert.equal(u.searchParams.get('start-index'),'13');
    const markup=renderJournal(body,queryOptions('https://example.com/essays?category=mythology&q=Homer&start=13'));
    assert.match(markup,/start=25/);assert.match(markup,/category=mythology/);assert.match(markup,/aria-current="page"/);assert.match(markup,/Latest News/);
  }finally{globalThis.fetch=saved;}
});
test('invalid queries cannot select arbitrary upstream labels or unbounded cursors',()=>{
  assert.deepEqual(queryOptions('https://example.com/essays?category=unsafe&start=-1'),{category:'',q:'',start:1});
  assert.equal(queryOptions('https://example.com/essays?q='+('a'.repeat(1000))).q.length,150);
});
