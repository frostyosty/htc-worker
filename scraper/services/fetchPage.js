const axios = require("axios");

module.exports = async function fetchPage(url, config, API_KEY) {

  const headers = {
    "User-Agent": "Mozilla/5.0 Chrome/120 Safari/537"
  };

  if (config.useProxy && API_KEY) {

    const res = await axios.get("http://api.scraperapi.com", {
      params: {
        api_key: API_KEY,
        url,
        render: config.render ? "true" : "false"
      },
      timeout: 30000
    });

    return res.data;
  }

  const res = await axios.get(url, { headers, timeout: 15000 });
  return res.data;
}; 