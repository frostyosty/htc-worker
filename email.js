const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');

module.exports = async function runEmailSync(db, SECRET_KEY) {
    console.log("\n📧 --- STARTING EMAIL SYNC ---");
    
    // Helper: Decrypt
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

    if (!SECRET_KEY) {
        console.error("❌ Skipping Email Sync: MAIL_SECRET_KEY is missing.");
        return;
    }

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
};
