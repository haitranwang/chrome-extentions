// Background service worker for Chrome Extension

let openedTokens = new Map(); // tokenId -> timestamp
let tokenUrlToId = new Map(); // tokenUrl -> tokenId
let tabIdToTokenInfo = new Map(); // tabId -> {tokenId, tokenUrl, timestamp}
let settings = {
  cooldownMinutes: 15,
  maxTabs: 10
};

// Load settings from storage
async function loadSettings() {
  const data = await chrome.storage.local.get(['cooldownMinutes', 'maxTabs']);
  if (data.cooldownMinutes) settings.cooldownMinutes = data.cooldownMinutes;
  if (data.maxTabs) settings.maxTabs = data.maxTabs;
  console.log('Settings loaded:', settings);
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('DexScreener Extension installed');
  await loadSettings();
});

// Listen for settings changes
chrome.storage.onChanged.addListener(() => {
  loadSettings();
});

// Initialize settings on startup
loadSettings();

let openedFilterUrls = new Set(); // Track opened filter URLs

// Listen for tab removal to clean up counters
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Check if we're tracking this tab ID
  if (tabIdToTokenInfo.has(tabId)) {
    const { tokenId, tokenUrl } = tabIdToTokenInfo.get(tabId);

    // Remove from all tracking structures
    openedTokens.delete(tokenId);
    tokenUrlToId.delete(tokenUrl);
    tabIdToTokenInfo.delete(tabId);

    console.log(`🗑️ Tab closed: Removed ${tokenId} from tracker (${openedTokens.size}/${settings.maxTabs} tabs remaining)`);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tokenMatchesFilter') {
    // Open token tab and keep channel open for async response
    openTokenTab(request.tokenId, request.chain || 'solana').then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getStats') {
    // Return statistics
    sendResponse({
      tabCount: openedTokens.size,
      settings: settings,
      filterUrlCount: openedFilterUrls.size
    });
  } else if (request.action === 'openFilterUrl') {
    openFilterUrl(request.url).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getOpenedTokens') {
    // Return list of opened tokens with timestamps for countdown display
    const tokenData = Array.from(openedTokens.entries()).map(([tokenId, timestamp]) => ({
      tokenId,
      timestamp,
      cooldownMs: settings.cooldownMinutes * 60 * 1000
    }));
    sendResponse({ tokens: tokenData });
    return true;
  }
});

// Function to open token tab with configurable cooldown and max tabs limit
async function openTokenTab(tokenId, chain = 'solana') {
  try {
    const now = Date.now();
    const cooldownPeriod = settings.cooldownMinutes * 60 * 1000; // Convert to milliseconds

    // Check cooldown with configured period
    const lastOpened = openedTokens.get(tokenId);
    if (lastOpened && (now - lastOpened < cooldownPeriod)) {
      console.log(`Token ${tokenId} (${chain}) is in cooldown (${Math.ceil((cooldownPeriod - (now - lastOpened)) / 1000 / 60)}m remaining)`);
      return;
    }

    // Check if token already exists in any tab
    const tabs = await chrome.tabs.query({});
    const tokenUrl = `https://dexscreener.com/${chain}/${tokenId}`;

    for (const tab of tabs) {
      if (tab.url === tokenUrl) {
        console.log(`Token ${tokenId} (${chain}) already open`);
        openedTokens.set(tokenId, now);
        return;
      }
    }

    // IMPORTANT: Check maximum tabs limit BEFORE opening new tabs
    const openedTokenCount = openedTokens.size;
    if (openedTokenCount >= settings.maxTabs) {
      console.log(`Maximum tabs limit reached (${settings.maxTabs}/${openedTokenCount}). Skipping ${tokenId} (${chain})`);
      return;
    }

    // Open new tab and store the mapping
    const createdTab = await chrome.tabs.create({ url: tokenUrl, active: false });
    openedTokens.set(tokenId, now);
    tokenUrlToId.set(tokenUrl, tokenId);
    tabIdToTokenInfo.set(createdTab.id, { tokenId, tokenUrl, timestamp: now });

    console.log(`✅ Opened token ${tokenId} on ${chain} (${openedTokens.size}/${settings.maxTabs} tabs)`);

    // Clean up old entries (older than cooldown period)
    for (const [token, timestamp] of openedTokens.entries()) {
      if (now - timestamp > cooldownPeriod) {
        openedTokens.delete(token);
        // Clean up from URL mapping as well
        for (const [url, id] of tokenUrlToId.entries()) {
          if (id === token) {
            tokenUrlToId.delete(url);
          }
        }
        // Clean up from tabId mapping as well
        for (const [tabId, info] of tabIdToTokenInfo.entries()) {
          if (info.tokenId === token) {
            tabIdToTokenInfo.delete(tabId);
          }
        }
        console.log(`🗑️ Removed expired token from cache: ${token}`);
      }
    }
  } catch (error) {
    console.error('Error opening token tab:', error);
  }
}

// Function to open filter URL in new tab
async function openFilterUrl(url) {
  try {
    // Skip if we've already opened this URL
    if (openedFilterUrls.has(url)) {
      console.log('⏭️ Filter URL already opened:', url);
      return;
    }

    // Check all tabs to see if URL is already open
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url === url) {
        console.log('⏭️ Filter URL already open in tab:', url);
        openedFilterUrls.add(url);
        return;
      }
    }

    // Check maximum tabs limit
    const totalOpenTabs = openedFilterUrls.size + openedTokens.size;
    if (totalOpenTabs >= settings.maxTabs) {
      console.log(`⚠️ Maximum tabs limit reached (${settings.maxTabs}). Skipping filter URL`);
      return;
    }

    // Open new tab with filter URL
    await chrome.tabs.create({ url: url, active: false });
    openedFilterUrls.add(url);

    console.log(`🌐 Opened filter URL: ${url}`);
    console.log(`📊 Total filter URLs opened: ${openedFilterUrls.size}`);

    // Clean up old filter URLs (keep only last 50)
    if (openedFilterUrls.size > 50) {
      const urls = Array.from(openedFilterUrls);
      openedFilterUrls = new Set(urls.slice(25)); // Keep last 25
      console.log('🗑️ Cleaned up old filter URLs');
    }
  } catch (error) {
    console.error('Error opening filter URL:', error);
  }
}

// Note: Service workers don't have a 'window' object
// For debugging, use: console.log(openedTokens);

