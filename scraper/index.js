const sources = require("./sources");
const selectSources = require("./utils/selectSources");
const rankSources = require("./utils/rankSources");
const createBudget = require("./utils/budget");

const scrapeSource = require("./services/scrapeSource");
const ingestArticle = require("./services/ingestArticle");

module.exports = async function runScraper(db, API_KEY){

  // 🔥 1. THE SMART PACER ALGORITHM 🔥
  const MONTHLY_API_LIMIT = 1000; // <-- Put your scraper's free tier limit here!
  const RUNS_PER_DAY = 1;         // Change to 2 if you run the cron twice a day
  
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  // Total API calls we are allowed to make on this specific run
  const maxCallsPerRun = Math.floor((MONTHLY_API_LIMIT / daysInMonth) / RUNS_PER_DAY);
  
  const numCategories = Object.keys(sources).length; // Usually 4 (Mixed, AI, Wars, Tech)
  
  // We will check 2 sources per category. (Fetching a source index costs 1 API call)
  const sourcesToPick = 2; 
  
  // The budget is how many articles we fetch. (Fetching an article costs 1 API call)
  // Budget = (Allowed calls per category) - (Calls used to check sources)
  const allowedPerCategory = Math.floor(maxCallsPerRun / numCategories);
  const calculatedBudget = Math.max(1, allowedPerCategory - sourcesToPick);

  console.log(`\n📊 SMART PACER ACTIVE:`);
  console.log(`   - Month Length: ${daysInMonth} days`);
  console.log(`   - Safe API Limit per run: ${maxCallsPerRun} calls`);
  console.log(`   - Target Budget: ${calculatedBudget} articles per category`);


  // 🔥 2. AUTOMATIC DATABASE CLEANUP
  console.log(`\n===== RUNNING DATABASE CLEANUP =====`);
  try {
    const cleanup = await db.execute(`
      DELETE FROM articles 
      WHERE created_at < datetime('now', '-3 days') 
      AND is_automated = 1
    `);
    console.log(`✅ Deleted ${cleanup.rowsAffected} old articles to free up space.`);
  } catch (err) {
    console.error(`❌ Cleanup failed:`, err.message);
  }


  // 🔥 3. START SCRAPING
  let totalAdded = 0;

  for(const category in sources){

    console.log(`\n===== CATEGORY: ${category} =====`);

    // Use our calculated budget instead of hardcoded numbers!
    const budget = createBudget(calculatedBudget);
    const ranked = rankSources(sources[category]);
    const selected = selectSources(ranked, sourcesToPick);

    console.log(
      "Sources:",
      selected.map(s=>`${s.name} (${s.score})`).join(", ")
    );

    // RUN SOURCES IN PARALLEL
    await Promise.all(selected.map(async (source)=>{

      if(budget.reached()) return;

      console.log(`\n--- ${source.name} ---`);

      const {elements,$,usedRSS} = await scrapeSource(source,API_KEY);

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
        }else{
          title = $(el).text().trim();
          link = $(el).attr("href");
        }

        if(!title || title.length < 10) continue;
        if(!link) continue;

        if(link.startsWith("/")){
          const base = new URL(source.url).origin;
          link = base + link;
        }

        const result = await ingestArticle(db,source,title,link,category,API_KEY);

        if(result.added){
          added++;
          totalAdded++;
          budget.add(); // Consumes 1 budget slot
        }

        if(result.duplicate) duplicates++;
      }

      source.success = (source.success||0)+added;

      if(added>0) source.freshness = 2;
      else if(duplicates>3) source.freshness = -1;
      else source.freshness = 0;

      console.log(`RESULT added:${added} dup:${duplicates}`);
      if(usedRSS) console.log(`⚠ ${source.name} used RSS`);

    }));
  }

  console.log(`\n===== SCRAPER COMPLETE =====`);
  console.log(`Total new articles added: ${totalAdded}`);

};
