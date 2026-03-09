// scraper/sources/tech.js
module.exports = [
  { 
    name: 'Ars Technica',
    url: 'https://arstechnica.com/gadgets/', 
    base: 'https://arstechnica.com',
    selectors: ['h2 a', '.article-overlay a'], 
    keywords: ['review', 'apple', 'chip', 'android'],
    weight: 1
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/category/gear/',
    base: 'https://www.wired.com',
    selectors: ['.SummaryItemHedLink-civMjp', 'div[class*="SummaryItem"] a', 'h3 a'],
    keywords: ['gear', 'phone', 'laptop'],
    useProxy: true,
    weight: 2
  },
  {
    name: 'Bloomberg Tech',
    url: 'https://www.bloomberg.com/technology',
    base: 'https://www.bloomberg.com',
    selectors: ['h3 a'],
    keywords: ['ai', 'chip', 'apple', 'google', 'tech'],
    useProxy: true,
    weight: 1
  },
  {
    name: 'Engadget',
    url: 'https://www.engadget.com/tech/',
    base: 'https://www.engadget.com',
    selectors: ['h2 a', '.o-hit__title a'],
    keywords: ['gadget', 'phone', 'laptop', 'apple', 'android'],
    useProxy: false,
    weight: 1
  },
  {
    name: 'The Verge Tech',
    url: 'https://www.theverge.com/tech',
    base: 'https://www.theverge.com',
    selectors: ['h2 a', '.c-entry-box--compact__title a'],
    keywords: ['tech', 'apple', 'google', 'laptop', 'phone'],
    useProxy: false,
    weight: 1
  }
];