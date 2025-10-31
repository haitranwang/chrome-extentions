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
const CACHE_DURATION = 500; // Cache for 500ms (reduced to catch filter changes faster)

// Invalidate cache
function invalidateTokenCache() {
  cachedTokenLinks = null;
  cacheTimestamp = 0;
}

// Flag to prevent recursive updates
let isUpdatingDOM = false;

// Supported blockchain chains for GMGN
const SUPPORTED_CHAINS = ['sol', 'bsc', 'eth', 'base', 'arb', 'polygon', 'avax', 'op', 'zksync', 'ton', 'sui', 'aptos', 'near'];

// Detect current chain from URL
function detectChain() {
  const url = location.href;
  // Check for chain in URL: https://gmgn.ai/trend?chain=sol or https://gmgn.ai/sol/token/...
  for (const chain of SUPPORTED_CHAINS) {
    if (url.includes(`/trend?chain=${chain}`) || url.includes(`/${chain}/token/`)) {
      return chain;
    }
  }

  // Try to extract from URL path
  const pathMatch = url.match(/gmgn\.ai\/([^\/]+)/);
  if (pathMatch && SUPPORTED_CHAINS.includes(pathMatch[1])) {
    return pathMatch[1];
  }

  return null;
}

// Check if we're on a trend/listing page
function isListingPage() {
  // Support trend pages and chain pages
  return location.href.includes('/trend') ||
         location.href.includes('/chain/') ||
         /gmgn\.ai\/[^\/]+(\?|$)/.test(location.pathname);
}

// CSS selectors for price change columns (as provided)
const COLUMN_SELECTORS = {
  oneMin: '#GlobalScrollDomId > div > div.py-0.overflow-x-auto.px-\\[8px\\] > div.px-0.py-0.overflow-x-auto.block > div > div > div > div > div.g-table-tbody-virtual.g-table-tbody > div.g-table-tbody-virtual-holder > div > div > div:nth-child(1) > div:nth-child(12) > div > span',
  fiveMin: '#GlobalScrollDomId > div > div.py-0.overflow-x-auto.px-\\[8px\\] > div.px-0.py-0.overflow-x-auto.block > div > div > div > div > div.g-table-tbody-virtual.g-table-tbody > div.g-table-tbody-virtual-holder > div > div > div:nth-child(1) > div:nth-child(13) > div > span',
  oneHour: '#GlobalScrollDomId > div > div.py-0.overflow-x-auto.px-\\[8px\\] > div.px-0.py-0.overflow-x-auto.block > div > div > div > div > div.g-table-tbody-virtual.g-table-tbody > div.g-table-tbody-virtual-holder > div > div > div:nth-child(1) > div:nth-child(14) > div > span'
};

// Track last processed tokens to avoid reprocessing
let lastProcessedTokens = new Set();
let lastProcessCheck = 0;
const PROCESS_INTERVAL = 2000; // Only process every 2 seconds max

// Track tokens that have messages sent (to prevent duplicate tab opening)
let tokensWithPendingMessages = new Map();

// Track tokens that are currently being checked (awaiting cooldown response)
let tokensBeingChecked = new Set();

// Track successfully processed tokens to avoid reprocessing
let successfullyProcessedTokens = new Map();
const PROCESSED_TOKEN_TIMEOUT = 60000; // Remember processed tokens for 60 seconds

// Filter configuration (loaded from storage)
let filterConfig = {
  oneMin: { enabled: false, threshold: 0 },
  fiveMin: { enabled: false, threshold: 0 },
  oneHour: { enabled: false, threshold: 0 }
};

// Load filter configuration from storage
async function loadFilterConfig() {
  try {
    const data = await chrome.storage.local.get(['filterConfig']);
    if (data.filterConfig) {
      filterConfig = data.filterConfig;
      console.log('Filter configuration loaded:', filterConfig);
    }
  } catch (error) {
    console.error('Error loading filter config:', error);
  }
}

// Reload filter config when it changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.filterConfig) {
    filterConfig = changes.filterConfig.newValue;
    console.log('Filter configuration updated:', filterConfig);
  }
});

// Initialize filter config on load
loadFilterConfig();

