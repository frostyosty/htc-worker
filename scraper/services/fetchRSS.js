const Parser = require('rss-parser');
const parser = new Parser();

module.exports = async function fetchRSS(feedUrl){

  try{

    const feed = await parser.parseURL(feedUrl);

    return feed.items.slice(0,5).map(item => ({
      title: item.title,
      link: item.link
    }));

  }catch(err){

    console.log("RSS failed:", feedUrl);
    return [];

  }

};