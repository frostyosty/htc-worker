// scraper/sources/ai.js
module.exports = [
  { 
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/', 
    base: 'https://techcrunch.com',
    selectors: ['h2.post-block__title a', '.loop-card__title a'], 
    keywords: ['ai', 'gpt', 'openai', 'llm', 'model'],
    weight: 2
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    base: 'https://www.theverge.com',
    selectors: ['h2 a', '.duet--content-cards--content-card_headline'],
    keywords: ['ai', 'chatgpt', 'google', 'gemini'],
    useProxy: false,
    weight: 1
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/ai/',
    base: 'https://www.technologyreview.com',
    selectors: ['h3 a', '.river__hed-link'],
    keywords: ['ai', 'machine learning', 'gpt', 'neural network'],
    useProxy: false,
    weight: 1
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/',
    base: 'https://venturebeat.com',
    selectors: ['h2.entry-title a', '.article-title a'],
    keywords: ['ai', 'gpt', 'llm', 'machine learning'],
    useProxy: false,
    weight: 1
  }
];