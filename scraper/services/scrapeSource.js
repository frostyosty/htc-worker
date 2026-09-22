const cheerio = require("cheerio");
const fetchPage = require("./fetchPage");
const fetchRSS = require("./fetchRSS");
const discoverRSS = require("./discoverRSS");

module.exports = async function scrapeSource(source,API_KEY){

  let elements = [];
  let $ = null;
  let usedRSS = false;

  // 🔥 RSS-FIRST: when a source already has known feeds configured, use them
  // before ever touching the HTML listing page. RSS is free; the listing
  // page fetch is the one that can fall back to paid ScraperAPI credits.
  if(source.rss){

    const feeds = Array.isArray(source.rss)
      ? source.rss
      : [source.rss];

    for(const feed of feeds){

      const items = await fetchRSS(feed);

      if(items.length){

        usedRSS = true;

        elements = items.map(i=>({
          rss:true,
          title:i.title,
          link:i.link,
          content:i.content
        }));

        break;

      }

    }

  }

  // FALL BACK TO HTML SCRAPING — only path that can spend proxy credits
  if(elements.length === 0){

    const html = await fetchPage(source.url,source,API_KEY);

    if(html){

      try{

        $ = cheerio.load(html);

        elements = $(source.selectors[0])
          .toArray()
          .slice(0,5);

        console.log(`HTML found ${elements.length}`);

        // detect RSS in page header for next time
        if(!source.rss){

          const feed =
            $('link[type="application/rss+xml"]').attr("href") ||
            $('link[type="application/atom+xml"]').attr("href");

          if(feed){

            source.rss = feed.startsWith("http")
              ? feed
              : new URL(feed,source.url).href;

            console.log("🔎 RSS found in HTML:",source.rss);

          }

        }

      }catch(e){

        console.log("Cheerio failed");

      }

    }

  }

  // DISCOVER RSS — last resort for sources with no configured/detected feed
  if(elements.length === 0){

    const discovered = await discoverRSS(source.url);

    if(discovered){

      source.rss = discovered;

      const items = await fetchRSS(discovered);

      if(items.length){

        usedRSS = true;

        elements = items.map(i=>({
          rss:true,
          title:i.title,
          link:i.link,
          content:i.content
        }));

      }

    }

  }

  return {elements,$,usedRSS};

};