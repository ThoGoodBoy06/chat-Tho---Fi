const FEEDS = [
  { url: "https://vnexpress.net/rss/the-gioi.rss", category: "World" },
  { url: "https://vnexpress.net/rss/thoi-su.rss", category: "Vietnam" },
  { url: "https://vnexpress.net/rss/so-hoa.rss", category: "Tech_AI" }
];

async function test() {
  for (const feed of FEEDS) {
    console.log(`\n=== Testing feed: ${feed.category} ===`);
    const rssRes = await fetch(feed.url);
    const xml = await rssRes.text();
    const match = xml.match(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>/);
    if (!match) {
      console.log("No links found");
      continue;
    }
    const url = match[1].trim();
    console.log("Fetching article:", url);
    const res = await fetch(url);
    const htmlText = await res.text();

    const articleMatch = htmlText.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/);
    
    if (articleMatch) {
      console.log("✅ Success: Found <article class=\"fck_detail\">");
      const articleHtml = articleMatch[1];
      const imgTags = articleHtml.match(/<img[^>]*>/gi);
      console.log("Images count:", imgTags ? imgTags.length : 0);
      if (imgTags) {
        console.log("First image tag:", imgTags[0]);
      }
    } else {
      console.log("❌ Failed: No <article class=\"fck_detail\"> tag");
      // Search for any other containers
      const divFckMatch = htmlText.match(/<div[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (divFckMatch) {
        console.log("👉 Found as <div class=\"fck_detail\"> instead!");
      } else {
        const anyArticle = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
        console.log("👉 Any article tag exists?", !!anyArticle);
      }
    }
  }
}
test().catch(console.error);
