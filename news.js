const axios = require('axios');
const cheerio = require('cheerio');

// 1. SOURCES CONFIG
const SCRAPER_SOURCES = {
    'Mixed': [
        { 
            name: 'AllSides',
            url: 'https://www.allsides.com/headline-roundups', 
            base: 'https://www.allsides.com', 
            selectors: ['.news-title a', 'h2 a'], 
            keywords: ['politics', 'news', 'world', 'election'],
            useProxy: true
        },
        {
            name: 'The Guardian',
            url: 'https://www.theguardian.com/world',
            base: 'https://www.theguardian.com',
            selectors: ['.fc-item__title a', 'h3 a', '[data-link-name="article"]'], // Updated selectors
            keywords: ['politics', 'crisis', 'un', 'treaty', 'world'],
            useProxy: false
        },
        {
  name: 'NPR',
  url: 'https://www.npr.org/sections/world/',
  base: 'https://www.npr.org',
  selectors: ['h2 a', '.teaser a'],
  keywords: ['politics', 'war', 'world', 'conflict'],
  useProxy: false
},
{
  name: 'Politico',
  url: 'https://www.politico.com/news',
  base: 'https://www.politico.com',
  selectors: ['a[data-testid="headline"]', 'h3 a'],
  keywords: ['election', 'policy', 'congress', 'white house'],
  useProxy: true
},
        {
  name: 'Financial Times',
  url: 'https://www.ft.com/world',
  base: 'https://www.ft.com',
  selectors: ['h3 a'],
  keywords: ['economy', 'market', 'war', 'global'],
  useProxy: true
}
    ],

    
    'Wars': [
        { 
            name: 'BBC World',
            url: 'https://www.bbc.com/news/world', 
            base: 'https://www.bbc.com',
            selectors: ['[data-testid="card-headline"]', 'h2[data-testid="card-headline"]'], 
            keywords: ['war', 'conflict', 'missile', 'attack', 'gaza', 'ukraine', 'russia'],
            useProxy: false 
        },
        { 
            name: 'Reuters',
            url: 'https://www.reuters.com/world/', 
            base: 'https://www.reuters.com',
            selectors: ['[data-testid="Heading"] a', '.story-card a', 'h3 a'], 
            keywords: ['war', 'military', 'strike', 'army', 'truce'],
            useProxy: true 
        },
        {
            name: 'Al Jazeera',
            url: 'https://www.aljazeera.com/where/middle-east/',
            base: 'https://www.aljazeera.com',
            selectors: ['h3.gc__title a', '.article-card__title a'],
            keywords: ['war', 'bomb', 'killed', 'strike'],
            useProxy: true
        },
{
  name: 'CNN',
  url: 'https://edition.cnn.com/world',
  base: 'https://edition.cnn.com',
  selectors: ['.container__headline-text', '.cd__headline-text'],
  keywords: ['war', 'conflict'],
  useProxy: true,
  render: true
},
        { 
            // 🟢 NEW: AP News (Usually allows direct scraping)
            name: 'AP World',
            url: 'https://apnews.com/hub/world-news',
            base: 'https://apnews.com',
            selectors: ['.PagePromo-content a', 'h3.PagePromo-title a'],
            keywords: ['war', 'conflict', 'gaza', 'ukraine', 'russia', 'military'],
            useProxy: false 
        },
        {
  name: 'Sky News',
  url: 'https://news.sky.com/world',
  base: 'https://news.sky.com',
  selectors: ['h3 a'],
  keywords: ['war', 'conflict', 'military', 'attack'],
  useProxy: true
},
    ],
    'AI': [
        { 
            name: 'TechCrunch',
            url: 'https://techcrunch.com/category/artificial-intelligence/', 
            base: 'https://techcrunch.com',
            selectors: ['h2.post-block__title a', '.loop-card__title a'], 
            keywords: ['ai', 'gpt', 'openai', 'llm', 'model'] 
        },
        {
            name: 'The Verge',
            url: 'https://www.theverge.com/ai-artificial-intelligence',
            base: 'https://www.theverge.com',
            selectors: ['h2 a', '.duet--content-cards--content-card_headline'],
            keywords: ['ai', 'chatgpt', 'google', 'gemini'],
            useProxy: false
        }
    ],
    'Tech': [
        { 
            name: 'Ars Technica',
            url: 'https://arstechnica.com/gadgets/', 
            base: 'https://arstechnica.com',
            selectors: ['h2 a', '.article-overlay a'], 
            keywords: ['review', 'apple', 'chip', 'android'] 
        },
{
        name: 'Wired',
        url: 'https://www.wired.com/category/gear/',
        base: 'https://www.wired.com',
        // 🟢 UPDATED SELECTOR for Wired 2026
        selectors: ['.SummaryItemHedLink-civMjp', 'div[class*="SummaryItem"] a', 'h3 a'],
        keywords: ['gear', 'phone', 'laptop'],
        useProxy: true
    },
        {
  name: 'Bloomberg Tech',
  url: 'https://www.bloomberg.com/technology',
  base: 'https://www.bloomberg.com',
  selectors: ['h3 a'],
  keywords: ['ai', 'chip', 'apple', 'google', 'tech'],
  useProxy: true
}
    ]
};

