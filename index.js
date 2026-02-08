const { createClient } = require('@libsql/client');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');

// --- CONFIG ---
const DB_URL = process.env.HTC_TURSO_DATABASE_URL;
const DB_TOKEN = process.env.HTC_TURSO_AUTH_TOKEN;
const SECRET_KEY = process.env.MAIL_SECRET_KEY;

if (!DB_URL || !DB_TOKEN || !SECRET_KEY) {
    console.error("❌ Missing Environment Variables");
    process.exit(1);
}

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

// --- HELPERS ---
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
    console.log("🚀 Starting Ultimate Email Sync (Inbox, Sent, Drafts, Trash)...");
    
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
                    authTimeout: 10000, 
                    tlsOptions: { rejectUnauthorized: false }
                }
            };

            const connection = await imaps.connect(config);
            
            connection.on('error', (err) => {
                console.warn("   - IMAP Connection Warning:", err.message);
            });

            // 🟢 REUSABLE SYNC ENGINE
            const syncFolder = async (boxName, dbFolderLabel, limit = 8) => {
                try {
                    await connection.openBox(boxName);
                    
                    // Fetch last 5 days (Keeps it fast)
                    const date = new Date();
                    date.setDate(date.getDate() - 5); 
                    const searchCriteria = [['SINCE', date.toISOString()]];
                    const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false, struct: true };

                    const messages = await connection.search(searchCriteria, fetchOptions);
                    
                    // Apply strict limit (e.g. only top 5 drafts)
                    const recent = messages.reverse().slice(0, limit); 

                    let count = 0;
                    for (const msg of recent) {
                        const uid = msg.attributes.uid;
                        
                        // Check DB
                        const exists = await db.execute({
                            sql: "SELECT id FROM mail_messages WHERE account_id = ? AND uid = ? AND folder = ?",
                            args: [acc.id, uid, dbFolderLabel]
                        });

                        if (exists.rows.length === 0) {
                            const all = msg.parts.find(p => p.which === '');
                            if (all && all.body) {
                                const parsed = await simpleParser(all.body);
                                
                                await db.execute({
                                    sql: `INSERT INTO mail_messages (account_id, uid, folder, sender, subject, preview, full_body, received_at)
                                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    args: [
                                        acc.id, 
                                        uid, 
                                        dbFolderLabel, 
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
                    console.log(`   - [${dbFolderLabel}] Synced ${count} new items (Limit: ${limit}).`);
                } catch (e) {
                    // Silent fail for missing folders
                }
            };

            // ============================================
            // 1. INBOX (Priority) - Sync 10
            // ============================================
            await syncFolder('INBOX', 'INBOX', 10);

            // ============================================
            // 2. SENT - Sync 10
            // ============================================
            if (acc.host.includes('gmail')) await syncFolder('[Gmail]/Sent Mail', 'SENT', 10);
            else if (acc.host.includes('outlook') || acc.host.includes('office365')) await syncFolder('Sent Items', 'SENT', 10);
            else await syncFolder('Sent', 'SENT', 10);

            // ============================================
            // 3. DRAFTS - Sync 5 (Prevent Clutter)
            // ============================================
            if (acc.host.includes('gmail')) await syncFolder('[Gmail]/Drafts', 'DRAFTS', 5);
            else await syncFolder('Drafts', 'DRAFTS', 5);

            // ============================================
            // 4. TRASH - Sync 5 (Just in case)
            // ============================================
            if (acc.host.includes('gmail')) await syncFolder('[Gmail]/Trash', 'TRASH', 5);
            else if (acc.host.includes('outlook') || acc.host.includes('office365')) await syncFolder('Deleted Items', 'TRASH', 5);
            else await syncFolder('Trash', 'TRASH', 5);
            
            connection.end();

            await db.execute({
                sql: "UPDATE mail_accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?",
                args: [acc.id]
            });

      } catch (e) {
            console.error(`   ❌ Failed to sync ${acc.email}: ${e.message}`);
        }
    }
    
    console.log("\n✅ Global Sync Complete.");
    process.exit(0);
}
run();
