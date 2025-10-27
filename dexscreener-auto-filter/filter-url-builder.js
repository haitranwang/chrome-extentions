// Filter URL Builder for DexScreener Extension

/**
 * Build a DexScreener filter URL from parameters
 * @param {Object} filters - Filter parameters object
 * @param {string} baseUrl - Base URL (default: https://dexscreener.com/new-pairs)
 * @returns {string} Complete filter URL
 */
function buildDexScreenerFilterUrl(filters, baseUrl = 'https://dexscreener.com/new-pairs') {
  const params = new URLSearchParams();

  // Basic Filters
  if (filters.minLiq) params.set('minLiq', filters.minLiq);
  if (filters.maxLiq) params.set('maxLiq', filters.maxLiq);
  if (filters.maxAge) params.set('maxAge', filters.maxAge);
  if (filters.minAge) params.set('minAge', filters.minAge);

  // Market Cap (Note: DexScreener uses "MarketCap" not "mcap")
  if (filters.minMarketCap) params.set('minMarketCap', filters.minMarketCap);
  if (filters.maxMarketCap) params.set('maxMarketCap', filters.maxMarketCap);

  // Fully Diluted Valuation
  if (filters.minFdv) params.set('minFdv', filters.minFdv);
  if (filters.maxFdv) params.set('maxFdv', filters.maxFdv);

  // 24-Hour Metrics
  if (filters.min24HTxns) params.set('min24HTxns', filters.min24HTxns);
  if (filters.max24HTxns) params.set('max24HTxns', filters.max24HTxns);
  if (filters.min24HBuys) params.set('min24HBuys', filters.min24HBuys);
  if (filters.max24HBuys) params.set('max24HBuys', filters.max24HBuys);
  if (filters.min24HSells) params.set('min24HSells', filters.min24HSells);
  if (filters.max24HSells) params.set('max24HSells', filters.max24HSells);
  if (filters.min24HVol) params.set('min24HVol', filters.min24HVol);
  if (filters.max24HVol) params.set('max24HVol', filters.max24HVol);
  if (filters.min24HChg) params.set('min24HChg', filters.min24HChg);
  if (filters.max24HChg) params.set('max24HChg', filters.max24HChg);

  // 6-Hour Metrics
  if (filters.min6HTxns) params.set('min6HTxns', filters.min6HTxns);
  if (filters.max6HTxns) params.set('max6HTxns', filters.max6HTxns);
  if (filters.min6HBuys) params.set('min6HBuys', filters.min6HBuys);
  if (filters.max6HBuys) params.set('max6HBuys', filters.max6HBuys);
  if (filters.min6HSells) params.set('min6HSells', filters.min6HSells);
  if (filters.max6HSells) params.set('max6HSells', filters.max6HSells);
  if (filters.min6HVol) params.set('min6HVol', filters.min6HVol);
  if (filters.max6HVol) params.set('max6HVol', filters.max6HVol);
  if (filters.min6HChg) params.set('min6HChg', filters.min6HChg);
  if (filters.max6HChg) params.set('max6HChg', filters.max6HChg);

  // 1-Hour Metrics
  if (filters.min1HTxns) params.set('min1HTxns', filters.min1HTxns);
  if (filters.max1HTxns) params.set('max1HTxns', filters.max1HTxns);
  if (filters.min1HBuys) params.set('min1HBuys', filters.min1HBuys);
  if (filters.max1HBuys) params.set('max1HBuys', filters.max1HBuys);
  if (filters.min1HSells) params.set('min1HSells', filters.min1HSells);
  if (filters.max1HSells) params.set('max1HSells', filters.max1HSells);
  if (filters.min1HVol) params.set('min1HVol', filters.min1HVol);
  if (filters.max1HVol) params.set('max1HVol', filters.max1HVol);
  if (filters.min1HChg) params.set('min1HChg', filters.min1HChg);
  if (filters.max1HChg) params.set('max1HChg', filters.max1HChg);

  // 5-Minute Metrics
  if (filters.min5MTxns) params.set('min5MTxns', filters.min5MTxns);
  if (filters.max5MTxns) params.set('max5MTxns', filters.max5MTxns);
  if (filters.min5MBuys) params.set('min5MBuys', filters.min5MBuys);
  if (filters.max5MBuys) params.set('max5MBuys', filters.max5MBuys);
  if (filters.min5MSells) params.set('min5MSells', filters.min5MSells);
  if (filters.max5MSells) params.set('max5MSells', filters.max5MSells);
  if (filters.min5MVol) params.set('min5MVol', filters.min5MVol);
  if (filters.max5MVol) params.set('max5MVol', filters.max5MVol);
  if (filters.min5MChg) params.set('min5MChg', filters.min5MChg);
  if (filters.max5MChg) params.set('max5MChg', filters.max5MChg);

  // Additional Filters
  if (filters.label) params.set('label', filters.label);
  if (filters.suffixes) params.set('suffixes', filters.suffixes);

  // Sorting
  if (filters.rankBy) params.set('rankBy', filters.rankBy);
  if (filters.order) params.set('order', filters.order);

  return `${baseUrl}?${params.toString()}`;
}

// Example usage and helper functions
const DexScreenerFilterBuilder = {
  /**
   * Build filter URL
   */
  build: buildDexScreenerFilterUrl,

  /**
   * Predefined filter templates
   */
  templates: {
    highLiquidity: {
      minLiq: 100000,
      order: 'desc'
    },

    bigMovers24h: {
      minLiq: 50000,
      min24HVol: 100000,
      min24HChg: 20,
      max24HChg: 100,
      order: 'desc'
    },

    trending6h: {
      minLiq: 25000,
      min6HVol: 25000,
      min6HChg: 10,
      rankBy: 'trendingScoreH6',
      order: 'desc'
    },

    veryNew: {
      maxAge: 6,
      minLiq: 50000,
      min24HVol: 50000,
      order: 'desc'
    },

    steadyRiser: {
      minLiq: 50000,
      min24HVol: 100000,
      min24HChg: 5,
      max24HChg: 30,
      min24HBuys: 100,
      order: 'desc'
    }
  },

  /**
   * Open filter URL in new tab
   */
  open: async function(filters, baseUrl) {
    const url = buildDexScreenerFilterUrl(filters, baseUrl);
    chrome.tabs.create({ url: url, active: false });
    console.log('🌐 Opened filter URL:', url);
  },

  /**
   * Copy filter URL to clipboard
   */
  copy: function(filters, baseUrl) {
    const url = buildDexScreenerFilterUrl(filters, baseUrl);
    navigator.clipboard.writeText(url);
    console.log('📋 Copied filter URL to clipboard:', url);
  }
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DexScreenerFilterBuilder;
} else {
  window.DexScreenerFilterBuilder = DexScreenerFilterBuilder;
}

// Examples:
/*
// High liquidity pairs
const url1 = DexScreenerFilterBuilder.build({
  minLiq: 100000,
  maxAge: 24,
  order: 'desc'
});
// Result: https://dexscreener.com/new-pairs?minLiq=100000&maxAge=24&order=desc

// Big winners with volume
const url2 = DexScreenerFilterBuilder.build({
  minLiq: 50000,
  min24HVol: 100000,
  min24HChg: 50,
  order: 'desc'
});

// Using template
const url3 = DexScreenerFilterBuilder.build(DexScreenerFilterBuilder.templates.bigMovers24h);

// Open directly
await DexScreenerFilterBuilder.open({
  minLiq: 10000,
  min24HChg: 10,
  order: 'desc'
});
*/

