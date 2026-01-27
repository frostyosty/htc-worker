const { createClient } = require('@libsql/client');
const axios = require('axios');
const cheerio = require('cheerio');

// --- CONFIG ---
const DB_URL = process.env.HTC_TURSO_DATABASE_URL;
const DB_TOKEN = process.env.HTC_TURSO_AUTH_TOKEN;

if (!DB_URL || !DB_TOKEN) {
    console.error("❌ Missing DB Credentials");
    process.exit(1);
}

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

const SCRAPER_SOURCES = {
    war: [
        {
            url: 'https://www.reuters.com/world/',
            articleSelector: 'a[data-testid="Heading"]',
            keywords: ['war', 'conflict', 'gaza', 'ukraine', 'military', 'invasion', 'strike'],
            contentSelector: 'div[data-testid="ArticleBody"]',
            imageSelector: 'div[data-testid="Image"] img',
        }
    ],
    tech: [
        {
            url: 'https://arstechnica.com/gadgets/',
            articleSelector: 'a.overlay',
            keywords: ['apple', 'google', 'microsoft', 'samsung', 'ai', 'chip', 'phone'],
            contentSelector: 'div[itemprop="articleBody"]',
            imageSelector: 'figure.intro-image img',
        }
    ]
};

async function scrapeArticleContent(articleUrl, sourceConfig) {
    try {
        const res = await axios.get(articleUrl, { 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
        });
        const $ = cheerio.load(res.data);
        
        let content = $(sourceConfig.contentSelector).find('p').slice(0, 3).text().trim();
        // Fallback
        if (!content || content.length < 50) {
            content = $('p').slice(0, 3).text().trim();
        }

        let imageUrl = $(sourceConfig.imageSelector).first().attr('src') || null;
        
        // Ensure absolute URL
        if (imageUrl && !imageUrl.startsWith('http')) {
            const baseUrl = new URL(articleUrl).origin;
            imageUrl = new URL(imageUrl, baseUrl).href;
        }

        return { content, imageUrl };
    } catch (error) {
        return { content: null, imageUrl: null };
    }
}

async function runNews() {
    console.log("📰 Starting News Scraper...");
    const allScrapedArticles = [];

    for (const category in SCRAPER_SOURCES) {
        console.log(`Processing Category: ${category}`);
        
        for (const source of SCRAPER_SOURCES[category]) {
            try {
                const res = await axios.get(source.url, { 
                    timeout: 10000,
                    headers: { 'User-Agent': 'HTC-Bot/1.0' }
                });
                const $ = cheerio.load(res.data);
                const articleElements = $(source.articleSelector).toArray();
                let count = 0;

                for (const el of articleElements) {
                    if (count >= 3) break; 

                    const title = $(el).text().trim();
                    let link = $(el).attr('href');

                    if (!title || !link || title.length < 15) continue;

                    // Keyword Check
                    const hasKeyword = source.keywords.some(k => title.toLowerCase().includes(k));
                    if (!hasKeyword) continue;

                    if (!link.startsWith('http')) {
                        const base = new URL(source.url).origin;
                        link = new URL(link, base).href;
                    }

                    // DB Check
                    const existing = await db.execute({ 
                        sql: "SELECT id FROM articles WHERE source_url = ?", 
                        args: [link] 
                    });
                    
                    if (existing.rows.length === 0) {
                        console.log(`   + Found New: "${title.substring(0, 40)}..."`);
                        
                        const { content, imageUrl } = await scrapeArticleContent(link, source);
                        
                        if (content && content.length > 50) {
                            allScrapedArticles.push({
                                title,
                                content: `<p>${content}...</p><p><a href="${link}" target="_blank">Read more</a></p>`,
                                category,
                                imageUrl,
                                sourceUrl: link,
                            });
                            count++;
                        }
                    }
                }
            } catch (err) {
                console.error(`   - Source failed: ${source.url} (${err.message})`);
            }
        }
    }
    
    // Insert
    if (allScrapedArticles.length > 0) {
        for (const article of allScrapedArticles) {
            try {
                await db.execute({
                    sql: `INSERT INTO articles 
                          (title, content, category, has_photo, image_url, is_automated, source_url, status, created_at, last_activity_at)
                          VALUES (?, ?, ?, ?, ?, 1, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    args: [
                        article.title, 
                        article.content, 
                        article.category, 
                        article.imageUrl ? 1 : 0, 
                        article.imageUrl, 
                        article.sourceUrl
                    ]
                });
            } catch(err) { console.error("Insert failed:", err.message); }
        }
        console.log(`✅ Inserted ${allScrapedArticles.length} new articles.`);
    } else {
        console.log("No new articles found.");
    }
}

// Execute
runNews().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
