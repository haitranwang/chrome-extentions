// Content script for gmgn.ai

// Performance optimization: Throttle and debounce utilities
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Cache for token links to avoid repeated DOM queries
let cachedTokenLinks = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 2000; // Cache for 2 seconds

// Invalidate cache
function invalidateTokenCache() {
  cachedTokenLinks = null;
  cacheTimestamp = 0;
}

// Flag to prevent recursive updates
let isUpdatingDOM = false;

// Watch for new token listings with throttling
function watchForTokens() {
  // Throttled function for token detection
  const throttledCheck = throttle(() => {
    invalidateTokenCache();
    checkMatchingTokens();
  }, 1000); // Check every 1 second for token detection

  const observer = new MutationObserver(() => {
    throttledCheck();
  });

  const targetNode = document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true // Enable subtree to catch all changes
  });

  return observer;
}

// Supported blockchain chains
const SUPPORTED_CHAINS = {
  'sol': 'Solana',
  'bsc': 'Binance Smart Chain'
};

// Detect current chain from URL
function detectChain() {
  const url = location.href;

  // Check for chain parameter in URL: ?chain=sol or ?chain=bsc
  const chainMatch = url.match(/[?&]chain=([a-z]+)/);
  if (chainMatch && SUPPORTED_CHAINS.hasOwnProperty(chainMatch[1])) {
    return chainMatch[1];
  }

  // Check for chain in path: /sol/token/ or /bsc/token/
  if (url.includes('/sol/')) {
    return 'sol';
  }
  if (url.includes('/bsc/')) {
    return 'bsc';
  }

  return null;
}

// Check if we're on a filter page (not a token detail page)
function isFilterPage() {
  const url = location.href;
  // Filter pages have chain query parameter but not /token/ in path
  return (url.includes('chain=sol') || url.includes('chain=bsc')) && !url.includes('/token/');
}

function checkMatchingTokens() {
  const currentChain = detectChain();

  if (!currentChain) {
    if (location.href.includes('gmgn.ai')) {
      console.log('GMGN Auto Filter: ⏭️ Not a supported chain page:', location.href);
    }
    return;
  }

  // Only process tokens on filter pages
  if (!isFilterPage()) {
    console.log('GMGN Auto Filter: ⏭️ Not on a filter page, skipping token detection');
    return;
  }

  // Get max tabs from settings to limit messages sent
  chrome.storage.local.get(['maxTabs'], (data) => {
    const maxTabs = data.maxTabs || 10;
    processTokens(currentChain, maxTabs);
  });
}

// Track last processed tokens to avoid reprocessing
let lastProcessedTokens = new Set();
let lastProcessCheck = 0;
const PROCESS_INTERVAL = 2000; // Only process every 2 seconds max