// Watch for new token listings with throttling
function watchForTokens() {
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

// Check if a token matches the configured filters
function tokenMatchesFilters(tokenRow) {
  // If no filters are enabled, don't match any tokens
  const hasEnabledFilter = filterConfig.oneMin.enabled ||
                          filterConfig.fiveMin.enabled ||
                          filterConfig.oneHour.enabled;

  if (!hasEnabledFilter) {
    return false;
  }

  // Try to find price change values in this row
  const cells = tokenRow.querySelectorAll('div > div > span');

  // The structure should be: [token info..., 1m%, 5m%, 1h%, ...]
  // We need to find these values in the row
  let cellIndex = 0;

  for (const cell of cells) {
    const text = cell.textContent.trim();

    // Check if this cell contains a percentage value
    if (text.includes('%')) {
      const value = parseFloat(text.replace('%', ''));

      if (!isNaN(value)) {
        // Try to identify which column this is based on position
        // This is approximate - we'll need to test with actual GMGN structure
        if (cellIndex === 11 && filterConfig.oneMin.enabled) {
          // 1m% column
          if (value < filterConfig.oneMin.threshold) {
            return false;
          }
        } else if (cellIndex === 12 && filterConfig.fiveMin.enabled) {
          // 5m% column
          if (value < filterConfig.fiveMin.threshold) {
            return false;
          }
        } else if (cellIndex === 13 && filterConfig.oneHour.enabled) {
          // 1h% column
          if (value < filterConfig.oneHour.threshold) {
            return false;
          }
        }

        cellIndex++;
      }
    } else {
      cellIndex++;
    }
  }

  return true; // All enabled filters passed
}

// Highlight a token row
function highlightTokenRow(tokenRow) {
  if (tokenRow && !tokenRow.dataset.gmgnHighlighted) {
    tokenRow.style.filter = 'brightness(1.3)';
    tokenRow.style.transition = 'filter 0.3s ease';
    tokenRow.dataset.gmgnHighlighted = 'true';
    console.log('✅ Highlighted token row');
  }
}

function checkMatchingTokens() {
  const currentChain = detectChain();

  if (!currentChain) {
    console.log('⏭️ Not a supported chain page:', location.href);
    return;
  }

  // Process all matching tokens
  processTokens(currentChain);
}

function processTokens(currentChain) {
  const now = Date.now();

  // Skip if we've recently processed tokens
  if (now - lastProcessCheck < PROCESS_INTERVAL) {
    return;
  }

  // Update timestamp BEFORE processing (prevents race conditions)
  lastProcessCheck = now;

  // CRITICAL: Only process tokens on listing pages, not on token detail pages
  const currentUrl = location.href;
  if (currentUrl.match(/\/token\/[A-Za-z0-9]+$/)) {
    return;
  }

  // Clean up old successfully processed tokens (older than timeout)
  for (const [tokenId, timestamp] of successfullyProcessedTokens.entries()) {
    if (now - timestamp > PROCESSED_TOKEN_TIMEOUT) {
      successfullyProcessedTokens.delete(tokenId);
    }
  }

  // Check if extension is enabled
  chrome.storage.local.get(['extensionEnabled'], (data) => {
    const enabled = data.extensionEnabled !== false;

    if (!enabled) {
      console.log('⏸️ Extension disabled - skipping token processing');
      return;
    }

    // Find token links and rows
    const tokenData = findTokenData(currentChain);
    const processedTokens = new Set();
    let messageCount = 0;

    // Clean up old pending messages (older than 60 seconds)
    const PENDING_MESSAGE_TIMEOUT = 60000;
    for (const [tokenId, timestamp] of tokensWithPendingMessages.entries()) {
      if (now - timestamp > PENDING_MESSAGE_TIMEOUT) {
        tokensWithPendingMessages.delete(tokenId);
      }
    }

    tokenData.forEach(({ tokenId, row, link }) => {
      // Only process each token once per check
      if (!processedTokens.has(tokenId)) {
        processedTokens.add(tokenId);

        // Check if token matches filters
        if (!tokenMatchesFilters(row)) {
          return; // Token doesn't match filters, skip
        }

        // CRITICAL FIX 1: Check if we've already successfully processed this token recently
        if (successfullyProcessedTokens.has(tokenId)) {
          return;
        }

        // CRITICAL FIX 2: Check if we've already sent a message for this token
        if (tokensWithPendingMessages.has(tokenId)) {
          return;
        }

        // CRITICAL FIX 3: Check if token is currently being checked
        if (tokensBeingChecked.has(tokenId)) {
          return;
        }

        // Mark token as being checked BEFORE async call
        tokensBeingChecked.add(tokenId);

        // Check cooldown status from background
        chrome.runtime.sendMessage({ action: 'checkTokenCooldown', tokenId: tokenId }, (cooldownResponse) => {
          tokensBeingChecked.delete(tokenId);

          if (chrome.runtime.lastError) {
            console.error('Error checking token cooldown:', chrome.runtime.lastError);
            return;
          }

          if (cooldownResponse && cooldownResponse.isInCooldown) {
            console.log(`⏳ Skipping token ${tokenId} - still in cooldown`);
            successfullyProcessedTokens.set(tokenId, now);
            return;
          }

          // Mark this token as having a pending message BEFORE sending
          tokensWithPendingMessages.set(tokenId, now);
          messageCount++;

          // Highlight the token row
          highlightTokenRow(row);

          // Token matches filter, proceed with opening tab
          chrome.runtime.sendMessage({
            action: 'tokenMatchesFilter',
            tokenId: tokenId,
            chain: currentChain
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
              tokensWithPendingMessages.delete(tokenId);
              return;
            }
            if (response && response.success && response.timestamp && response.cooldownMs) {
              tokensWithPendingMessages.delete(tokenId);
              openedTokensData.set(tokenId, { timestamp: response.timestamp, cooldownMs: response.cooldownMs });
              successfullyProcessedTokens.set(tokenId, now);
              updateCountdownDisplays();
            } else if (response && !response.success) {
              tokensWithPendingMessages.delete(tokenId);
              successfullyProcessedTokens.set(tokenId, now);
            }
          });
        });
      }
    });
  });
}

