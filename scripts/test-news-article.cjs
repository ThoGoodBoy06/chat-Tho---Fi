const {test} = require('node:test');
const assert = require('node:assert/strict');
const {allowedArticle, extractArticle, createNewsArticleService} = require('../services/news_article.service');
const article = {id:'a'.repeat(24), title:'Fixture title', link:'https://vnexpress.net/example.html', source:'VnExpress'};
const paragraph = 'This is a generated test paragraph with enough text to distinguish a real article from an empty document.';
const fixture = `<article class="fck_detail"><h1>Duplicate headline</h1><p>${paragraph}</p>
<figure><img data-src="https://i1-vnexpress.vnecdn.net/photo.jpg" src="data:image/gif;base64,aaa" width="1200" height="800" alt="Real photo">
<figcaption>Photo credit</figcaption></figure><h2>A section heading</h2><p>Inline <b>bold text</b> &amp; entities.</p>
<script>malicious()</script><iframe src="https://evil.test"></iframe><img src="https://evil.test/track.png">
<div data-component-type="tin_xemthem">Related article text</div></article>`;

test('extracts article blocks in order with full-size lazy photos, captions and no executable markup', () => {
  const result = extractArticle(fixture, article);
  assert.deepEqual(result.blocks.map(b=>b.type), ['paragraph','image','caption','heading','paragraph']);
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].imageUrl, 'https://i1-vnexpress.vnecdn.net/photo.jpg');
  assert.equal(result.blocks[1].aspectRatio, 1.5);
  const content = JSON.stringify(result);
  assert(!content.includes('malicious'));
  assert(!content.includes('Related article'));
  assert(!content.includes('evil.test'));
  assert(!content.includes('Duplicate headline'));
  assert(content.includes('Photo credit'));
});

test('uses publisher-specific main content; excludes author avatars and forum replies', () => {
  const dantri = extractArticle(`<article id="articleContent"><h1>Title</h1><img src="https://cdnphoto.dantri.com.vn/avatar.jpg" width="24" height="24">
    <h2 data-slot="sapo">Introduction</h2><div data-slot="content"><p>${paragraph}</p><figure><img data-original="https://cdnphoto.dantri.com.vn/full.jpg"></figure></div></article>`,
    {...article,link:'https://dantri.com.vn/example.htm'});
  assert.equal(dantri.images.length,1);
  assert.equal(dantri.blocks[0].type,'lead');
  const tinhte = extractArticle(`<div class="xfBody big">${paragraph}<br><img src="https://photo2.tinhte.vn/gallery1.jpg"><img src="https://photo2.tinhte.vn/gallery2.jpg"></div>
    <div class="xfBody">Comment by a reader</div>`, {...article,link:'https://tinhte.vn/thread/example/'});
  assert.equal(tinhte.images.length,2);
  assert(!JSON.stringify(tinhte).includes('Comment by a reader'));
});

test('rejects paywalls, unsupported article layouts, unsafe origins and oversized pages', () => {
  assert.throws(()=>extractArticle('<script type="application/ld+json">{"isAccessibleForFree":false}</script>'+fixture,article));
  assert.throws(()=>extractArticle('<html>Publisher blocked request</html>',article));
  assert.throws(()=>extractArticle('a'.repeat(3*1024*1024+1),article));
  for (const url of ['https://127.0.0.1/', 'http://vnexpress.net/a','https://vnexpress.net.evil.test/a','https://u:p@dantri.com.vn/a','https://dantri.com.vn:8080/a']) {
    assert.equal(allowedArticle(url),false);
  }
});

test('coalesces detail requests, caches parsed blocks and exposes only approved photo IDs', async () => {
  let requests=0;
  const service=createNewsArticleService({lookup:async()=>article,fetchImpl:async()=>{
    requests++;await new Promise(resolve=>setImmediate(resolve));
    return new Response(fixture,{headers:{'content-type':'text/html'}});
  }});
  const [one,two]=await Promise.all([service.get(article.id),service.get(article.id)]);
  assert.equal(one.available,true);assert.equal(one,two);assert.equal(requests,1);
  await service.get(article.id);assert.equal(requests,1);
  const imageId=one.blocks.find(b=>b.type==='image').imageId;
  assert(service.findImage(imageId));
  assert.equal(service.findImage('unknown'),null);
  assert(!JSON.stringify(one).includes('imageUrl'));
});

test('upstream failure stays in the reader with an honest unavailable result, not fake full content', async () => {
  const service=createNewsArticleService({lookup:async()=>article,fetchImpl:async()=>new Response('blocked',{status:403})});
  const result=await service.get(article.id);
  assert.equal(result.available,false);assert.deepEqual(result.blocks,[]);assert(result.message);
  await assert.rejects(service.get('bad-id'),{status:404});
  const missing=createNewsArticleService({lookup:async()=>null});
  await assert.rejects(missing.get(article.id),{status:404});
});