function processTokens(currentChain, maxTabs) {
  const now = Date.now();

  // Skip if we've recently processed tokens
  if (now - lastProcessCheck < PROCESS_INTERVAL) {
    return;
  }
  lastProcessCheck = now;

  // Check if extension is enabled
  chrome.storage.local.get(['extensionEnabled'], (data) => {
    const enabled = data.extensionEnabled !== false;

    if (!enabled) {
      console.log('GMGN Auto Filter: ⏸️ Extension disabled - skipping token processing');
      return;
    }

    // Query current open tab count and calculate remaining slots
    chrome.runtime.sendMessage({ action: 'getOpenTabCount' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('GMGN Auto Filter: Error fetching open tab count:', chrome.runtime.lastError);
        return;
      }

      const currentOpenTabs = response && response.openTabCount ? response.openTabCount : 0;
      const remainingSlots = Math.max(0, maxTabs - currentOpenTabs);

      console.log(`GMGN Auto Filter: 📊 Current open tabs: ${currentOpenTabs}, Max tabs: ${maxTabs}, Remaining slots: ${remainingSlots}`);

      if (remainingSlots === 0) {
        console.log(`GMGN Auto Filter: ⏭️ No remaining slots (${currentOpenTabs}/${maxTabs} tabs open). Skipping token processing.`);
        return;
      }

      // Find token links on GMGN pages
      const tokenLinks = findTokenLinks(currentChain);
      const processedTokens = new Set(); // Track tokens processed in this call
      let messageCount = 0;
      const MAX_MESSAGES = Math.min(remainingSlots, 50); // Don't send more than remaining slots

      tokenLinks.forEach(link => {
        if (messageCount >= MAX_MESSAGES) return; // Stop if we've sent too many messages

        const href = link.getAttribute('href');
        if (!href) return;

        // Extract token ID from GMGN URL patterns
        // Solana: /sol/token/FyZCJJ5VbhkgrviigFoJHaXup7ZA57rNgYghiMJ7pump
        // BSC: /bsc/token/0x8b2955679eb9effbd268520c05673972ffd34444
        let tokenId = null;

        // Pattern: /chain/token/TOKEN_ID
        const match = href.match(`/${currentChain}/token/([A-Za-z0-9]+)`);
        if (match) {
          tokenId = match[1];

          // Validate tokenId length
          // Solana addresses are 32-44 characters (Base58), BSC are 42 characters (0x + 40 hex)
          if (tokenId && tokenId.length >= 20) {
            const fullTokenId = tokenId; // Store without chain prefix for uniqueness across chains

            // Only process each token once per check
            if (!processedTokens.has(fullTokenId)) {
              processedTokens.add(fullTokenId);

              // Check cooldown status from background
              chrome.runtime.sendMessage({ action: 'checkTokenCooldown', tokenId: tokenId }, (cooldownResponse) => {
                if (chrome.runtime.lastError) {
                  console.error('GMGN Auto Filter: Error checking token cooldown:', chrome.runtime.lastError);
                  return;
                }

                if (cooldownResponse && cooldownResponse.isInCooldown) {
                  console.log(`GMGN Auto Filter: ⏳ Skipping token ${tokenId} - still in cooldown`);
                  return;
                }

                // Check limit again before proceeding
                if (messageCount >= MAX_MESSAGES) return;

                messageCount++;

                // Token is ready, proceed with opening tab
                chrome.runtime.sendMessage({
                  action: 'openTokenTab',
                  tokenId: tokenId,
                  chain: currentChain
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.error('GMGN Auto Filter: Error sending message:', chrome.runtime.lastError);
                    return;
                  }
                  if (response && response.success && response.timestamp && response.cooldownMs) {
                    openedTokensData.set(tokenId, { timestamp: response.timestamp, cooldownMs: response.cooldownMs });
                    console.log(`GMGN Auto Filter: ✅ Tab opened for ${tokenId}, updating UI immediately`);
                    updateCountdownDisplays();
                  } else if (response && !response.success) {
                    console.log(`GMGN Auto Filter: ⏭️ Tab NOT opened for ${tokenId} (max tabs reached or already in cooldown)`);
                  }
                });
              });
            }
          }
        }
      });

      if (messageCount > 0) {
        console.log(`GMGN Auto Filter: 📊 Found ${messageCount} unique ${currentChain} tokens to process`);
      } else {
        console.log(`GMGN Auto Filter: 🔍 No ${currentChain} tokens found. Total links found: ${tokenLinks.length}`);
      }
    });
  });
}

function findTokenLinks(chain, forceRefresh = false) {
  const now = Date.now();

  // Return cached results if still valid
  if (!forceRefresh && cachedTokenLinks && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedTokenLinks;
  }

  const links = new Set();

  // Get all links on the page
  const allLinks = document.querySelectorAll('a[href]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Look for GMGN token URL pattern: /chain/token/TOKEN_ID
    if (href.includes(`/${chain}/token/`)) {
      const match = href.match(`/${chain}/token/([A-Za-z0-9]+)`);
      if (match && match[1].length >= 20) {
        links.add(link);
      }
    }
  });

  // Cache the results
  cachedTokenLinks = Array.from(links);
  cacheTimestamp = now;

  return cachedTokenLinks;
}

// Get token ID from a link element
function getTokenIdFromLink(link, chain) {
  const href = link.getAttribute('href');
  if (!href) return null;

  // Extract token ID from GMGN URL pattern
  const match = href.match(`/${chain}/token/([A-Za-z0-9]+)`);
  if (match) {
    const tokenId = match[1];
    if (tokenId && tokenId.length >= 20) {
      return tokenId;
    }
  }

  return null;
}

// Fetch opened tokens data from background
function fetchOpenedTokens() {
  chrome.runtime.sendMessage({ action: 'getOpenedTokens' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('GMGN Auto Filter: Error fetching opened tokens:', chrome.runtime.lastError);
      return;
    }

    openedTokensData.clear();
    if (response && response.tokens) {
      response.tokens.forEach(({ tokenId, timestamp, cooldownMs }) => {
        openedTokensData.set(tokenId, { timestamp, cooldownMs });
      });
    }

    // Update countdown displays
    updateCountdownDisplays();
  });
}

