import {readFile,writeFile} from 'node:fs/promises';
import {normalizeFeed,renderJournal,structuredData,selectFeatured} from '../assets/essays-feed.mjs';
const articles=normalizeFeed(JSON.parse(await readFile(process.argv[2],'utf8')));
await writeFile('data/essays.json',JSON.stringify({articles,news:articles.filter(a=>a.isNews).slice(0,3),retrievedAt:new Date().toISOString()},null,2)+'\n');
const home=await readFile('index.html','utf8');
const header=home.match(/<header[\s\S]*?<\/header>/)[0].replace(/ class="active"/g,'').replace(/onclick="toggleMenu\(\)"/,'aria-controls="mobileNav"').replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/g,n=>n.replace('<a href="/essays">ESSAYS</a>','<a href="/essays" class="active" aria-current="page">ESSAYS</a>'));
const schema=JSON.stringify(structuredData(articles)).replace(/</g,'\\u003c');
await writeFile('essays.html',`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Essays &amp; Journal | Anthony Vresland</title>
<meta name="description" content="Explore Anthony Vresland’s essays on ancient Greek philosophy, mythology, Homer, Plato, and the human soul. Read the complete essays on his Blogger journal.">
<link rel="canonical" href="https://anthonyvresland.com/essays">
<meta property="og:type" content="website"><meta property="og:title" content="Essays &amp; Reflections | Anthony Vresland"><meta property="og:description" content="Exploring Ancient Wisdom, Mythology, Philosophy, and the Human Soul."><meta property="og:url" content="https://anthonyvresland.com/essays">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&amp;family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/essays.css"><link rel="icon" href="/assets/sigil-gold.png" type="image/png">
<script id="essay-schema" type="application/ld+json">${schema}</script>
<script type="module" src="/assets/essays.mjs"></script>
</head><body class="essays-page">
<a class="essays-skip" href="#main-content">Skip to content</a>
${header}
<main id="main-content" class="essays-shell" tabindex="-1">
<header class="essays-intro"><p class="essay-eyebrow">Anthony Vresland · Essays &amp; Journal</p><h1>Essays &amp; Reflections</h1><p class="essays-deck">Exploring Ancient Wisdom, Mythology, Philosophy, and the Human Soul.</p><p class="essays-welcome">The ancient world still speaks to the questions we carry. These essays follow its living threads—through Homer’s heroes, Plato’s mysteries, and the rituals of remembrance—to explore what it means to be human.</p></header>
<p id="feed-status" role="status"></p>
<div id="essay-articles"><!-- essays:start -->${renderJournal({articles,news:articles.filter(a=>a.isNews).slice(0,3),featured:selectFeatured(articles),total:articles.length,hasMore:false})}<!-- essays:end --></div>
<p class="journal-source">Published in the <a href="https://fatlots.blogspot.com/">Anthony Vresland journal on Blogger</a>.<br>The complete essays await you there.</p>
<aside class="essays-related" aria-labelledby="further-heading"><div><h2 id="further-heading">Continue the exploration</h2><p>Follow these ideas into the books and the philosophy behind them.</p></div><div class="essays-related-links"><a href="/books">Explore the books</a><a href="/platos-cave">Plato’s Cave</a><a href="/about">About Anthony</a></div></aside>
</main>
<footer class="site-footer"><div class="container"><p>Anthony Vresland</p><p>© 2026 Anthony Vresland — All rights reserved</p></div></footer>
</body></html>`);
console.log(articles.map(a=>({title:a.title,titleSource:a.titleSource,url:a.url})));
