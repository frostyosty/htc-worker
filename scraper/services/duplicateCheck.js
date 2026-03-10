const stringSimilarity = require("string-similarity");

module.exports = async function isDuplicate(db, title, link) {

  // 1️⃣ FIRST: check exact URL duplicate
  const existing = await db.execute({
    sql: `
      SELECT id
      FROM articles
      WHERE source_url = ?
      LIMIT 1
    `,
    args: [link]
  });

  if (existing.rows.length > 0) {
    return true;
  }

  // 2️⃣ SECOND: check title similarity for recent articles
  const recent = await db.execute({
    sql: `
      SELECT title
      FROM articles
      WHERE created_at > datetime('now','-2 days')
      LIMIT 200
    `
  });

  const titles = recent.rows.map(r => r.title);

  if (titles.length === 0) return false;

  const match = stringSimilarity.findBestMatch(title, titles);

  return match.bestMatch.rating > 0.90; // slightly stricter
};
