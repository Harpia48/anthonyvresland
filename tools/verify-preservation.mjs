import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Only site navigation and the sitemap may differ in existing files.
const baseline=process.argv[2]||'03d9ed1cdefa5fbc9a0c6c6acaf4dccd9182f8ba';
const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n');
let pages=0,unchanged=0;
for(const name of paths){
  const before=execFileSync('git',['show',baseline+':'+name],{maxBuffer:32*1024*1024});
  const after=await readFile(name);
  if(before.equals(after)){unchanged++;continue;}
  if(name==='sitemap.xml'){
    assert.equal(after.toString().replace(/\s*<url><loc>https:\/\/anthonyvresland.com\/essays<\/loc><\/url>/,'' ).replace(/\r\n/g,'\n'),before.toString().replace(/\r\n/g,'\n'));continue;
  }
  if(name.endsWith('.html')){
    if(name==='mystic.html'){
      assert.equal(after.toString().replace('<a href="/essays" style="margin-left:1.5rem">ESSAYS</a>','').replace(/\r\n/g,'\n'),before.toString().replace(/\r\n/g,'\n'));pages++;continue;
    }
    const strip=s=>s.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi,'').replace(/\r\n/g,'\n');
    assert.equal(strip(after.toString()),strip(before.toString()),`${name}: changed outside navigation`);
    const breadcrumbs=s=>s.match(/<nav\b[^>]*breadcrumb[^>]*>[\s\S]*?<\/nav>/gi)||[];
    assert.deepEqual(breadcrumbs(after.toString()),breadcrumbs(before.toString()),`${name}: breadcrumb changed`);
    for(const nav of after.toString().match(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)||[]){
      if(!/breadcrumb/i.test(nav))assert.match(nav,/href="\/essays"/,`${name}: navigation missing Essays`);
    }
    pages++;continue;
  }
  // Git checkout CRLF normalization is not a content change.
  if(before.toString().replace(/\r\n/g,'\n')===after.toString().replace(/\r\n/g,'\n')){unchanged++;continue;}
  assert.fail(`${name}: unexpected change to existing file`);
}
console.log(`Preserved all ${paths.length} existing files: ${pages} pages/templates have navigation-only changes; other content, scripts, styles and breadcrumbs are unchanged. Sitemap contains only the new route.`);
