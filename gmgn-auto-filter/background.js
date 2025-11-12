// Background service worker for GMGN Auto Filter Chrome Extension

let openedTokens = new Map(); // tokenId -> timestamp
let tokenUrlToId = new Map(); // tokenUrl -> tokenId
let tabIdToTokenInfo = new Map(); // tabId -> {tokenId, tokenUrl, timestamp}
let tokensBeingOpened = new Set(); // Track tokens that are currently being opened (to prevent race conditions)
let pendingTabCount = 0; // Track number of tabs currently being created
let settings = {
  cooldownMinutes: 15,
  soundEnabled: false,
  maxTabsOpen: 5
};

// Load settings from storage
async function loadSettings() {
  const data = await chrome.storage.local.get(['cooldownMinutes', 'soundEnabled', 'maxTabsOpen']);
  if (data.cooldownMinutes) settings.cooldownMinutes = data.cooldownMinutes;
  if (data.soundEnabled !== undefined) settings.soundEnabled = data.soundEnabled;
  if (data.maxTabsOpen !== undefined) settings.maxTabsOpen = data.maxTabsOpen;
  console.log('Settings loaded:', settings);
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('GMGN Auto Filter Extension installed');
  await loadSettings();
});

// Listen for settings changes
chrome.storage.onChanged.addListener(() => {
  loadSettings();
});

// Initialize settings on startup
loadSettings();

// Create offscreen document for audio playback
async function createOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) {
      console.log('🔔 Offscreen document already exists');
      return true;
    }

    // Create offscreen document with AUDIO_PLAYBACK reason
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play notification sounds when tokens match filters'
    });
    console.log('✅ Offscreen document created');
    return true;
  } catch (error) {
    // If error is about document already existing, that's okay
    if (error.message && error.message.includes('already exists')) {
      console.log('🔔 Offscreen document already exists (from error)');
      return true;
    }
    // If error is about single document limit, check if one exists
    if (error.message && error.message.includes('single offscreen document')) {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) {
        console.log('🔔 Offscreen document exists (checked after error)');
        return true;
      }
    }
    console.error('❌ Error creating offscreen document:', error);
    return false;
  }
}

// Unlock audio in offscreen document (requires user gesture)
async function unlockAudio() {
  try {
    // Ensure offscreen document exists
    await createOffscreenDocument();

    // Wait a moment for offscreen document to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send message to offscreen to unlock audio
    // Note: Messages from background to offscreen should work, but we need to handle response properly
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'UNLOCK_AUDIO'
      }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || chrome.runtime.lastError.toString();
          console.error('❌ Error sending message to offscreen:', errorMsg);

          // If document doesn't exist, try to recreate it once
          if (errorMsg.includes('Receiving end does not exist')) {
            console.log('🔔 Offscreen document missing, attempting to recreate...');
            createOffscreenDocument().then(() => {
              // Retry unlock after recreation
              setTimeout(() => {
                chrome.runtime.sendMessage({ action: 'UNLOCK_AUDIO' }, (retryResponse) => {
                  if (!chrome.runtime.lastError && retryResponse && retryResponse.success) {
                    chrome.storage.local.set({ audioUnlocked: true });
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                });
              }, 200);
            });
            return;
          }

          resolve(false);
          return;
        }

        if (response && response.success) {
          console.log('✅ Audio unlocked successfully');
          chrome.storage.local.set({ audioUnlocked: true });
          resolve(true);
        } else {
          console.error('❌ Failed to unlock audio');
          resolve(false);
        }
      });
    });
  } catch (error) {
    console.error('❌ Error unlocking audio:', error);
    return false;
  }
}

