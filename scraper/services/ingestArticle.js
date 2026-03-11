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

  // 🔥 THE PRIMO SCRAPER TEXT CLEANER 🔥
  
  // 1. Normalize ALL line breaks, <br>, and <p> tags into exactly "|||"
  let normalizedText = meta.text
    .replace(/<\/?p>/gi, '|||')       // Turn HTML paragraphs into |||
    .replace(/<br\s*\/?>/gi, '|||')   // Turn HTML breaks into |||
    .replace(/\n+/g, '|||')           // Turn actual newlines into |||
    .replace(/\|\|\|+/g, '|||');      // Collapse multiple ||| into a single |||

  // 2. Filter the chunks
  let chunks = normalizedText.split('|||');
  
  let cleanedChunks = chunks.filter((text, index, arr) => {
    const trimmed = text.trim();
    
    // Remove empty chunks
    if (!trimmed) return false; 
    
    // Pro-tip: Remove tiny garbage chunks (like "Share", "By AP", etc.)
    if (trimmed.length < 10 && !trimmed.includes('?')) return false;

    // Remove consecutive duplicates (Fixes the AP News double image caption!)
    if (index > 0 && arr[index - 1].trim() === trimmed) return false;
    
    return true;
  }).map(t => t.trim());

  // 3. Rejoin cleanly for the frontend
  let finalCleanText = cleanedChunks.join('|||');

  // Skip if after cleaning, there's no real content left
  if(finalCleanText.length < 50) return {failed:true};

  // 4. Insert into database
  await db.execute({
    sql:`
      INSERT INTO articles
      (title, content, category, source_url, image_url, has_photo, status, is_automated, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
    `,
    args:[
      title,
      finalCleanText, // <-- Use the newly formatted text
      category,
      link,
      meta.image || null,
      meta.image ? 1 : 0
    ]
  });

  return {added: true};

};