// Format time as HH:MM:SS
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to get cooldown duration for a token in seconds
function getCooldownDuration(tokenId) {
  const tokenData = openedTokensData.get(tokenId);
  if (tokenData && tokenData.cooldownMs) {
    return Math.floor(tokenData.cooldownMs / 1000);
  }
  return 15 * 60; // Default to 15 minutes if not available
}

// Helper function to check if a token is in cooldown
function isTokenInCooldown(tokenId) {
  const tokenData = openedTokensData.get(tokenId);
  const cooldownDuration = getCooldownDuration(tokenId);

  if (tokenData && tokenData.timestamp) {
    const openedTime = tokenData.timestamp;
    const now = Date.now();
    const elapsed = Math.floor((now - openedTime) / 1000);

    if (elapsed < cooldownDuration) {
      return true;
    }
  }

  return false;
}

// Track timers being created to prevent race conditions
const timersBeingCreated = new Set();

// Add countdown timer to a token row
function addCountdownTimer(link, tokenId) {
  // Only show countdown timers on filter pages
  if (!isFilterPage()) {
    return;
  }

  // Validate link
  if (!link || !link.href) {
    return;
  }

  // Check for existing timer globally
  let existingTimer = document.querySelector(`.gmgn-token-timer[data-token-id="${tokenId}"]`);

  if (existingTimer) {
    // Clean up duplicate timers
    const allTimersForToken = document.querySelectorAll(`.gmgn-token-timer[data-token-id="${tokenId}"]`);
    if (allTimersForToken.length > 1) {
      console.log('GMGN Auto Filter: 🧹 Cleaning up', allTimersForToken.length - 1, 'duplicate timers for token:', tokenId);
      for (let i = 1; i < allTimersForToken.length; i++) {
        allTimersForToken[i].remove();
      }
    }

    // Update existing timer
    updateTimerDisplay(existingTimer, tokenId);
    return;
  }

  // Prevent race condition
  if (timersBeingCreated.has(tokenId)) {
    return;
  }

  timersBeingCreated.add(tokenId);

  // Try to find the container using the provided CSS selector pattern
  const tokenNameParent = link.closest('div');
  let container = null;

  // Look for the parent container that matches GMGN's structure
  let current = link;
  let attempts = 0;
  while (current && attempts < 10) {
    if (current.querySelector && current.querySelector('span, div')) {
      // Check if this container has text content
      const textContent = current.textContent?.trim();
      if (textContent && textContent.length > 0 && textContent.length < 100) {
        container = current;
        break;
      }
    }
    current = current.parentElement;
    attempts++;
  }

  // Fallback: use the link's parent
  if (!container) {
    container = link.parentElement;
  }

  if (!container) {
    timersBeingCreated.delete(tokenId);
    return;
  }

  // Double-check after getting container
  const recheckTimer = document.querySelector(`.gmgn-token-timer[data-token-id="${tokenId}"]`);
  if (recheckTimer) {
    timersBeingCreated.delete(tokenId);
    addCountdownTimer(link, tokenId); // Recursively call to update
    return;
  }

  // Create timer element
  const timer = document.createElement('div');
  timer.className = 'gmgn-token-timer';
  timer.setAttribute('data-token-id', tokenId);
  timer.style.cssText = `
    display: inline-block !important;
    padding: 3px 8px;
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    color: white !important;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    margin-left: 8px;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    letter-spacing: 0.5px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    z-index: 9999;
    position: relative;
    vertical-align: middle;
    line-height: 1.2;
    flex-shrink: 0;
  `;

  // Try to insert after the link or token name
  let inserted = false;

  // Strategy 1: Insert after the link
  if (link.nextSibling) {
    link.parentNode.insertBefore(timer, link.nextSibling);
    inserted = true;
  } else if (link.parentNode) {
    link.parentNode.appendChild(timer);
    inserted = true;
  }

  if (!inserted) {
    timersBeingCreated.delete(tokenId);
    return;
  }

  // Initial update
  updateTimerDisplay(timer, tokenId);

  // Clear the creation flag
  timersBeingCreated.delete(tokenId);
}