// Function to play notification sound when a new token is opened
async function playNotificationSound() {
  console.log('🔔 Attempting to play notification sound');

  // Check if sound is enabled - reload settings from storage to be sure
  const data = await chrome.storage.local.get(['soundEnabled', 'audioUnlocked']);
  const soundEnabled = data.soundEnabled !== false; // Default to true if not set

  console.log(`🔔 Sound enabled from storage: ${soundEnabled}, audioUnlocked: ${data.audioUnlocked}`);

  if (!soundEnabled) {
    console.log('🔇 Sound notification disabled in settings');
    return;
  }

  // Check if audio is unlocked
  if (!data.audioUnlocked) {
    console.log('🔇 Audio not unlocked yet, user needs to enable sound first');
    return;
  }

  try {
    // Ensure offscreen document exists
    const docCreated = await createOffscreenDocument();
    if (!docCreated) {
      console.error('🔇 Failed to create offscreen document');
      return;
    }

    // Wait a bit to ensure offscreen document is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send message to offscreen to play beep
    chrome.runtime.sendMessage({
      action: 'PLAY_BEEP'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error sending PLAY_BEEP message:', chrome.runtime.lastError.message);
        // If document doesn't exist, try to recreate it
        if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
          console.log('🔔 Attempting to recreate offscreen document...');
          createOffscreenDocument().then(() => {
            // Don't retry immediately, let next notification try
          });
        }
        return;
      }
      console.log('🔔 Play beep message sent successfully');
    });
  } catch (error) {
    console.error('🔔 Error playing notification sound:', error);
  }
}

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

    // Broadcast update to popup and content scripts that a token tab was closed
    // This helps keep UI in sync
    const message = {
      action: 'tokenTabClosed',
      tokenId: tokenId
    };

    // Send to popup (if open)
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // Ignore errors if popup is not open
      });
    } catch (e) {
      // Ignore errors
    }

    // Send to all content scripts on GMGN pages
    try {
      chrome.tabs.query({ url: 'https://*.gmgn.ai/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors if content script is not ready
          });
        });
      });
    } catch (e) {
      // Ignore errors
    }
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tokenMatchesFilter') {
    console.log(`🎯 Received tokenMatchesFilter for token ${request.tokenId} on chain ${request.chain || 'sol'}`);
    openTokenTab(request.tokenId, request.chain || 'sol').then((opened) => {
      console.log(`🎯 openTokenTab result for ${request.tokenId}: ${opened}`);
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
  } else if (request.action === 'unlockAudio') {
    // Request from popup to unlock audio (with user gesture)
    unlockAudio().then(success => {
      sendResponse({ success });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getStats') {
    // Return statistics
    sendResponse({
      tabCount: tabIdToTokenInfo.size, // Count actually open tabs
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

// Function to open token tab with configurable cooldown
async function openTokenTab(tokenId, chain = 'sol') {
  console.log(`🚀 openTokenTab called for ${tokenId} on ${chain}`);
  try {
    const now = Date.now();
    const cooldownPeriod = settings.cooldownMinutes * 60 * 1000; // Convert to milliseconds

    // CRITICAL FIX: Check if this token is already being opened (prevents race conditions)
    // Create a unique key for this token
    const tokenKey = `${chain}:${tokenId}`;
    if (tokensBeingOpened.has(tokenKey)) {
      console.log(`Token ${tokenId} (${chain}) is already being opened (duplicate request ignored)`);
      return false; // Already being opened by another request
    }

    // CRITICAL FIX: Check cooldown FIRST, before any other checks
    // This must happen atomically to prevent race conditions with tab closure
    const lastOpened = openedTokens.get(tokenId);
    if (lastOpened && (now - lastOpened < cooldownPeriod)) {
      const remainingMs = cooldownPeriod - (now - lastOpened);
      const remainingMins = Math.ceil(remainingMs / 1000 / 60);
      console.log(`Token ${tokenId} (${chain}) is in cooldown (${remainingMins}m remaining, ${Math.floor(remainingMs / 1000)}s)`);
      return false;
    }

    // Check if token already exists in any tab
    const tabs = await chrome.tabs.query({});
    const tokenUrl = `https://gmgn.ai/${chain}/token/${tokenId}`;

    for (const tab of tabs) {
      if (tab.url === tokenUrl) {
        console.log(`Token ${tokenId} (${chain}) already open`);
        openedTokens.set(tokenId, now);
        return true; // Tab already open, consider it successful
      }
    }

    // CRITICAL FIX: Re-check cooldown after async tab query to prevent race conditions
    // This ensures that even if a tab was closed between the first check and now,
    // the token remains in cooldown and cannot be reopened
    const recheckTime = Date.now();
    const lastOpenedRecheck = openedTokens.get(tokenId);
    if (lastOpenedRecheck && (recheckTime - lastOpenedRecheck < cooldownPeriod)) {
      const remainingMs = cooldownPeriod - (recheckTime - lastOpenedRecheck);
      const remainingMins = Math.ceil(remainingMs / 1000 / 60);
      console.log(`Token ${tokenId} (${chain}) is in cooldown after tab check (${remainingMins}m remaining)`);
      return false;
    }

    // Check max tabs limit RIGHT BEFORE creating tab (prevents race conditions)
    // Include pending tabs in the count to prevent race conditions when multiple tokens are processed simultaneously
    const currentTabCount = tabIdToTokenInfo.size;
    const totalTabCount = currentTabCount + pendingTabCount;
    const maxTabs = settings.maxTabsOpen || 5; // Default to 5 if not set
    if (totalTabCount >= maxTabs) {
      console.log(`⚠️ Max tabs limit reached (${currentTabCount} open + ${pendingTabCount} pending = ${totalTabCount}/${maxTabs}). Cannot open token ${tokenId} (${chain})`);
      return false;
    }

    // Mark token as being opened and increment pending count BEFORE creating tab (prevents race conditions)
    tokensBeingOpened.add(tokenKey);
    pendingTabCount++;

    // Open new tab and store the mapping - active: true to auto-focus the new tab
    const createdTab = await chrome.tabs.create({ url: tokenUrl, active: true });
    openedTokens.set(tokenId, now);
    tokenUrlToId.set(tokenUrl, tokenId);
    tabIdToTokenInfo.set(createdTab.id, { tokenId, tokenUrl, timestamp: now });

    // Remove from "being opened" set and decrement pending count after successful creation
    tokensBeingOpened.delete(tokenKey);
    pendingTabCount = Math.max(0, pendingTabCount - 1); // Ensure count never goes negative

    console.log(`✅ Opened token ${tokenId} on ${chain} (${tabIdToTokenInfo.size} tabs)`);

    // Broadcast update to popup and content scripts that a token was opened
    // This ensures UI updates immediately without requiring refresh
    const message = {
      action: 'tokenOpened',
      tokenId: tokenId,
      timestamp: now,
      cooldownMs: cooldownPeriod
    };

    // Send to popup (if open)
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // Ignore errors if popup is not open
      });
    } catch (e) {
      // Ignore errors
    }

    // Send to all content scripts on GMGN pages
    try {
      chrome.tabs.query({ url: 'https://*.gmgn.ai/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors if content script is not ready
          });
        });
      });
    } catch (e) {
      // Ignore errors
    }

    // Play notification sound to alert user
    playNotificationSound();

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
    // Make sure to remove from "being opened" set and decrement pending count on error
    const tokenKey = `${chain || 'sol'}:${tokenId}`;
    tokensBeingOpened.delete(tokenKey);
    pendingTabCount = Math.max(0, pendingTabCount - 1); // Ensure count never goes negative
    return false;
  }
}

// Note: Service workers don't have a 'window' object
// For debugging, use: console.log(openedTokens);

