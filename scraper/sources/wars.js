// scraper/sources/wars.js
module.exports = [
  { 
    name: 'BBC World',
    url: 'https://www.bbc.com/news/world', 
    base: 'https://www.bbc.com',
    rss: [
      'https://feeds.bbci.co.uk/news/world/rss.xml'
    ],
    selectors: ['[data-testid="card-headline"]', 'h2[data-testid="card-headline"]'], 
    keywords: ['war', 'conflict', 'missile', 'attack', 'gaza', 'ukraine', 'russia'],
    useProxy: false,
    weight: 2
  },
  { 
    name: 'Reuters',
    url: 'https://www.reuters.com/world/', 
    base: 'https://www.reuters.com',
    rss: [
      'https://www.reutersagency.com/feed/?best-topics=world',
      'https://www.reutersagency.com/feed/?best-topics=technology'
    ],
    selectors: ['[data-testid="Heading"] a', '.story-card a', 'h3 a'], 
    keywords: ['war', 'military', 'strike', 'army', 'truce'],
    useProxy: true,
    weight: 2
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/where/middle-east/',
    base: 'https://www.aljazeera.com',
    rss: [
      'https://www.aljazeera.com/xml/rss/all.xml'
    ],
    selectors: ['h3.gc__title a', '.article-card__title a'],
    keywords: ['war', 'bomb', 'killed', 'strike'],
    useProxy: true,
    weight: 1
  },
  {
    name: 'CNN',
    url: 'https://edition.cnn.com/world',
    base: 'https://edition.cnn.com',
    rss: [
      'http://rss.cnn.com/rss/edition_world.rss'
    ],
    selectors: ['.container__headline-text', '.cd__headline-text'],
    keywords: ['war', 'conflict'],
    useProxy: true,
    render: true,
    weight: 2
  },
  { 
    name: 'AP World',
    url: 'https://apnews.com/hub/world-news',
    base: 'https://apnews.com',
    rss: [
      'https://apnews.com/rss'
    ],
    selectors: ['.PagePromo-content a', 'h3.PagePromo-title a'],
    keywords: ['war', 'conflict', 'gaza', 'ukraine', 'russia', 'military'],
    useProxy: false,
    weight: 1
  },
  {
    name: 'Sky News',
    url: 'https://news.sky.com/world',
    base: 'https://news.sky.com',
    rss: [
      'https://feeds.skynews.com/feeds/rss/world.xml',
      'https://feeds.skynews.com/feeds/rss/home.xml'
    ],
    selectors: ['h3 a'],
    keywords: ['war', 'conflict', 'military', 'attack'],
    useProxy: true,
    weight: 1
  }
];