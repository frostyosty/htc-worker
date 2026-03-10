module.exports = function rankSources(list){

  return list
    .map(s=>{

      const weight = s.weight || 1;
      const success = s.success || 0;
      const freshness = s.freshness || 0;

      const score = weight + success + freshness;

      return {...s,score};

    })
    .sort((a,b)=>b.score-a.score);

};