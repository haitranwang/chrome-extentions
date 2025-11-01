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
  // Check for chain in URL: https://gmgn.ai/trend/0cvNAY8R?chain=sol or https://gmgn.ai/sol/token/...
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
  oneMin: { enabled: false, thresholdLess: null, thresholdGreater: null },
  fiveMin: { enabled: false, thresholdLess: null, thresholdGreater: null },
  oneHour: { enabled: false, thresholdLess: null, thresholdGreater: null }
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

  // Find values using nth-child selectors directly on cells
  // GMGN uses div:nth-child(12) for 1m%, div:nth-child(13) for 5m%, div:nth-child(14) for 1h%

  let oneMinValue = null;
  let fiveMinValue = null;
  let oneHourValue = null;

  // Extract 1m% value from nth-child(12)
  if (filterConfig.oneMin.enabled) {
    try {
      const cell = tokenRow.querySelector('div:nth-child(12)');
      if (cell) {
        const span = cell.querySelector('div > span');
        if (span) {
          const text = span.textContent.trim();
          if (text.includes('%')) {
            const value = parseFloat(text.replace('%', ''));
            if (!isNaN(value)) {
              oneMinValue = value;
              console.log(`🔍 Found 1m% value: ${value} from div:nth-child(12)`);
            }
          }
        }
      }
    } catch (e) {
      console.log('Error extracting 1m%:', e);
    }
  }

  // Extract 5m% value from nth-child(13)
  if (filterConfig.fiveMin.enabled) {
    try {
      const cell = tokenRow.querySelector('div:nth-child(13)');
      if (cell) {
        const span = cell.querySelector('div > span');
        if (span) {
          const text = span.textContent.trim();
          if (text.includes('%')) {
            const value = parseFloat(text.replace('%', ''));
            if (!isNaN(value)) {
              fiveMinValue = value;
              console.log(`🔍 Found 5m% value: ${value} from div:nth-child(13)`);
            }
          }
        }
      }
    } catch (e) {
      console.log('Error extracting 5m%:', e);
    }
  }

  // Extract 1h% value from nth-child(14)
  if (filterConfig.oneHour.enabled) {
    try {
      const cell = tokenRow.querySelector('div:nth-child(14)');
      if (cell) {
        const span = cell.querySelector('div > span');
        if (span) {
          const text = span.textContent.trim();
          if (text.includes('%')) {
            const value = parseFloat(text.replace('%', ''));
            if (!isNaN(value)) {
              oneHourValue = value;
              console.log(`🔍 Found 1h% value: ${value} from div:nth-child(14)`);
            }
          }
        }
      }
    } catch (e) {
      console.log('Error extracting 1h%:', e);
    }
  }

  // Check each enabled filter
  if (filterConfig.oneMin.enabled) {
    if (oneMinValue === null) {
      console.log('⚠️ 1m% filter enabled but value not found');
      return false; // If we can't find the value, don't match
    }
    const matches = checkThresholdMatch(oneMinValue, filterConfig.oneMin);
    console.log(`🔍 1m% filter: value=${oneMinValue}, less=${filterConfig.oneMin.thresholdLess}, greater=${filterConfig.oneMin.thresholdGreater}, matches=${matches}`);
    if (!matches) {
      return false;
    }
  }

  if (filterConfig.fiveMin.enabled) {
    if (fiveMinValue === null) {
      console.log('⚠️ 5m% filter enabled but value not found');
      return false; // If we can't find the value, don't match
    }
    const matches = checkThresholdMatch(fiveMinValue, filterConfig.fiveMin);
    console.log(`🔍 5m% filter: value=${fiveMinValue}, less=${filterConfig.fiveMin.thresholdLess}, greater=${filterConfig.fiveMin.thresholdGreater}, matches=${matches}`);
    if (!matches) {
      return false;
    }
  }

  if (filterConfig.oneHour.enabled) {
    if (oneHourValue === null) {
      console.log('⚠️ 1h% filter enabled but value not found');
      return false; // If we can't find the value, don't match
    }
    const matches = checkThresholdMatch(oneHourValue, filterConfig.oneHour);
    console.log(`🔍 1h% filter: value=${oneHourValue}, less=${filterConfig.oneHour.thresholdLess}, greater=${filterConfig.oneHour.thresholdGreater}, matches=${matches}`);
    if (!matches) {
      return false;
    }
  }

  return true; // All enabled filters passed
}

