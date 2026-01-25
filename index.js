// index.js in the PUBLIC repo
const { createClient } = require('@libsql/client');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');

// Secrets come from Environment, NOT hardcoded
const DB_URL = process.env.HTC_TURSO_DATABASE_URL;
const DB_TOKEN = process.env.HTC_TURSO_AUTH_TOKEN;
const SECRET_KEY = process.env.MAIL_SECRET_KEY;

if (!DB_URL || !DB_TOKEN || !SECRET_KEY) {
    console.error("❌ Missing Environment Variables");
    process.exit(1);
}

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

// --- CRYPTO HELPER (Re-implemented for standalone script) ---
function decrypt(text, ivHex) {
    try {
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(text, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SECRET_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

async function run() {
    console.log("🚀 Starting Global Email Sync...");
    
    // 1. Get ALL accounts (No limits)
    const rs = await db.execute("SELECT * FROM mail_accounts");
    const accounts = rs.rows;
    console.log(`Found ${accounts.length} accounts.`);

    for (const acc of accounts) {
        console.log(`\n📧 Processing ${acc.email}...`);
        
        try {
            const password = decrypt(acc.encrypted_password, acc.iv);
            if (!password) {
                console.error("   - Decryption failed");
                continue;
            }

            const config = {
                imap: {
                    user: acc.email,
                    password: password,
                    host: acc.host,
                    port: acc.port || 993,
                    tls: true,
                    authTimeout: 10000, // Long timeout allowed now!
                    tlsOptions: { rejectUnauthorized: false }
                }
            };

            const connection = await imaps.connect(config);
            
            // 🟢 FIX: Correct way to get box info
            const box = await connection.openBox('INBOX');
            const totalMessages = box.messages.total;

            if (totalMessages === 0) {
                console.log("   - Empty Inbox");
                connection.end();
                continue;
            }

            // Fetch last 5 emails
            const fetchStart = Math.max(1, totalMessages - 4); 
            const fetchRange = `${fetchStart}:*`;
            
            console.log(`   - Fetching ${fetchRange} (Total: ${totalMessages})`);
            
            const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false, struct: true };
            const messages = await connection.fetch(fetchRange, fetchOptions);

            let newCount = 0;

            for (const msg of messages) {
                const uid = msg.attributes.uid;
                
                // Check DB
                const exists = await db.execute({
                    sql: "SELECT id FROM mail_messages WHERE account_id = ? AND uid = ?",
                    args: [acc.id, uid]
                });

                if (exists.rows.length === 0) {
                    const all = msg.parts.find(p => p.which === '');
                    const parsed = await simpleParser(all.body);
                    
                    await db.execute({
                        sql: `INSERT INTO mail_messages (account_id, uid, sender, subject, preview, full_body, received_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        args: [
                            acc.id, 
                            uid, 
                            parsed.from?.text?.substring(0, 100) || 'Unknown', 
                            parsed.subject?.substring(0, 200) || '(No Subject)', 
                            parsed.text ? parsed.text.substring(0, 150) : '',
                            parsed.html || parsed.textAsHtml || parsed.text || '', 
                            parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                        ]
                    });
                    newCount++;
                }
            }
            
            console.log(`   - Synced ${newCount} new messages.`);
            connection.end();

            // Update timestamp
            await db.execute({
                sql: "UPDATE mail_accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?",
                args: [acc.id]
            });

        } catch (e) {
            console.error(`   - Error: ${e.message}`);
        }
    }
    
    console.log("\n✅ Global Sync Complete.");
}

run();
