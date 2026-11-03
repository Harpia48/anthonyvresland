import {renderJournal, structuredData, queryOptions} from './essays-feed.mjs';
document.querySelector('.mobile-menu-btn').addEventListener('click',()=>{
  const button=document.querySelector('.mobile-menu-btn');
  button.setAttribute('aria-expanded',String(document.getElementById('mobileNav').classList.toggle('open')));
});
function hideFailedImages(){document.querySelectorAll('.essay-image img').forEach(img=>{const hide=()=>img.closest('.essay-image').hidden=true;img.addEventListener('error',hide);if(img.complete&&!img.naturalWidth)hide();});}
hideFailedImages();
async function refresh(){
  try {
    const response=await fetch('/api/essays'+location.search,{signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error();
    const data=await response.json();
    if(data.status!=='live'||!Array.isArray(data.articles))throw new Error();
    if(document.getElementById('essay-articles').contains(document.activeElement))return;
    document.getElementById('essay-articles').innerHTML=renderJournal(data,queryOptions(location.href));
    document.getElementById('essay-schema').textContent=JSON.stringify(structuredData([...new Map([data.featured,...data.articles,...(data.news||[])].filter(Boolean).map(a=>[a.url,a])).values()]));
    document.getElementById('feed-status').textContent='';
    hideFailedImages();
  }catch{document.getElementById('feed-status').textContent='Live updates are temporarily unavailable. Previously retrieved essays are shown below; the journal on Blogger may have newer posts.';}
}
refresh();
// Refresh an open page periodically and when visitors return to it.
setInterval(()=>{if(!document.hidden)refresh();},15*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