// Helper function to check if an element is visible
function isElementVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  // Allow for virtual scrolling
  if (rect.bottom < -100 || rect.top > viewportHeight + 100 ||
      rect.right < -100 || rect.left > viewportWidth + 100) {
    return false;
  }

  return true;
}

// Find token data (links and rows) for GMGN
function findTokenData(chain, forceRefresh = false) {
  const now = Date.now();

  // Return cached results if still valid
  if (!forceRefresh && cachedTokenLinks && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedTokenLinks;
  }

  const tokenData = [];

  // Find all links in the table that point to token pages
  const allLinks = document.querySelectorAll('a[href]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Check if this is a token link: /sol/token/TOKENID or /chain/token/TOKENID
    const tokenMatch = href.match(new RegExp(`\\/(${SUPPORTED_CHAINS.join('|')})\\/token\\/([A-Za-z0-9]+)`));
    if (!tokenMatch) return;

    const [, linkChain, tokenId] = tokenMatch;

    // Make sure it's a real token ID (long enough)
    if (tokenId.length < 20) return;

    // Find the parent row
    let row = link.closest('tr') || link.closest('[class*="row"]');

    if (row && isElementVisible(row)) {
      // Only add if we haven't seen this token ID yet
      if (!tokenData.find(t => t.tokenId === tokenId)) {
        tokenData.push({ tokenId, row, link, chain: linkChain });
      }
    }
  });

  // Cache the results
  cachedTokenLinks = tokenData;
  cacheTimestamp = now;

  return tokenData;
}

// Countdown timer functionality
let openedTokensData = new Map(); // tokenId -> {timestamp, cooldownMs}
let countdownInterval = null;

// Fetch opened tokens data from background
function fetchOpenedTokens() {
  chrome.runtime.sendMessage({ action: 'getOpenedTokens' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error fetching opened tokens:', chrome.runtime.lastError);
      return;
    }

    openedTokensData.clear();
    if (response && response.tokens) {
      response.tokens.forEach(({ tokenId, timestamp, cooldownMs }) => {
        openedTokensData.set(tokenId, { timestamp, cooldownMs });
      });
    }

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
  return 120 * 60; // Default 120 minutes
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

// Update countdown displays for all token rows
function updateCountdownDisplays() {
  if (isUpdatingDOM) return;

  isUpdatingDOM = true;

  try {
    const currentChain = detectChain();
    if (!currentChain) {
      return;
    }

    // Find all token links
    const tokenData = findTokenData(currentChain, true);

    if (tokenData.length === 0) {
      return;
    }

    tokenData.forEach(({ tokenId }) => {
      if (isTokenInCooldown(tokenId)) {
        // Add countdown timer to row if needed
        // (Implementation similar to DexScreener, simplified for GMGN)
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
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    updateCountdownDisplays();
  }, 1000);

  fetchOpenedTokens(); // Initial fetch
  setInterval(() => {
    fetchOpenedTokens();
  }, 30000); // Fetch every 30 seconds
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const currentUrl = location.href;
  const detectedChain = detectChain();

  console.log('GMGN Auto Filter extension content script loaded');
  console.log('📍 Current URL:', currentUrl);
  console.log('🔗 Detected Chain:', detectedChain || 'None');

  if (detectedChain) {
    // Run initial token check
    setTimeout(() => {
      console.log('🔍 Running initial token check...');
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
      console.log('🔍 Running secondary token check...');
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

