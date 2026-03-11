const isDuplicate = require("./duplicateCheck");
const fetchPage = require("./fetchPage");
const extractArticle = require("./extractArticle");

module.exports = async function ingestArticle(db, source, title, link, category, API_KEY) {

  if(await isDuplicate(db, title, link))
    return {duplicate: true};

  const html = await fetchPage(link, source, API_KEY);
  if(!html) return {failed: true};

  const meta = extractArticle(html, source);
  if(!meta || !meta.text) return {failed:true};

  // 🛠️ FIX: Remove consecutive duplicate paragraphs (Fixes double image captions)
  // Split by newlines, |||, or HTML tags depending on how your text is formatted
  let paragraphs = meta.text.split(/\n|\|\|\||<br\s*\/?>|<\/?p>/);
  
  let cleanedParagraphs = paragraphs.filter((line, index, arr) => {
    const trimmed = line.trim();
    if (!trimmed) return false; // Remove empty lines
    
    // If this line is identical to the previous line, filter it out
    if (index > 0 && arr[index - 1].trim() === trimmed) {
      return false;
    }
    return true;
  });

  // Rejoin with your preferred separator (using double newline for spacing)
  let finalCleanText = cleanedParagraphs.join('\n\n');

  await db.execute({
    sql:`
      INSERT INTO articles
      (title, content, category, source_url, image_url, has_photo, status, is_automated, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
    `,
    args:[
      title,
      finalCleanText, // <-- Use the cleaned text here
      category,
      link,
      meta.image || null,
      meta.image ? 1 : 0
    ]
  });

  return {added: true};

};