// 2. HELPER: Fetch Details (Correct Name!)
async function fetchArticleDetails(url, config, API_KEY) {
    try {
        let html;
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };
        
        if (config.useProxy && API_KEY) {
            const res = await axios.get('http://api.scraperapi.com', {
                params: { 
    api_key: API_KEY, 
    url: url, 
    render: config.render ? 'true' : 'false'
},
                timeout: 30000
            });
            html = res.data;
        } else {
            const res = await axios.get(url, { headers, timeout: 15000 });
            html = res.data;
        }

const $ = cheerio.load(html);
        function extractBestParagraphs($, config) {
    const strategies = [];

    // 1️⃣ Site-specific selector (if provided)
    if (config.contentSelector) {
        strategies.push(() => $(config.contentSelector).toArray());
    }

    // 2️⃣ Common semantic containers
    strategies.push(() => $('article p').toArray());
    strategies.push(() => $('main p').toArray());
    strategies.push(() => $('[role="main"] p').toArray());

    // 3️⃣ Modern news structures (BBC / AP style)
    strategies.push(() => $('div[data-component="text-block"] p').toArray());
    strategies.push(() => $('div[class*="RichText"] p').toArray());
    strategies.push(() => $('div[class*="ArticleBody"] p').toArray());

    // 4️⃣ Final fallback — all paragraphs
    strategies.push(() => $('p').toArray());

    let best = [];
    let bestScore = 0;

    for (const strategy of strategies) {
        const paragraphs = strategy()
            .map(el => $(el).text().trim())
.filter(t => {
    const lower = t.toLowerCase();

    return (
        t.length > 100 &&
        !lower.includes('read more') &&
        !lower.includes('advertisement') &&
        !lower.includes('cookie') &&
        !lower.includes('subscribe') &&
        !lower.includes('all rights reserved') &&
        !lower.includes('warner bros') &&
        !lower.includes('cable news network') &&
        !lower.includes('terms of use') &&
        !lower.includes('privacy policy') &&
        !lower.startsWith('©')
    );
});

        const score = paragraphs.join('').length; // total character count

        if (score > bestScore) {
            bestScore = score;
            best = paragraphs;
        }
    }

    return best.slice(0, 3); // limit to first 3 paragraphs
}
const textParts = extractBestParagraphs($, config);

// ❌ If fewer than 3 real paragraphs → reject article
if (!textParts || textParts.length < 3) {
    return null;
}

const fullText = textParts.join('|||');

        // B. Author
        let author = $('meta[name="author"]').attr('content') || 
                     $('meta[property="article:author"]').attr('content') || 
                     $('.author-name').first().text().trim() ||
                     $('a[rel="author"]').first().text().trim() ||
                     config.name;

        // C. Date
        let date = $('meta[property="article:published_time"]').attr('content') || 
                   $('time').first().attr('datetime') || 
                   new Date().toISOString();

return { 
            text: fullText || "Click to read full story.",
            author: author || config.name, 
            date: date 
        };

} catch (e) {
    console.log(`        ⚠️ Failed to extract article: ${url}`);
    return null;
}
}

// 3. MAIN LOGIC
// ./scraper.js
const fs = require('fs');
const path = require('path');

// Track last run times for proxy sources
const LAST_PROXY_RUN_FILE = path.resolve(__dirname, 'last_proxy_run.json');

