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
            useProxy: false
        }
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
            selectors: ['.SummaryItemHedLink-civMjp', 'h3.SummaryItemHedBase-hiCrND', 'a.SummaryItemHedLink-civMjp'],
            keywords: ['gear', 'phone', 'laptop'],
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
                params: { api_key: API_KEY, url: url, render: 'false' },
                timeout: 30000
            });
            html = res.data;
        } else {
            const res = await axios.get(url, { headers, timeout: 15000 });
            html = res.data;
        }

        const $ = cheerio.load(html);
        
        // A. Summary
        let text = $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content');
        
        if (!text || text.length < 50) {
            text = $('article p').first().text().trim() || 
                   $('.article-body p').first().text().trim() || 
                   $('main p').first().text().trim();
        }

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
            text: text || "Click to read full story.", 
            author: author || config.name, 
            date: date 
        };

    } catch (e) {
        return { text: "Click to read full story.", author: config.name, date: new Date().toISOString() };
    }
}

// 3. MAIN LOGIC
module.exports = async function runScraper(db, API_KEY) {
    console.log("\n📰 --- STARTING NEWS SCRAPER ---");
    let totalAdded = 0;

    for (const category in SCRAPER_SOURCES) {
        console.log(`\n📂 Category: ${category}`);
        
        for (const source of SCRAPER_SOURCES[category]) {
            try {
                let htmlData;
                
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
                    const res = await axios.get(source.url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
                        timeout: 15000
                    });
                    htmlData = res.data;
                }
                
                const $ = cheerio.load(htmlData);
                
                // Find Articles
                let elements = [];
                for (const sel of source.selectors) {
                    const found = $(sel).toArray();
                    if (found.length > 0) {
                        elements = found;
                        break;
                    }
                }

                if (elements.length === 0) {
                    console.warn(`      ❌ No items found. (Check selectors for ${source.name})`);
                    continue;
                }

                let count = 0;
                for (const el of elements) {
                    if (count >= 3) break;
                    
                    const title = $(el).text().trim();
                    let link = $(el).attr('href') || $(el).closest('a').attr('href');
                    
                    if (!title || !link || title.length < 15) continue;

                    const titleLower = title.toLowerCase();
                    if (!source.keywords.some(k => titleLower.includes(k))) continue;

                    if (!link.startsWith('http')) {
                        const base = source.base || new URL(source.url).origin;
                        link = new URL(link, base).href;
                    }

                    const exists = await db.execute({ sql: "SELECT id FROM articles WHERE source_url = ?", args: [link] });
                    
                    if (exists.rows.length === 0) {
                        console.log(`      Processing: "${title.substring(0, 30)}..."`);
                        
                        // 🟢 CORRECTLY CALL FUNCTION
                        const meta = await fetchArticleDetails(link, source, API_KEY);
                        
                        const formattedContent = `
                            <p>${meta.text}</p>
                            <br>
                            <a href="${link}" target="_blank" rel="nofollow" class="read-more-link" style="color:#007bff; text-decoration:none; font-weight:bold;">
                                Read Full Story at ${source.name} ↗
                            </a>
                        `;

                        // 🟢 INSERT WITH AUTHOR_NAME
                        await db.execute({
                            sql: `INSERT INTO articles (title, content, category, has_photo, image_url, is_automated, source_url, status, created_at, last_activity_at, author_name)
                                  VALUES (?, ?, ?, 0, NULL, 1, ?, 1, ?, CURRENT_TIMESTAMP, ?)`,
                            args: [title, formattedContent, category, link, meta.date, meta.author]
                        });
                        
                        console.log(`      ✅ Saved.`);
                        count++;
                        totalAdded++;
                    }
                }
            } catch (e) {
                console.warn(`   Skipping ${source.name}: ${e.message}`);
            }
        }
    }
    console.log(`\n📰 Scraper finished. Added ${totalAdded} articles.`);
};
