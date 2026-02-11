const { createClient } = require('@libsql/client');
const runEmailSync = require('./email');
const runScraper = require('./news');

// --- GLOBAL CONFIG ---
const DB_URL = process.env.HTC_TURSO_DATABASE_URL;
const DB_TOKEN = process.env.HTC_TURSO_AUTH_TOKEN;

if (!DB_URL || !DB_TOKEN) {
    console.error("❌ Missing Database Variables");
    process.exit(1);
}

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

async function main() {
    const args = process.argv.slice(2);
    const runNews = args.includes('--news');
    const runEmail = args.includes('--email');
    const runAll = !runNews && !runEmail;

    console.log(`[Worker] Mode: ${runAll ? 'ALL' : args.join(', ')}`);

    if (runAll || runEmail) {
        await runEmailSync(db, process.env.MAIL_SECRET_KEY);
    }

    if (runAll || runNews) {
        await runScraper(db, process.env.SCRAPER_API_KEY);
    }

    console.log("\n✅ WORKER JOB COMPLETE");
    process.exit(0);
}

main();
