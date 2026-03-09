const cheerio = require("cheerio");

function extractBestParagraphs($, config) {

  const strategies = [
    () => $("article p").toArray(),
    () => $("main p").toArray(),
    () => $("[role='main'] p").toArray(),
    () => $("p").toArray()
  ];

  let best = [];
  let bestScore = 0;

  for (const strategy of strategies) {

    const paragraphs = strategy()
      .map(el => $(el).text().trim())
      .filter(t => t.length > 100);

    const score = paragraphs.length * 1000 + paragraphs.join("").length;

    if (score > bestScore) {
      bestScore = score;
      best = paragraphs;
    }
  }

  return best.slice(0,3);
}

module.exports = function extractArticle(html, config){

  const $ = cheerio.load(html);

  const paragraphs = extractBestParagraphs($, config);

  if (paragraphs.length < 3) return null;

  return {
    text: paragraphs.join("|||"),
    author:
      $('meta[name="author"]').attr("content") ||
      config.name,

    date:
      $('meta[property="article:published_time"]').attr("content") ||
      new Date().toISOString()
  };
};