// Helper function to check if a value matches the threshold criteria
// Returns true if: value < thresholdLess OR value > thresholdGreater
// Both thresholds are optional (can be null)
function checkThresholdMatch(value, filterConfig) {
  const { thresholdLess, thresholdGreater } = filterConfig;

  console.log(`  [checkThresholdMatch] value=${value}, thresholdLess=${thresholdLess}, thresholdGreater=${thresholdGreater}`);

  // If both thresholds are null, no match (shouldn't happen if validation is working)
  if (thresholdLess === null && thresholdGreater === null) {
    console.log(`  [checkThresholdMatch] Both thresholds null, returning false`);
    return false;
  }

  // Check if value matches at least one of the criteria
  let matchesLess = false;
  let matchesGreater = false;

  if (thresholdLess !== null && value < thresholdLess) {
    matchesLess = true;
    console.log(`  [checkThresholdMatch] ✓ matches less: ${value} < ${thresholdLess}`);
  }

  if (thresholdGreater !== null && value > thresholdGreater) {
    matchesGreater = true;
    console.log(`  [checkThresholdMatch] ✓ matches greater: ${value} > ${thresholdGreater}`);
  }

  // Match if either condition is true
  const result = matchesLess || matchesGreater;
  console.log(`  [checkThresholdMatch] Final result: ${result} (matchesLess: ${matchesLess}, matchesGreater: ${matchesGreater})`);
  return result;
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
let fetchInterval = null;
let tokenCheckInterval = null;

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

// Track timers being created to prevent race conditions
const timersBeingCreated = new Set();

// Add countdown timer to a token row
function addCountdownTimer(link, tokenId) {
  // Only show countdown timers on listing pages
  if (!isListingPage()) {
    return;
  }

  // Validate link
  if (!link || !link.href) {
    return;
  }

  // CRITICAL FIX: First check GLOBALLY for existing timer for this token
  let existingTimer = document.querySelector(`.gmgn-token-timer[data-token-id="${tokenId}"]`);

  // If found globally, update it and clean up any duplicates
  if (existingTimer) {
    // Clean up ALL duplicate timers for this token
    const allTimersForToken = document.querySelectorAll(`.gmgn-token-timer[data-token-id="${tokenId}"]`);
    if (allTimersForToken.length > 1) {
      console.log('🧹 Cleaning up', allTimersForToken.length - 1, 'duplicate timers for token:', tokenId);
      for (let i = 1; i < allTimersForToken.length; i++) {
        allTimersForToken[i].remove();
      }
    }

    // Update the timer
    const timer = existingTimer;

    // Get the timestamp when token was opened and cooldown duration
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
      } else {
        isInCooldown = false;
        countdownSeconds = 0;
      }
    }

    // Only show timer if token is in cooldown
    if (isInCooldown) {
      timer.textContent = formatTime(countdownSeconds);
    } else {
      timer.remove();
      return;
    }

    // Update title with time since last action
    if (tokenData && tokenData.timestamp) {
      if (isInCooldown) {
        const remainingMins = Math.floor(countdownSeconds / 60);
        const totalMins = Math.floor(cooldownDuration / 60);
        timer.title = `Opened ${formatTime(elapsed)} ago • ${remainingMins}/${totalMins} min cooldown`;
      } else {
        timer.title = `Cooldown complete (opened ${formatTime(elapsed)} ago)`;
      }
    } else {
      const totalMins = Math.floor(cooldownDuration / 60);
      timer.title = `Not opened yet • Will have ${totalMins}-min cooldown`;
    }

    // Change color based on cooldown status
    if (!isInCooldown) {
      timer.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      timer.style.opacity = '1';
    } else {
      const cooldownProgress = countdownSeconds / cooldownDuration;
      if (cooldownProgress > 0.75) {
        timer.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
        timer.style.opacity = '1';
      } else if (cooldownProgress > 0.5) {
        timer.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
        timer.style.opacity = '1';
      } else if (cooldownProgress > 0.25) {
        timer.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
        timer.style.opacity = '1';
      } else {
        timer.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
        timer.style.opacity = '0.9';
      }
    }

    return;
  }

  // Prevent race condition
  if (timersBeingCreated.has(tokenId)) {
    return;
  }

  // Mark that we're creating a timer for this token
  timersBeingCreated.add(tokenId);

  // Find the token name container using the provided CSS selector pattern
  // Target: div.css-1vlwulx (the last div in the selector path)
  let container = null;

  try {
    // Try to find the parent link/row first
    const linkParent = link.parentElement;

    // Navigate up to find the token name container
    // The structure is: a > div.css-fen2w7 > div.css-1ar5kb0 > div > div.css-12zlagp > div.css-1vlwulx
    let currentElement = link;
    for (let i = 0; i < 5; i++) {
      if (!currentElement) break;
      currentElement = currentElement.parentElement;
      if (currentElement && currentElement.classList.contains('css-1vlwulx')) {
        container = currentElement;
        break;
      }
    }

    // Fallback: search within the link's ancestors
    if (!container) {
      container = link.closest('.css-1vlwulx');
    }

    // Fallback: find any div with css-1vlwulx in the row
    if (!container) {
      const row = link.closest('[class*="row"], tr');
      if (row) {
        container = row.querySelector('.css-1vlwulx');
      }
    }

    // Fallback: just use the link's parent
    if (!container) {
      container = linkParent;
    }
  } catch (e) {
    console.log('⚠️ Could not find container:', e);
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

  // No timer exists - create a new one
  const orphanedTimers = container.querySelectorAll('.gmgn-token-timer:not([data-token-id])');
  orphanedTimers.forEach(timer => timer.remove());

  // Create new timer element
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

  // Try to insert after the last text element in container
  let inserted = false;

  try {
    // Try to insert after the last child
    if (container.lastChild) {
      container.insertBefore(timer, container.lastChild.nextSibling);
    } else {
      container.appendChild(timer);
    }
    inserted = true;
  } catch (e) {
    console.log('❌ Failed to insert timer:', e);
  }

  // Fallback: append to container
  if (!inserted) {
    try {
      container.appendChild(timer);
      inserted = true;
    } catch (e) {
      console.log('❌ Fallback insert failed:', e);
    }
  }

  if (!inserted) {
    timersBeingCreated.delete(tokenId);
    return;
  }

  // Initial update
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
    } else {
      isInCooldown = false;
      countdownSeconds = 0;
    }
  }

  // Only show timer if token is in cooldown
  if (isInCooldown) {
    timer.textContent = formatTime(countdownSeconds);
  } else {
    timer.remove();
    timersBeingCreated.delete(tokenId);
    return;
  }

  // Update title
  if (tokenData && tokenData.timestamp) {
    if (isInCooldown) {
      const remainingMins = Math.floor(countdownSeconds / 60);
      const totalMins = Math.floor(cooldownDuration / 60);
      timer.title = `Opened ${formatTime(elapsed)} ago • ${remainingMins}/${totalMins} min cooldown`;
    } else {
      timer.title = `Cooldown complete (opened ${formatTime(elapsed)} ago)`;
    }
  } else {
    const totalMins = Math.floor(cooldownDuration / 60);
    timer.title = `Not opened yet • Will have ${totalMins}-min cooldown`;
  }

  // Set color based on cooldown status
  if (!isInCooldown) {
    timer.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    timer.style.opacity = '1';
  } else {
    const cooldownProgress = countdownSeconds / cooldownDuration;
    if (cooldownProgress > 0.75) {
      timer.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
      timer.style.opacity = '1';
    } else if (cooldownProgress > 0.5) {
      timer.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
      timer.style.opacity = '1';
    } else if (cooldownProgress > 0.25) {
      timer.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
      timer.style.opacity = '1';
    } else {
      timer.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
      timer.style.opacity = '0.9';
    }
  }

  timersBeingCreated.delete(tokenId);
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

  // Also clean up any timers without data-token-id
  const orphanedTimers = document.querySelectorAll('.gmgn-token-timer:not([data-token-id])');
  orphanedTimers.forEach(timer => timer.remove());
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

    // Clean up any duplicate timers first
    cleanupDuplicateTimers();

    // Find all token links - force refresh to get latest
    const tokenData = findTokenData(currentChain, true);

    if (tokenData.length === 0) {
      return;
    }

    tokenData.forEach(({ tokenId, link }) => {
      if (isTokenInCooldown(tokenId)) {
        try {
          addCountdownTimer(link, tokenId);
        } catch (error) {
          console.error('❌ Error in addCountdownTimer:', error);
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
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    updateCountdownDisplays();
  }, 1000);

  fetchOpenedTokens(); // Initial fetch
  fetchInterval = setInterval(() => {
    fetchOpenedTokens();
  }, 30000); // Fetch every 30 seconds

  // Start periodic token check for GMGN price updates
  // Check every 3 seconds to catch real-time price changes
  tokenCheckInterval = setInterval(() => {
    checkMatchingTokens();
  }, 3000); // Check every 3 seconds
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
  if (fetchInterval) {
    clearInterval(fetchInterval);
  }
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }
  cachedTokenLinks = null;
});

