const fs = require("fs");
const path = require("path");

const FILE = path.resolve(__dirname,"../state/last_proxy_run.json");

function getLastRuns(){
  try{
    return JSON.parse(fs.readFileSync(FILE,"utf8"));
  }catch{
    return {};
  }
}

function saveRuns(obj){
  fs.writeFileSync(FILE,JSON.stringify(obj),"utf8");
}

module.exports = { getLastRuns, saveRuns };