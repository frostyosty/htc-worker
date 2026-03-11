const sources = require("./sources");
const selectSources = require("./utils/selectSources");
const rankSources = require("./utils/rankSources");
const createBudget = require("./utils/budget");

const scrapeSource = require("./services/scrapeSource");
const ingestArticle = require("./services/ingestArticle");

module.exports = async function runScraper(db, API_KEY){

  // 🔥 THE SPREAD-OUT VARIETY STRAT 🔥
  // Assuming the GitHub Action cron runs 4 times a day (e.g., every 6 hours)
  const RUNS_PER_DAY = 4;         
  const TARGET_ARTICLES_PER_DAY = 8; // 8 per category * 4 categories = 32/day (Fits the 1,000/mo free limit)
  
  const budgetPerRun = Math.ceil(TARGET_ARTICLES_PER_DAY / RUNS_PER_DAY); // Aiming for 2 articles per category per run
  const sourcesToPick = 3; // Pick 3 random outlets to guarantee high variety!

  console.log(`\n📊 SPREAD-OUT STRATEGY ACTIVE:`);
  console.log(`   - Runs per day: ${RUNS_PER_DAY}`);
  console.log(`   - Target Budget: ${budgetPerRun} articles per category, per run`);
  console.log(`   - Variety: Pulling from ${sourcesToPick} different outlets per category`);


  // 🔥 AUTOMATIC DATABASE CLEANUP
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


  // 🔥 START SCRAPING
  let totalAdded = 0;

  for(const category in sources){

    console.log(`\n===== CATEGORY: ${category} =====`);

    // 🎲 SHUFFLE THE SOURCES FOR MAXIMUM VARIETY!
    // This ensures we don't just pick the top 2 every single time.
    const shuffledSources = sources[category].sort(() => 0.5 - Math.random());
    
    const ranked = rankSources(shuffledSources);
    const selected = selectSources(ranked, sourcesToPick);

    console.log(
      "Sources Selected for this run:",
      selected.map(s => `${s.name}`).join(" | ")
    );

    const budget = createBudget(budgetPerRun);

    // RUN SOURCES IN PARALLEL
    await Promise.all(selected.map(async (source)=>{

      if(budget.reached()) return;

      console.log(`\n--- ${source.name} ---`);

      const {elements,$,usedRSS} = await scrapeSource(source,API_KEY);

      if(elements.length === 0){
        console.log("❌ No links found");
        source.freshness = -1;
        return;
      }

      let added = 0;
      let duplicates = 0;

      // We shuffle the elements too, so we don't always grab the exact top headline
      const shuffledElements = elements.sort(() => 0.5 - Math.random());

      for(const el of shuffledElements){

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
          budget.add();
        }

        if(result.duplicate) duplicates++;
      }

      source.success = (source.success||0)+added;

      if(added>0) source.freshness = 2;
      else if(duplicates>3) source.freshness = -1;
      else source.freshness = 0;

      console.log(`RESULT added:${added} dup:${duplicates}`);
      if(usedRSS) console.log(`✓ ${source.name} safely used RSS fallback`);

    }));
  }

  console.log(`\n===== SCRAPER COMPLETE =====`);
  console.log(`Total new articles added this run: ${totalAdded}`);
};
