const sources = require("./sources");
const selectSources = require("./utils/selectSources");
const rankSources = require("./utils/rankSources");
const createBudget = require("./utils/budget");

const scrapeSource = require("./services/scrapeSource");
const ingestArticle = require("./services/ingestArticle");

module.exports = async function runScraper(db, API_KEY) {

  // 🔥 1. AUTOMATIC DATABASE CLEANUP
  console.log(`\n===== RUNNING DATABASE CLEANUP =====`);
  try {
    // Delete automated articles older than 3 days
    const cleanup = await db.execute(`
      DELETE FROM articles 
      WHERE created_at < datetime('now', '-3 days') 
      AND is_automated = 1
    `);
    
    // Turso/libsql returns rowsAffected so we can see how many were deleted
    console.log(`✅ Deleted ${cleanup.rowsAffected} old articles to free up space.`);
  } catch (err) {
    console.error(`❌ Cleanup failed:`, err.message);
  }

  // 2. START SCRAPING NEW ARTICLES
  let totalAdded = 0;

  for(const category in sources){

    console.log(`\n===== CATEGORY: ${category} =====`);

    const budget = createBudget(15);
    const ranked = rankSources(sources[category]);
    const selected = selectSources(ranked, 3);

    console.log(
      "Sources:",
      selected.map(s => `${s.name} (${s.score})`).join(", ")
    );

    // 🔥 RUN SOURCES IN PARALLEL
    await Promise.all(selected.map(async (source) => {

      if(budget.reached()) return;

      console.log(`\n--- ${source.name} ---`);

      const {elements, $, usedRSS} = await scrapeSource(source, API_KEY);

      if(elements.length === 0){
        console.log("❌ No articles");
        source.freshness = -1;
        return;
      }

      let added = 0;
      let duplicates = 0;

      for(const el of elements){

        if(budget.reached()) break;

        let title;
        let link;

        if(el.rss){
          title = el.title;
          link = el.link;
        } else {
          title = $(el).text().trim();
          link = $(el).attr("href");
        }

        if(!title || title.length < 10) continue;
        if(!link) continue;

        if(link.startsWith("/")){
          const base = new URL(source.url).origin;
          link = base + link;
        }

        const result = await ingestArticle(db, source, title, link, category, API_KEY);

        if(result.added){
          added++;
          totalAdded++;
          budget.add();
        }

        if(result.duplicate) duplicates++;
      }

      source.success = (source.success || 0) + added;

      if(added > 0) source.freshness = 2;
      else if(duplicates > 3) source.freshness = -1;
      else source.freshness = 0;

      console.log(`RESULT added:${added} dup:${duplicates}`);

      if(usedRSS) console.log(`⚠ ${source.name} used RSS`);

    }));
  }

  console.log(`\n===== SCRAPER COMPLETE =====`);
  console.log(`Total new articles added: ${totalAdded}`);
};
