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

    // Remove only from tab tracking, but KEEP token in openedTokens for cooldown
    // This ensures tokens remain in cooldown even after tab is closed
    tokenUrlToId.delete(tokenUrl);
    tabIdToTokenInfo.delete(tabId);

    // NOTE: We deliberately DON'T delete from openedTokens here
    // because the token should remain in cooldown even if the tab is closed
    // The token will be removed from openedTokens after cooldown period expires

    console.log(`🗑️ Tab closed: ${tokenId} (tab tracking removed, cooldown maintained)`);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tokenMatchesFilter') {
    openTokenTab(request.tokenId, request.chain || 'solana').then((opened) => {
      if (opened) {
        const now = Date.now();
        const cooldownMs = settings.cooldownMinutes * 60 * 1000;
        sendResponse({
          success: true,
          timestamp: now,
          cooldownMs: cooldownMs,
          tokenId: request.tokenId
        });
      } else {
        sendResponse({ success: false, tokenId: request.tokenId });
      }
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getStats') {
    // Return statistics
    sendResponse({
      tabCount: tabIdToTokenInfo.size, // Count actually open tabs
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
  } else if (request.action === 'getOpenTabCount') {
    // Return current count of open token tabs
    sendResponse({ openTabCount: tabIdToTokenInfo.size });
    return true;
  } else if (request.action === 'checkTokenCooldown') {
    const tokenId = request.tokenId;
    const now = Date.now();
    const cooldownPeriod = settings.cooldownMinutes * 60 * 1000;
    const lastOpened = openedTokens.get(tokenId);
    const isInCooldown = lastOpened && (now - lastOpened < cooldownPeriod);
    sendResponse({ isInCooldown: isInCooldown, tokenId: tokenId });
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
      return false;
    }

    // Check if token already exists in any tab
    const tabs = await chrome.tabs.query({});
    const tokenUrl = `https://dexscreener.com/${chain}/${tokenId}`;

    for (const tab of tabs) {
      if (tab.url === tokenUrl) {
        console.log(`Token ${tokenId} (${chain}) already open`);
        openedTokens.set(tokenId, now);
        return true; // Tab already open, consider it successful
      }
    }

    // IMPORTANT: Check maximum tabs limit BEFORE opening new tabs
    // Use tabIdToTokenInfo.size to count actually open tabs (not tokens in cooldown)
    const openedTokenCount = tabIdToTokenInfo.size;
    if (openedTokenCount >= settings.maxTabs) {
      console.log(`Maximum tabs limit reached (${settings.maxTabs}/${openedTokenCount}). Skipping ${tokenId} (${chain})`);
      return false; // Max tabs reached, could not open
    }

    // Open new tab and store the mapping
    const createdTab = await chrome.tabs.create({ url: tokenUrl, active: false });
    openedTokens.set(tokenId, now);
    tokenUrlToId.set(tokenUrl, tokenId);
    tabIdToTokenInfo.set(createdTab.id, { tokenId, tokenUrl, timestamp: now });

    console.log(`✅ Opened token ${tokenId} on ${chain} (${tabIdToTokenInfo.size}/${settings.maxTabs} tabs)`);


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

    return true; // Successfully opened tab
  } catch (error) {
    console.error('Error opening token tab:', error);
    return false;
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