function getLastProxyRun() {
  try {
    const data = fs.readFileSync(LAST_PROXY_RUN_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function setLastProxyRun(obj) {
  fs.writeFileSync(LAST_PROXY_RUN_FILE, JSON.stringify(obj), 'utf-8');
}

// MAIN LOGIC
module.exports = async function runScraper(db, API_KEY) {
  console.log("\n📰 --- STARTING NEWS SCRAPER ---");

  let totalAdded = 0;
  const now = Date.now();
  const lastRunTimes = getLastProxyRun();

  for (const category in SCRAPER_SOURCES) {
    console.log(`\n📂 Category: ${category}`);

    for (const source of SCRAPER_SOURCES[category]) {
      try {
        // --- 1. SKIP proxy-heavy sources if already run today ---
        if (source.useProxy) {
          const lastRun = lastRunTimes[source.name] || 0;
          const ONE_DAY = 1000 * 60 * 60 * 24;
          if (now - lastRun < ONE_DAY) {
            console.log(`   ⏳ Skipping proxy source today: ${source.name}`);
            continue;
          }
        }

        let htmlData;

        // --- 2. FETCH LIST PAGE ---
        if (source.useProxy && API_KEY) {
          console.log(`   🛡️ Proxy fetch: ${source.url}`);
          const res = await axios.get('http://api.scraperapi.com', {
            params: { api_key: API_KEY, url: source.url },
            timeout: 40000
          });
          htmlData = res.data;
        } else {
          console.log(`   ⚡ Direct fetch: ${source.url}`);
          const res = await axios.get(source.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 15000
          });
          htmlData = res.data;
        }

        const $ = cheerio.load(htmlData);

        // --- 3. FIND ARTICLES ---
        let elements = [];
        for (const sel of source.selectors) {
          const found = $(sel).toArray();
          if (found.length > 0) {
            elements = found;
            break;
          }
        }

        if (elements.length === 0) {
          console.warn(`      ❌ No items found for ${source.name} (check selectors)`);
          continue;
        }

        // --- 4. PROCESS ARTICLES ---
        let count = 0;
        for (const el of elements) {
          if (count >= 2) break; // limit to 2 articles per source per run

          const title = $(el).text().trim();
let link = $(el).attr('href') || $(el).closest('a').attr('href');

if (!title || !link || title.length < 15) continue;

const titleLower = title.toLowerCase();
if (!source.keywords.some(k => titleLower.includes(k))) continue;

if (!link.startsWith('http')) {
  const base = source.base || new URL(source.url).origin;
  link = new URL(link, base).href;
}

// 🔴 ADD THIS BLOCK HERE
if (source.name === 'BBC World') {
  if (
    link.includes('/videos/') ||
    link.includes('/live/') ||
    link.includes('/av/') ||
    link.includes('/reel/')
  ) {
    console.log(`      ⏭ Skipping non-article BBC link: ${link}`);
    continue;
  }
}

          // --- 5. DUPLICATE CHECK BEFORE FETCH ---
          const exists = await db.execute({
            sql: "SELECT 1 FROM articles WHERE source_url = ? LIMIT 1",
            args: [link]
          });
          if (exists.rows.length > 0) continue;

          console.log(`      Processing: "${title.substring(0, 50)}..."`);

          // --- 6. FETCH ARTICLE DETAILS ---
const meta = await fetchArticleDetails(link, source, API_KEY);

if (!meta || !meta.text) {
    console.log(`      ⏭ Skipping (not enough content).`);
    continue;
}

          // --- 7. CLEAN CONTENT ---
          const formattedContent = meta.text.replace(/<\/?p[^>]*>/gi, '').trim();

          // --- 8. INSERT INTO DB ---
          await db.execute({
            sql: `
              INSERT INTO articles 
              (title, content, category, has_photo, image_url, is_automated, source_url, status, created_at, last_activity_at, author_name)
              VALUES (?, ?, ?, 0, NULL, 1, ?, 1, ?, CURRENT_TIMESTAMP, ?)`,
            args: [title, formattedContent, category, link, meta.date, meta.author]
          });

          console.log(`      ✅ Saved.`);
          count++;
          totalAdded++;
        }

        // --- 9. UPDATE LAST RUN FOR PROXY SOURCES ---
        if (source.useProxy) lastRunTimes[source.name] = now;

      } catch (e) {
        console.warn(`   Skipping ${source.name}: ${e.message}`);
      }
    }
  }

  // --- 10. SAVE LAST RUN TIMES ---
  setLastProxyRun(lastRunTimes);

  console.log(`\n📰 Scraper finished. Added ${totalAdded} articles.`);
};
