const fetchRSS = require("./fetchRSS");

const RSS_CANDIDATES = [
  "/feed",
  "/rss",
  "/rss.xml",
  "/atom.xml"
];

module.exports = async function discoverRSS(baseUrl){

  const origin = new URL(baseUrl).origin;

  for(const path of RSS_CANDIDATES){

    const url = origin + path;

    const items = await fetchRSS(url);

    if(items && items.length > 0){

      console.log(`✅ RSS discovered: ${url}`);
      return url;

    }

  }

  return null;

};