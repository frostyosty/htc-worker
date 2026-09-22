const RSS_PATHS = [
"/feed",
"/rss",
"/rss.xml",
"/atom.xml",
"/atom",
"/feeds",
"/feeds/posts/default",
"/rss/home",
"/rss/latest",
"/rss/news",
"/rss/world",
"/rss/politics",
"/rss/technology",
"/rss/tech",
"/news/rss",
"/news/feed",
"/news/rss.xml",
"/blog/rss",
"/blog/feed",
"/index.xml",
"/feed.xml",
"/rss/latest.xml",
"/rss/articles",
"/rss/topstories",
"/rss/breaking",
"/rss/headlines",
"/rss/latest-news",
"/feeds/rss",
"/feeds/rss.xml"
];

module.exports = async function discoverRSS(baseUrl){

  for(const path of RSS_PATHS){

    try{

      const url = new URL(path,baseUrl).href;

      // Native fetch ignores a `timeout` option — without AbortController a
      // hung request here can silently eat the whole workflow's time budget.
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(),3000);
      let res;
      try{
        res = await fetch(url,{signal:controller.signal});
      } finally {
        clearTimeout(timer);
      }

      if(!res.ok) continue;

      const text = await res.text();

      if(text.includes("<rss") || text.includes("<feed")){

        console.log("✅ RSS discovered:",url);
        return url;

      }

    }catch(e){}

  }

  return null;

};