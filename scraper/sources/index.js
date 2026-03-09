// scraper/sources/index.js
const mixed = require('./mixed');
const wars = require('./wars');
const ai = require('./ai');
const tech = require('./tech');

module.exports = {
  Mixed: mixed,
  Wars: wars,
  AI: ai,
  Tech: tech
};