module.exports = function selectSourcesForRun(sources, max = 6){

  const weighted = [];

  for (const src of sources){

    const weight = src.weight || 1;

    for (let i=0;i<weight;i++){
      weighted.push(src);
    }
  }

  weighted.sort(()=>Math.random()-0.5);

  const unique = [];
  const seen = new Set();

  for (const src of weighted){

    if(!seen.has(src.name)){
      unique.push(src);
      seen.add(src.name);
    }

    if(unique.length >= max) break;
  }

  return unique;
};