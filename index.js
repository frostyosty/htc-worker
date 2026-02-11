const { createClient } = require('@libsql/client');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

// --- CONFIG ---
const DB_URL = process.env.HTC_TURSO_DATABASE_URL;
const DB_TOKEN = process.env.HTC_TURSO_AUTH_TOKEN;
const SECRET_KEY = process.env.MAIL_SECRET_KEY;

if (!DB_URL || !DB_TOKEN || !SECRET_KEY) {
    console.error("❌ Missing Environment Variables");
    process.exit(1);
}

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

// ============================================================
// PART A: EMAIL LOGIC
// ============================================================
function decrypt(text, ivHex) {
    try {
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(text, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SECRET_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) { return null; }
}

async function runEmailSync() {
    console.log("\n📧 --- STARTING EMAIL SYNC ---");
    const rs = await db.execute("SELECT * FROM mail_accounts");
    const accounts = rs.rows;

    for (const acc of accounts) {
        console.log(`Processing ${acc.email}...`);
        try {
            const password = decrypt(acc.encrypted_password, acc.iv);
            if (!password) continue;

            const connection = await imaps.connect({
                imap: {
                    user: acc.email, password: password, host: acc.host, port: acc.port || 993,
                    tls: true, authTimeout: 10000, tlsOptions: { rejectUnauthorized: false }
                }
            });

            const syncFolder = async (boxName, dbFolderLabel, limit = 8) => {
                try {
                    await connection.openBox(boxName);
                    const date = new Date(); date.setDate(date.getDate() - 5);
                    const searchCriteria = [['SINCE', date]];
                    const fetchOptions = { bodies: [''], markSeen: false, struct: true };
                    
                    const messages = await connection.search(searchCriteria, fetchOptions);
                    const recent = messages.reverse().slice(0, limit);

                    let count = 0;
                    for (const msg of recent) {
                        const uid = msg.attributes.uid;
                        const exists = await db.execute({
                            sql: "SELECT id FROM mail_messages WHERE account_id = ? AND uid = ? AND folder = ?",
                            args: [acc.id, uid, dbFolderLabel]
                        });

                        if (exists.rows.length === 0) {
                            const part = msg.parts.find(p => p.which === '');
                            if (part && part.body) {
                                const parsed = await simpleParser(part.body);
                                await db.execute({
                                    sql: `INSERT INTO mail_messages (account_id, uid, folder, sender, subject, preview, full_body, received_at)
                                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    args: [
                                        acc.id, uid, dbFolderLabel,
                                        parsed.from?.text?.substring(0, 100) || 'Unknown',
                                        parsed.subject?.substring(0, 200) || '(No Subject)',
                                        parsed.text ? parsed.text.substring(0, 150) : '',
                                        parsed.html || parsed.textAsHtml || parsed.text || '',
                                        parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                                    ]
                                });
                                count++;
                            }
                        }
                    }
                    if (count > 0) console.log(`   - [${dbFolderLabel}] +${count} new.`);
                } catch (e) { /* Silent fail */ }
            };

            await syncFolder('INBOX', 'INBOX', 10);
            
            if (acc.host.includes('gmail')) {
                await syncFolder('[Gmail]/Sent Mail', 'SENT', 10);
                await syncFolder('[Gmail]/Drafts', 'DRAFTS', 5);
                try { await syncFolder('[Gmail]/Trash', 'TRASH', 5); } catch { await syncFolder('[Gmail]/Bin', 'TRASH', 5); }
            } else {
                await syncFolder('Sent', 'SENT', 10);
                await syncFolder('Drafts', 'DRAFTS', 5);
                await syncFolder('Trash', 'TRASH', 5);
            }

            connection.end();
            await db.execute({ sql: "UPDATE mail_accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?", args: [acc.id] });

        } catch (e) { console.error(`   Fail ${acc.email}: ${e.message}`); }
    }
}

// ============================================================
// PART B: NEWS SCRAPER LOGIC
// ============================================================
const SCRAPER_SOURCES = {
    'Mixed': [
        { url: 'https://www.allsides.com/headline-roundups', base: 'https://www.allsides.com', 
          articleSelector: '.view-content .views-row .news-title a', contentSelector: '.article-description', imageSelector: '.img-fluid',
          keywords: ['politics', 'news', 'world'] }
    ],
    'Wars': [
        { url: 'https://www.reuters.com/world/', base: 'https://www.reuters.com',
          articleSelector: '[data-testid="Heading"] a', contentSelector: 'article p', imageSelector: 'figure img',
          keywords: ['war', 'conflict', 'military', 'ukraine', 'gaza', 'israel', 'russia'] },
        { url: 'https://www.bbc.com/news/world', base: 'https://www.bbc.com',
          articleSelector: '[data-testid="card-headline"]', contentSelector: 'main p', imageSelector: 'img',
          keywords: ['war', 'conflict', 'missile', 'attack'] }
    ],
    'AI': [
        { url: 'https://techcrunch.com/category/artificial-intelligence/', base: 'https://techcrunch.com',
          articleSelector: '.loop-card__title a, h2 a', contentSelector: '.article-content', imageSelector: '.article-hero__image',
          keywords: ['ai', 'gpt', 'openai', 'llm'] }
    ],
    'Tech': [
        { url: 'https://arstechnica.com/gadgets/', base: 'https://arstechnica.com',
          articleSelector: 'header h2 a', contentSelector: '.article-content', imageSelector: 'figure.intro-image img',
          keywords: ['review', 'phone', 'apple', 'chip'] }
    ]
};

async function runScraper() {
    console.log("\n📰 --- STARTING NEWS SCRAPER ---");
    let totalAdded = 0;

    for (const category in SCRAPER_SOURCES) {
        for (const source of SCRAPER_SOURCES[category]) {
            try {
                // Impersonate Chrome
                const { data: listHtml } = await axios.get(source.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    timeout: 10000
                });
                
                const $ = cheerio.load(listHtml);
                const elements = $(source.articleSelector).toArray();
                let count = 0;

                for (const el of elements) {
                    if (count >= 3) break;
                    const title = $(el).text().trim();
                    let link = $(el).attr('href');
                    if (!title || !link) continue;

                    // Keyword check
                    const titleLower = title.toLowerCase();
                    if (!source.keywords.some(k => titleLower.includes(k))) continue;

                    if (!link.startsWith('http')) {
                        const base = source.base || new URL(source.url).origin;
                        link = new URL(link, base).href;
                    }

                    // Duplicate Check
                    const exists = await db.execute({ sql: "SELECT id FROM articles WHERE source_url = ?", args: [link] });
                    if (exists.rows.length === 0) {
                        // Insert (Status 1 = Approved immediately)
                        await db.execute({
                            sql: `INSERT INTO articles (title, content, category, has_photo, image_url, is_automated, source_url, status, created_at, last_activity_at)
                                  VALUES (?, ?, ?, 0, NULL, 1, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            args: [title, `<p>Auto-scraped from ${source.url}</p>`, category, link]
                        });
                        console.log(`   + [${category}] ${title}`);
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
}

// ============================================================
// MAIN ENTRY
// ============================================================
async function main() {
    await runEmailSync();
    await runScraper();
    console.log("\n✅ WORKER JOB COMPLETE");
}

main();
