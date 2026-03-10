const isDuplicate = require("./duplicateCheck");
const fetchPage = require("./fetchPage");
const extractArticle = require("./extractArticle");

module.exports = async function ingestArticle(db,source,title,link,category,API_KEY){

  if(await isDuplicate(db,title,link))
    return {duplicate:true};

  const html = await fetchPage(link,source,API_KEY);
  if(!html) return {failed:true};

  const meta = extractArticle(html,source);
  if(!meta || !meta.text) return {failed:true};

  await db.execute({
    sql:`
      INSERT INTO articles
      (title,content,category,source_url,image_url,has_photo,created_at)
      VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `,
    args:[
      title,
      meta.text,
      category,
      link,
      meta.image || null,
      meta.image ? 1 : 0
    ]
  });

  return {added:true};

};
