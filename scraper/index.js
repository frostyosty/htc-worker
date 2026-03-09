const sources = require('./scraper/sources');
const fetchPage = require("./services/fetchPage");
const extractArticle = require("./services/extractArticle");
const isDuplicate = require("./services/duplicateCheck");
const selectSources = require("./utils/selectSources");

module.exports = async function runScraper(db, API_KEY){

  let totalAdded = 0;

  for (const category in sources){

    const selected = selectSources(sources[category],6);

    for (const source of selected){

      const html = await fetchPage(source.url, source, API_KEY);

      const $ = cheerio.load(html);

      for (const el of $(source.selectors[0]).toArray()){

        const title = $(el).text().trim();

        if (await isDuplicate(db,title)) {
          console.log("⏭ Similar article exists");
          continue;
        }

        const link = $(el).attr("href");

        const articleHtml = await fetchPage(link,source,API_KEY);

        const meta = extractArticle(articleHtml,source);

        if (!meta) continue;

        await db.execute({
          sql:`INSERT INTO articles (title,content,category)
               VALUES (?,?,?)`,
          args:[title,meta.text,category]
        });

        totalAdded++;
      }
    }
  }

  console.log(`Added ${totalAdded}`);
};