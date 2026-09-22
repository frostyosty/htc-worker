const Parser = require('rss-parser');
const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'contentEncoded']]
  }
});

module.exports = async function fetchRSS(feedUrl, limit = 8){

  try{

    const feed = await parser.parseURL(feedUrl);

    return feed.items.slice(0,limit).map(item => ({
      title: item.title,
      link: item.link,
      // 🔥 Grab whatever body text the feed already gives us for free —
      // this is what lets ingestArticle skip the paid re-fetch entirely.
      content: item.contentEncoded || item.content || item.contentSnippet || item.summary || ''
    }));

  }catch(err){

    console.log("RSS failed:", feedUrl);
    return [];

  }

};
