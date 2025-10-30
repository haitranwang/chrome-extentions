// Background service worker for GMGN Auto Filter Chrome Extension

let openedTokens = new Map(); // tokenId -> timestamp
let tokenUrlToId = new Map(); // tokenUrl -> tokenId
let tabIdToTokenInfo = new Map(); // tabId -> {tokenId, tokenUrl, timestamp, chain}
let settings = {
  cooldownMinutes: 15,
  maxTabs: 10
};

// Load settings from storage
async function loadSettings() {
  const data = await chrome.storage.local.get(['cooldownMinutes', 'maxTabs']);
  if (data.cooldownMinutes) settings.cooldownMinutes = data.cooldownMinutes;
  if (data.maxTabs) settings.maxTabs = data.maxTabs;
  console.log('GMGN Auto Filter: Settings loaded:', settings);
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('GMGN Auto Filter: Extension installed');
  await loadSettings();
});

// Listen for settings changes
chrome.storage.onChanged.addListener(() => {
  loadSettings();
});

// Initialize settings on startup
loadSettings();

// Listen for tab removal to clean up counters
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Check if we're tracking this tab ID
  if (tabIdToTokenInfo.has(tabId)) {
    const { tokenId, tokenUrl } = tabIdToTokenInfo.get(tabId);

    // Remove only from tab tracking, but KEEP token in openedTokens for cooldown
    // This ensures tokens remain in cooldown even after tab is closed
    tokenUrlToId.delete(tokenUrl);
    tabIdToTokenInfo.delete(tabId);

    console.log(`GMGN Auto Filter: Tab closed for ${tokenId} (tab tracking removed, cooldown maintained)`);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openTokenTab') {
    openTokenTab(request.tokenId, request.chain).then((opened) => {
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
      tabCount: tabIdToTokenInfo.size,
      settings: settings
    });
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
async function openTokenTab(tokenId, chain = 'sol') {
  try {
    const now = Date.now();
    const cooldownPeriod = settings.cooldownMinutes * 60 * 1000; // Convert to milliseconds

    // Check cooldown with configured period
    const lastOpened = openedTokens.get(tokenId);
    if (lastOpened && (now - lastOpened < cooldownPeriod)) {
      const remainingMinutes = Math.ceil((cooldownPeriod - (now - lastOpened)) / 1000 / 60);
      console.log(`GMGN Auto Filter: Token ${tokenId} (${chain}) is in cooldown (${remainingMinutes}m remaining)`);
      return false;
    }

    // Check if token already exists in any tab
    const tabs = await chrome.tabs.query({});
    const tokenUrl = `https://gmgn.ai/${chain}/token/${tokenId}`;

    for (const tab of tabs) {
      if (tab.url === tokenUrl) {
        console.log(`GMGN Auto Filter: Token ${tokenId} (${chain}) already open`);
        openedTokens.set(tokenId, now);
        return true; // Tab already open, consider it successful
      }
    }

    // IMPORTANT: Check maximum tabs limit BEFORE opening new tabs
    const openedTokenCount = tabIdToTokenInfo.size;
    if (openedTokenCount >= settings.maxTabs) {
      console.log(`GMGN Auto Filter: Maximum tabs limit reached (${settings.maxTabs}/${openedTokenCount}). Skipping ${tokenId} (${chain})`);
      return false; // Max tabs reached, could not open
    }

    // Open new tab and store the mapping
    const createdTab = await chrome.tabs.create({ url: tokenUrl, active: false });
    openedTokens.set(tokenId, now);
    tokenUrlToId.set(tokenUrl, tokenId);
    tabIdToTokenInfo.set(createdTab.id, { tokenId, tokenUrl, timestamp: now, chain });

    console.log(`GMGN Auto Filter: ✅ Opened token ${tokenId} on ${chain} (${tabIdToTokenInfo.size}/${settings.maxTabs} tabs)`);

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
        console.log(`GMGN Auto Filter: 🗑️ Removed expired token from cache: ${token}`);
      }
    }

    return true; // Successfully opened tab
  } catch (error) {
    console.error('GMGN Auto Filter: Error opening token tab:', error);
    return false;
  }
}

