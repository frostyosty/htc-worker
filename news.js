const axios = require('axios');
const cheerio = require('cheerio');

const SCRAPER_SOURCES = {
    'Mixed': [
        { url: 'https://www.allsides.com/headline-roundups', base: 'https://www.allsides.com', 
          articleSelector: '.news-title a', contentSelector: '.story-id-page-description', imageSelector: '.img-fluid',
          keywords: ['politics', 'news', 'world', 'election', 'debate'] }
    ],
    'Wars': [
        { url: 'https://www.reuters.com/world/', base: 'https://www.reuters.com',
          articleSelector: '[data-testid="Heading"] a', contentSelector: 'article p', imageSelector: 'figure img',
          keywords: ['war', 'conflict', 'military', 'ukraine', 'gaza', 'israel', 'russia'],
          useProxy: true },
        { url: 'https://www.bbc.com/news/world', base: 'https://www.bbc.com',
          articleSelector: '[data-testid="card-headline"]', contentSelector: 'main p', imageSelector: 'img',
          keywords: ['war', 'conflict', 'missile', 'attack'] }
    ],
    'AI': [
        { url: 'https://techcrunch.com/category/artificial-intelligence/', base: 'https://techcrunch.com',
          articleSelector: '.loop-card__title a, h2 a', contentSelector: '.article-content p, .entry-content p',
          keywords: ['ai', 'gpt', 'openai', 'llm'] }
    ],
    'Tech': [
        { url: 'https://arstechnica.com/gadgets/', base: 'https://arstechnica.com',
          articleSelector: 'header h2 a', contentSelector: '.article-content p', imageSelector: 'figure.intro-image img',
          keywords: ['review', 'phone', 'apple', 'chip'] }
    ]
};

async function fetchArticleDetails(url, config, API_KEY) {
    try {
        let html;
        if (config.useProxy && API_KEY) {
            const res = await axios.get('http://api.scraperapi.com', {
                params: { api_key: API_KEY, url: url, render: 'false' },
                timeout: 30000
            });
            html = res.data;
        } else {
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                timeout: 10000
            });
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
        for (const source of SCRAPER_SOURCES[category]) {
            try {
                let listHtml;
                if (source.useProxy && API_KEY) {
                    const res = await axios.get('http://api.scraperapi.com', {
                        params: { api_key: API_KEY, url: source.url },
                        timeout: 30000
                    });
                    listHtml = res.data;
                } else {
                    const res = await axios.get(source.url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                        timeout: 10000
                    });
                    listHtml = res.data;
                }
                
                const $ = cheerio.load(listHtml);
                const elements = $(source.articleSelector).toArray();
                let count = 0;

                for (const el of elements) {
                    if (count >= 3) break;
                    
                    const title = $(el).text().trim();
                    let link = $(el).attr('href');
                    if (!title || !link) continue;

                    const titleLower = title.toLowerCase();
                    if (!source.keywords.some(k => titleLower.includes(k))) continue;

                    if (!link.startsWith('http')) {
                        const base = source.base || new URL(source.url).origin;
                        link = new URL(link, base).href;
                    }

                    const exists = await db.execute({ sql: "SELECT id FROM articles WHERE source_url = ?", args: [link] });
                    
                    if (exists.rows.length === 0) {
                        console.log(`   > Scraping: ${title}`);
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
                        
                        console.log(`   + [${category}] Saved.`);
                        count++;
                        totalAdded++;
                    }
                }
            } catch (e) {
                console.warn(`   Skipping ${source.url}: ${e.message}`);
            }
        }
    }
    console.log(`📰 Scraper finished. Added ${totalAdded} articles.`);
};
