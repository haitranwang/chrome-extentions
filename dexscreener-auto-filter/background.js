// Background service worker for Chrome Extension

let openedTokens = new Map(); // tokenId -> timestamp
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

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tokenMatchesFilter') {
    openTokenTab(request.tokenId);
  } else if (request.action === 'getStats') {
    // Return statistics
    sendResponse({
      tabCount: openedTokens.size,
      settings: settings
    });
  }
});

// Function to open token tab with configurable cooldown and max tabs limit
async function openTokenTab(tokenId) {
  try {
    const now = Date.now();
    const cooldownPeriod = settings.cooldownMinutes * 60 * 1000; // Convert to milliseconds

    // Check cooldown with configured period
    const lastOpened = openedTokens.get(tokenId);
    if (lastOpened && (now - lastOpened < cooldownPeriod)) {
      console.log(`Token ${tokenId} is in cooldown (${Math.ceil((cooldownPeriod - (now - lastOpened)) / 1000 / 60)}m remaining)`);
      return;
    }

    // Check if token already exists in any tab
    const tabs = await chrome.tabs.query({});
    const tokenUrl = `https://dexscreener.com/solana/${tokenId}`;

    for (const tab of tabs) {
      if (tab.url === tokenUrl) {
        console.log(`Token ${tokenId} already open`);
        openedTokens.set(tokenId, now);
        return;
      }
    }

    // IMPORTANT: Check maximum tabs limit BEFORE opening new tabs
    const openedTokenCount = openedTokens.size;
    if (openedTokenCount >= settings.maxTabs) {
      console.log(`Maximum tabs limit reached (${settings.maxTabs}/${openedTokenCount}). Skipping ${tokenId}`);
      return;
    }

    // Open new tab
    await chrome.tabs.create({ url: tokenUrl, active: false });
    openedTokens.set(tokenId, now);

    console.log(`✅ Opened token ${tokenId} (${openedTokens.size}/${settings.maxTabs} tabs)`);

    // Clean up old entries (older than cooldown period)
    for (const [token, timestamp] of openedTokens.entries()) {
      if (now - timestamp > cooldownPeriod) {
        openedTokens.delete(token);
        console.log(`🗑️ Removed expired token from cache: ${token}`);
      }
    }
  } catch (error) {
    console.error('Error opening token tab:', error);
  }
}

// Note: Service workers don't have a 'window' object
// For debugging, use: console.log(openedTokens);

