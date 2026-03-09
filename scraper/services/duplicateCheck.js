const stringSimilarity = require("string-similarity");

module.exports = async function isDuplicate(db, title) {

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

  return match.bestMatch.rating > 0.82;
};