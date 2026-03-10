const isDuplicate = require("./duplicateCheck");
const fetchPage = require("./fetchPage");
const extractArticle = require("./extractArticle");

module.exports = async function ingestArticle(db,source,title,link,category,API_KEY){

  if(await isDuplicate(db,link)) return {duplicate:true};

  const html = await fetchPage(link,source,API_KEY);
  if(!html) return {failed:true};

  const meta = extractArticle(html,source);
  if(!meta) return {failed:true};

  await db.execute({
    sql:`INSERT INTO articles (title,content,category)
         VALUES (?,?,?)`,
    args:[title,meta.text,category]
  });

  return {added:true};

};
