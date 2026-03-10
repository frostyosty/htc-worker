module.exports = function createBudget(limit){

  let count = 0;

  return {

    add(n=1){
      count += n;
    },

    reached(){
      return count >= limit;
    },

    remaining(){
      return Math.max(0,limit-count);
    }

  };

};