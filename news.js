const axios = require('axios');
const cheerio = require('cheerio');

// 🟢 CONFIG: Stronger Selectors
const SCRAPER_SOURCES = {
    'Mixed': [
        { 
            url: 'https://www.allsides.com/headline-roundups', 
            base: 'https://www.allsides.com', 
            // Try specific, then generic h2
            selectors: ['.news-title a', '.view-content h2 a'], 
            contentSelector: '.story-id-page-description', 
            keywords: ['politics', 'news', 'world', 'election'] 
        }
    ],
    'Wars': [
        { 
            url: 'https://www.bbc.com/news/world', 
            base: 'https://www.bbc.com',
            // BBC uses data-testid, but fall back to standard h2
            selectors: ['[data-testid="card-headline"]', 'h2[data-testid="card-headline"]', 'h2 a'], 
            contentSelector: 'main p', 
            keywords: ['war', 'conflict', 'missile', 'attack', 'military', 'gaza', 'ukraine', 'russia'] 
        },
        { 
            url: 'https://www.reuters.com/world/', 
            base: 'https://www.reuters.com',
            selectors: ['[data-testid="Heading"] a', 'h3[data-testid="Heading"] a', '.story-card a'], 
            contentSelector: 'article p',
            keywords: ['war', 'conflict', 'military', 'ukraine', 'gaza', 'israel'],
            useProxy: true 
        }
    ],
    'AI': [
        { 
            url: 'https://techcrunch.com/category/artificial-intelligence/', 
            base: 'https://techcrunch.com',
            selectors: ['.loop-card__title a', 'h2.post-block__title a', 'h2 a'], 
            contentSelector: '.entry-content p', 
            keywords: ['ai', 'gpt', 'openai', 'llm'] 
        }
    ],
    'Tech': [
        { 
            url: 'https://arstechnica.com/gadgets/', 
            base: 'https://arstechnica.com',
            // Ars Technica
            selectors: ['header h2 a', '.article-overlay a', 'h2 a'], 
            contentSelector: '.article-content p', 
            keywords: ['review', 'phone', 'apple', 'chip', 'laptop', 'android'] 
        }
    ]
};

async function fetchArticleDetails(url, config, API_KEY) {
    try {
        let html;
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        
        if (config.useProxy && API_KEY) {
            const res = await axios.get('http://api.scraperapi.com', {
                params: { api_key: API_KEY, url: url, render: 'false' },
                timeout: 30000
            });
            html = res.data;
        } else {
            const res = await axios.get(url, { headers, timeout: 15000 });
            html = res.data;
        }

        const $ = cheerio.load(html);
        let text = '';
        if (config.contentSelector) {
            text = $(config.contentSelector).first().text().trim();
            if (text.length < 50) text = $(config.contentSelector).eq(1).text().trim();
        }
        return text || "Click to read full story.";
    } catch (e) {
        return "Click to read full story.";
    }
}

module.exports = async function runScraper(db, API_KEY) {
    console.log("\n📰 --- STARTING NEWS SCRAPER ---");
    let totalAdded = 0;

    for (const category in SCRAPER_SOURCES) {
        console.log(`\n📂 Processing Category: ${category}`);
        
        for (const source of SCRAPER_SOURCES[category]) {
            try {
                let htmlData = null;
                const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

                // Fetch List Page
                if (source.useProxy && API_KEY) {
                    console.log(`   🛡️ Proxy: ${source.url}`);
                    const res = await axios.get('http://api.scraperapi.com', {
                        params: { api_key: API_KEY, url: source.url },
                        timeout: 40000
                    });
                    htmlData = res.data;
                } else {
                    console.log(`   ⚡ Direct: ${source.url}`);
                    const res = await axios.get(source.url, { headers, timeout: 15000 });
                    htmlData = res.data;
                }
                
                const $ = cheerio.load(htmlData);
                
                // 🟢 NEW: Try Selectors until one works
                let elements = [];
                for (const sel of source.selectors) {
                    const found = $(sel).toArray();
                    if (found.length > 0) {
                        elements = found;
                        // console.log(`      -> Matched selector: "${sel}" (${found.length} items)`);
                        break;
                    }
                }

                if (elements.length === 0) {
                    console.warn(`      ❌ No items found. Check selectors for ${source.url}`);
                    continue;
                }

                let count = 0;
                for (const el of elements) {
                    if (count >= 3) break; // Max 3 per source
                    
                    const title = $(el).text().trim();
                    let link = $(el).attr('href');
                    if (!title || !link) continue;

                    // Lowercase check
                    const titleLower = title.toLowerCase();
                    if (!source.keywords.some(k => titleLower.includes(k))) {
                        // console.log(`      - Skip (Keyword): ${title.substring(0, 20)}...`);
                        continue;
                    }

                    if (!link.startsWith('http')) {
                        const base = source.base || new URL(source.url).origin;
                        link = new URL(link, base).href;
                    }

                    const exists = await db.execute({ sql: "SELECT id FROM articles WHERE source_url = ?", args: [link] });
                    
                    if (exists.rows.length === 0) {
                        console.log(`      ✅ Scrape: "${title.substring(0, 40)}..."`);
                        const summary = await fetchArticleDetails(link, source, API_KEY);
                        
                        const formattedContent = `
                            <p>${summary}</p>
                            <br>
                            <a href="${link}" target="_blank" rel="nofollow" class="read-more-link" style="color:#007bff; text-decoration:none; font-weight:bold;">
                                Read Source ↗
                            </a>
                        `;

                        await db.execute({
                            sql: `INSERT INTO articles (title, content, category, has_photo, image_url, is_automated, source_url, status, created_at, last_activity_at)
                                  VALUES (?, ?, ?, 0, NULL, 1, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            args: [title, formattedContent, category, link]
                        });
                        
                        count++;
                        totalAdded++;
                    }
                }
            } catch (e) {
                console.warn(`   Skipping ${source.url}: ${e.message}`);
            }
        }
    }
    console.log(`\n📰 Scraper finished. Added ${totalAdded} articles.`);
};
