const cheerio = require("cheerio");
const fetchPage = require("./fetchPage");
const fetchRSS = require("./fetchRSS");
const discoverRSS = require("./discoverRSS");

module.exports = async function scrapeSource(source,API_KEY){

  let elements = [];
  let $ = null;
  let usedRSS = false;

  const html = await fetchPage(source.url,source,API_KEY);

  if(html){

    try{

      $ = cheerio.load(html);

      elements = $(source.selectors[0])
        .toArray()
        .slice(0,5);

      console.log(`HTML found ${elements.length}`);

    }catch(e){

      console.log("Cheerio failed");

    }

  }

  if(elements.length === 0 && source.rss){

    usedRSS = true;

    const items = await fetchRSS(source.rss);

    elements = items.map(i=>({
      rss:true,
      title:i.title,
      link:i.link
    }));

  }

  if(elements.length === 0 && !source.rss){

    const discovered = await discoverRSS(source.url);

    if(discovered){

      source.rss = discovered;

      const items = await fetchRSS(discovered);

      elements = items.map(i=>({
        rss:true,
        title:i.title,
        link:i.link
      }));

      usedRSS = true;

    }

  }

  return {elements,$,usedRSS};

};