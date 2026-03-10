// scraper/sources/mixed.js
module.exports = [
  { 
    name: 'AllSides',
    url: 'https://www.allsides.com/headline-roundups', 
    base: 'https://www.allsides.com', 
    rss: [
      'https://www.allsides.com/rss.xml'
    ],
    selectors: ['.news-title a', 'h2 a'], 
    keywords: ['politics', 'news', 'world', 'election'],
    useProxy: true,
    weight: 2
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world',
    base: 'https://www.theguardian.com',
    rss: [
      'https://www.theguardian.com/world/rss',
      'https://www.theguardian.com/rss'
    ],
    selectors: ['.fc-item__title a', 'h3 a', '[data-link-name="article"]'],
    keywords: ['politics', 'crisis', 'un', 'treaty', 'world'],
    useProxy: false,
    weight: 1
  },
  {
    name: 'NPR',
    url: 'https://www.npr.org/sections/world/',
    base: 'https://www.npr.org',
    rss: [
      'https://feeds.npr.org/1004/rss.xml'
    ],
    selectors: ['h2 a', '.teaser a'],
    keywords: ['politics', 'war', 'world', 'conflict'],
    useProxy: false,
    weight: 1
  },
  {
    name: 'Politico',
    url: 'https://www.politico.com/news',
    base: 'https://www.politico.com',
    rss: [
      'https://www.politico.com/rss/politics08.xml',
      'https://www.politico.com/rss/congress.xml'
    ],
    selectors: ['a[data-testid="headline"]', 'h3 a'],
    keywords: ['election', 'policy', 'congress', 'white house'],
    useProxy: true,
    weight: 2
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/world',
    base: 'https://www.ft.com',
    rss: [
      'https://www.ft.com/rss/home',
      'https://www.ft.com/rss/world'
    ],
    selectors: ['h3 a'],
    keywords: ['economy', 'market', 'war', 'global'],
    useProxy: true,
    weight: 2
  }
];