// Update timer display
function updateTimerDisplay(timer, tokenId) {
  const tokenData = openedTokensData.get(tokenId);
  const cooldownDuration = getCooldownDuration(tokenId);

  let countdownSeconds = 0;
  let elapsed = 0;
  let isInCooldown = false;

  if (tokenData && tokenData.timestamp) {
    const openedTime = tokenData.timestamp;
    const now = Date.now();
    elapsed = Math.floor((now - openedTime) / 1000);

    if (elapsed < cooldownDuration) {
      isInCooldown = true;
      countdownSeconds = cooldownDuration - elapsed;
    }
  }

  // Only show timer if token is in cooldown
  if (isInCooldown) {
    timer.textContent = formatTime(countdownSeconds);

    // Update title
    const remainingMins = Math.floor(countdownSeconds / 60);
    const totalMins = Math.floor(cooldownDuration / 60);
    timer.title = `Opened ${formatTime(elapsed)} ago • ${remainingMins}/${totalMins} min cooldown`;

    // Change color based on remaining time
    const cooldownProgress = countdownSeconds / cooldownDuration;
    if (cooldownProgress > 0.75) {
      timer.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
    } else if (cooldownProgress > 0.5) {
      timer.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
    } else if (cooldownProgress > 0.25) {
      timer.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
    } else {
      timer.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
    }
  } else {
    // Remove timer if not in cooldown
    timer.remove();
  }
}

// Clean up duplicate timers periodically
function cleanupDuplicateTimers() {
  const allTimers = document.querySelectorAll('.gmgn-token-timer[data-token-id]');
  const timerMap = new Map();

  allTimers.forEach(timer => {
    const tokenId = timer.getAttribute('data-token-id');
    if (!timerMap.has(tokenId)) {
      timerMap.set(tokenId, [timer]);
    } else {
      timerMap.get(tokenId).push(timer);
    }
  });

  // Remove duplicate timers, keeping only the first one for each token
  timerMap.forEach(timers => {
    if (timers.length > 1) {
      for (let i = 1; i < timers.length; i++) {
        timers[i].remove();
      }
    }
  });
}

// Update countdown displays for all token rows
function updateCountdownDisplays() {
  // Prevent recursive calls
  if (isUpdatingDOM) return;

  isUpdatingDOM = true;

  try {
    const currentChain = detectChain();
    if (!currentChain || !isFilterPage()) {
      return;
    }

    // Clean up any duplicate timers first
    cleanupDuplicateTimers();

    // Find all token links
    const tokenLinks = findTokenLinks(currentChain, true);

    if (tokenLinks.length === 0) {
      return;
    }

    tokenLinks.forEach((link) => {
      const tokenId = getTokenIdFromLink(link, currentChain);
      if (!tokenId) return;

      // Only show timer for tokens that are in cooldown
      if (isTokenInCooldown(tokenId)) {
        try {
          addCountdownTimer(link, tokenId);
        } catch (error) {
          console.error('GMGN Auto Filter: ❌ Error in addCountdownTimer:', error);
        }
      }
    });
  } finally {
    setTimeout(() => {
      isUpdatingDOM = false;
    }, 50);
  }
}

// Start countdown timer updates
function startCountdownUpdates() {
  // Prevent multiple intervals from being created
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Update every 1 second for accurate countdown display
  countdownInterval = setInterval(() => {
    updateCountdownDisplays();
  }, 1000);

  // Fetch fresh data every 30 seconds
  fetchOpenedTokens();
  setInterval(() => {
    fetchOpenedTokens();
  }, 30000);
}

// Countdown timer functionality
let openedTokensData = new Map(); // tokenId -> {timestamp, cooldownMs}
let countdownInterval = null;

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const currentUrl = location.href;
  const detectedChain = detectChain();

  console.log('GMGN Auto Filter: Content script loaded');
  console.log('📍 Current URL:', currentUrl);
  console.log('🔗 Detected Chain:', detectedChain || 'None');

  if (detectedChain) {
    // Run initial token check
    setTimeout(() => {
      console.log('GMGN Auto Filter: 🔍 Running initial token check...');
      invalidateTokenCache();
      checkMatchingTokens();
    }, 500);

    // Start countdown timer updates
    setTimeout(() => {
      fetchOpenedTokens();
      startCountdownUpdates();
    }, 1000);

    // Also run token check after a bit to catch dynamic content
    setTimeout(() => {
      console.log('GMGN Auto Filter: 🔍 Running secondary token check...');
      invalidateTokenCache();
      checkMatchingTokens();
    }, 2500);
  }

  // Start watching for tokens
  watchForTokens();
}

// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  cachedTokenLinks = null;
});

