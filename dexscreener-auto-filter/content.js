// Content script for dexscreener.com

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
  // Throttled function for token detection - separate from countdown updates
  const throttledCheck = throttle(() => {
    invalidateTokenCache();
    checkMatchingTokens();
  }, 1000); // Check every 1 second for token detection

  const observer = new MutationObserver(() => {
    // Always trigger token checking - don't block it with isUpdatingDOM
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
const SUPPORTED_CHAINS = ['solana', 'bsc', 'base', 'ethereum', 'pulsechain', 'polygon', 'ton',
  'hyperliquid', 'sui', 'avalanche', 'worldchain', 'abstract', 'xrpl', 'arbitrum', 'hyperevm', 'near', 'sonic'];

// Detect current chain from URL
function detectChain() {
  const url = location.href;
  for (const chain of SUPPORTED_CHAINS) {
    // Match patterns like:
    // - /new-pairs/solana
    // - /solana/tokenId (token detail page)
    // - /solana (chain listing page with filters)
    if (url.includes(`/new-pairs/${chain}`) || url.includes(`/${chain}/`) || url.match(`/${chain}[?/]`)) {
      return chain;
    }
  }
  return null;
}

// Check if we're on a new-pairs page
function isNewPairsPage() {
  return location.href.includes('/new-pairs/');
}

function checkMatchingTokens() {
  const currentChain = detectChain();

  if (!currentChain) {
    // Silent skip if not on a chain page - this is normal for some DexScreener pages
    // Only log if we're actually on dexscreener.com
    if (location.href.includes('dexscreener.com')) {
      console.log('⏭️ Not a supported chain page:', location.href);
    }
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
      console.log('⏸️ Extension disabled - skipping token processing');
      return;
    }

    // Query current open tab count and calculate remaining slots
    chrome.runtime.sendMessage({ action: 'getOpenTabCount' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching open tab count:', chrome.runtime.lastError);
        return;
      }

      const currentOpenTabs = response && response.openTabCount ? response.openTabCount : 0;
      const remainingSlots = Math.max(0, maxTabs - currentOpenTabs);

      console.log(`📊 Current open tabs: ${currentOpenTabs}, Max tabs: ${maxTabs}, Remaining slots: ${remainingSlots}`);

      if (remainingSlots === 0) {
        console.log(`⏭️ No remaining slots (${currentOpenTabs}/${maxTabs} tabs open). Skipping token processing.`);
        return;
      }

      // Multiple strategies to find token links
      const tokenLinks = findTokenLinks(currentChain);
      const processedTokens = new Set(); // Track tokens processed in this call
      let messageCount = 0;
      const MAX_MESSAGES = Math.min(remainingSlots, 50); // Don't send more than remaining slots

      // Known non-token page identifiers to exclude
      const excludedPaths = ['moonit', 'new-pairs', 'top-gainers', 'top-losers', 'watchlist', 'portfolio', 'multicharts'];

      tokenLinks.forEach(link => {
        if (messageCount >= MAX_MESSAGES) return; // Stop if we've sent too many messages

        const href = link.getAttribute('href');

      // Try multiple patterns to extract token ID
      let tokenId = null;

      // Pattern 1: /solana/TOKENID
      let match = href.match(`/${currentChain}/([A-Za-z0-9]+)`);
      if (match) {
        tokenId = match[1];

        // CRITICAL FIX: Validate tokenId length - real token IDs are long
        // Exclude short strings like "moonit", "watchlist", etc.
        if (tokenId && tokenId.length < 20) {
          // Token IDs are typically 30-50+ characters
          // Short strings are navigation links, not tokens
          tokenId = null;
        }

        // Also check if it's a known excluded path
        if (tokenId && excludedPaths.some(path => href.toLowerCase().includes(path))) {
          tokenId = null;
        }
      }

      // Pattern 2: /token/SOMEID (some pages use /token/)
      if (!tokenId) {
        match = href.match(/\/token\/([A-Za-z0-9]+)/);
        if (match) {
          tokenId = match[1];
          if (tokenId && tokenId.length < 20) {
            tokenId = null;
          }
        }
      }

      // Pattern 3: Check if href contains a valid token ID (long alphanumeric)
      if (!tokenId) {
        match = href.match(/([A-Za-z0-9]{30,})/); // Token IDs are usually long
        if (match) {
          tokenId = match[1];
        }
      }

      if (tokenId) {
        const fullTokenId = `${currentChain}:${tokenId}`; // Include chain in ID

        // Only process each token once per check
        if (!processedTokens.has(fullTokenId)) {
          processedTokens.add(fullTokenId);

          // Check if we've hit the limit

          // Check cooldown status from background
          chrome.runtime.sendMessage({ action: 'checkTokenCooldown', tokenId: tokenId }, (cooldownResponse) => {
            if (chrome.runtime.lastError) {
              console.error('Error checking token cooldown:', chrome.runtime.lastError);
              return;
            }

            if (cooldownResponse && cooldownResponse.isInCooldown) {
              console.log(`⏳ Skipping token ${tokenId} - still in cooldown (verified by background)`);
              return;
            }

            // Check limit again before proceeding
            if (messageCount >= MAX_MESSAGES) return;

            messageCount++;

            // Token is ready, proceed with opening tab
            chrome.runtime.sendMessage({
              action: 'tokenMatchesFilter',
              tokenId: tokenId,
              chain: currentChain
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
                return;
              }
              if (response && response.success && response.timestamp && response.cooldownMs) {
                openedTokensData.set(tokenId, { timestamp: response.timestamp, cooldownMs: response.cooldownMs });
                console.log(`✅ Tab opened for ${tokenId}, updating UI immediately`);
                updateCountdownDisplays();
              } else if (response && !response.success) {
                console.log(`⏭️ Tab NOT opened for ${tokenId} (max tabs reached or already in cooldown)`);
              }
            });
          });
        }
      }
    });

    if (messageCount > 0) {
      console.log(`📊 Found ${messageCount} unique ${currentChain} tokens to process (maxTabs: ${maxTabs}, remainingSlots: ${remainingSlots})`);
    } else {
      console.log(`🔍 No ${currentChain} tokens found. Total links found: ${tokenLinks.length}`);
      // Debug: Show sample of links found
      if (tokenLinks.length > 0 && tokenLinks.length <= 5) {
        tokenLinks.forEach(link => {
          console.log('   Link:', link.getAttribute('href'));
        });
      }
    }
    }); // Close getOpenTabCount callback
  }); // Close chrome.storage.local.get callback
}
function findTokenLinks(chain, forceRefresh = false) {
  const now = Date.now();

  // Return cached results if still valid (within cache duration)
  if (!forceRefresh && cachedTokenLinks && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedTokenLinks;
  }

  const links = new Set();

  // Known non-token page identifiers to exclude
  const excludedPaths = ['moonit', 'top-gainers', 'top-losers', 'watchlist', 'portfolio', 'multicharts'];

  // OPTIMIZATION: Get all links once and filter, instead of multiple querySelectorAll calls
  const allLinks = document.querySelectorAll('a[href]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Strategy 1: Direct chain links
    if (href.includes(`/${chain}/`) && !excludedPaths.some(path => href.toLowerCase().includes(path))) {
      const match = href.match(`/${chain}/([A-Za-z0-9]+)`);
      if (match && match[1].length >= 20) {
        links.add(link);
        return; // Found, skip to next link
      }
    }

    // Strategy 2: Token links
    if (href.includes('/token/')) {
      const match = href.match(/\/token\/([A-Za-z0-9]+)/);
      if (match && match[1].length >= 20) {
        links.add(link);
        return;
      }
    }

    // Strategy 3: Long alphanumeric IDs
    if (href.match(/([A-Za-z0-9]{30,})/) && !href.includes('/new-pairs')) {
      links.add(link);
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

  // Known non-token page identifiers to exclude
  const excludedPaths = ['moonit', 'new-pairs', 'top-gainers', 'top-losers', 'watchlist', 'portfolio', 'multicharts'];

  // Try multiple patterns to extract token ID
  let match = href.match(`/${chain}/([A-Za-z0-9]+)`);
  if (match) {
    let tokenId = match[1];
    // Validate tokenId length - real token IDs are long
    if (tokenId && tokenId.length >= 20 && !excludedPaths.some(path => href.toLowerCase().includes(path))) {
      return tokenId;
    }
  }

  match = href.match(/\/token\/([A-Za-z0-9]+)/);
  if (match) {
    let tokenId = match[1];
    if (tokenId && tokenId.length >= 20) {
      return tokenId;
    }
  }

  match = href.match(/([A-Za-z0-9]{30,})/);
  if (match) {
    return match[1];
  }

  return null;
}

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
    return Math.floor(tokenData.cooldownMs / 1000); // Convert milliseconds to seconds
  }
  // Default to 120 minutes (2 hours) if not available
  return 120 * 60;
}

// Helper function to check if a token is ready (not in cooldown)
function isTokenReady(tokenId) {
  const tokenData = openedTokensData.get(tokenId);
  const cooldownDuration = getCooldownDuration(tokenId);

  if (tokenData && tokenData.timestamp) {
    // Token was opened - check if cooldown has expired
    const openedTime = tokenData.timestamp;
    const now = Date.now();
    const elapsed = Math.floor((now - openedTime) / 1000); // seconds since token was opened

    if (elapsed < cooldownDuration) {
      // Still in cooldown
      return false;
    } else {
      // Cooldown has expired
      return true;
    }
  }

  // Token has never been opened, so it's ready
  return true;
}

// Helper function to check if a token is in cooldown
function isTokenInCooldown(tokenId) {
  const tokenData = openedTokensData.get(tokenId);
  const cooldownDuration = getCooldownDuration(tokenId);

  if (tokenData && tokenData.timestamp) {
    // Token was opened - check if cooldown has expired
    const openedTime = tokenData.timestamp;
    const now = Date.now();
    const elapsed = Math.floor((now - openedTime) / 1000); // seconds since token was opened

    if (elapsed < cooldownDuration) {
      // Still in cooldown
      return true;
    } else {
      // Cooldown has expired
      return false;
    }
  }

  // Token has never been opened, so not in cooldown
  return false;
}

// Track timers being created to prevent race conditions
const timersBeingCreated = new Set();

// Add countdown timer to a token row - now displays detection time countdown
function addCountdownTimer(link, tokenId) {
  // Only show countdown timers on new-pairs pages
  if (!isNewPairsPage()) {
    return;
  }

  // Validate link
  if (!link || !link.href) {
    return;
  }

  // CRITICAL FIX: First check GLOBALLY for existing timer for this token
  // This prevents duplicate timers from being created anywhere on the page
  let existingTimer = document.querySelector(`.ds-token-timer[data-token-id="${tokenId}"]`);

  // If found globally, update it and clean up any duplicates
  if (existingTimer) {
    // Clean up ALL duplicate timers for this token (keep only the first one found)
    const allTimersForToken = document.querySelectorAll(`.ds-token-timer[data-token-id="${tokenId}"]`);
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
      // Token was opened - calculate countdown from when it was opened
      const openedTime = tokenData.timestamp;
      const now = Date.now();
      elapsed = Math.floor((now - openedTime) / 1000); // seconds since token was opened

      if (elapsed < cooldownDuration) {
        // Still in cooldown
        isInCooldown = true;
        countdownSeconds = cooldownDuration - elapsed;
      } else {
        // Cooldown has expired
        isInCooldown = false;
        countdownSeconds = 0;
      }
    }

    // Only show timer if token is in cooldown
    if (isInCooldown) {
      timer.textContent = formatTime(countdownSeconds);
    } else {
      // Remove timer if not in cooldown (no READY badge)
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
      // Ready or never opened
      timer.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      timer.style.opacity = '1';
    } else {
      // In cooldown - color based on remaining time
      const cooldownProgress = countdownSeconds / cooldownDuration;
      if (cooldownProgress > 0.75) {
        // More than 75% of cooldown remaining (green)
        timer.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
        timer.style.opacity = '1';
      } else if (cooldownProgress > 0.5) {
        // 50-75% remaining (blue)
        timer.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
        timer.style.opacity = '1';
      } else if (cooldownProgress > 0.25) {
        // 25-50% remaining (yellow)
        timer.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
        timer.style.opacity = '1';
      } else {
        // Less than 25% remaining (orange/red)
        timer.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
        timer.style.opacity = '0.9';
      }
    }

    return;
  }

  // Prevent race condition - if timer is already being created, skip
  if (timersBeingCreated.has(tokenId)) {
    return;
  }

  // Mark that we're creating a timer for this token
  timersBeingCreated.add(tokenId);

  // Try multiple strategies to find the container
  let container = link.closest('tr');

  // If not in a table row, try finding other common containers
  if (!container) {
    container = link.closest('td');
  }
  if (!container) {
    container = link.closest('[class*="row"]');
  }
  if (!container) {
    container = link.parentElement;
  }

  if (!container) {
    timersBeingCreated.delete(tokenId);
    return;
  }

  // Double-check after getting container (in case another thread created one)
  const recheckTimer = document.querySelector(`.ds-token-timer[data-token-id="${tokenId}"]`);
  if (recheckTimer) {
    timersBeingCreated.delete(tokenId);
    addCountdownTimer(link, tokenId); // Recursively call to update
    return;
  }

  // No timer exists for this token globally - create a new one
  // First clean up any orphaned timers without data-token-id in this container
  const orphanedTimers = container.querySelectorAll('.ds-token-timer:not([data-token-id])');
  orphanedTimers.forEach(timer => timer.remove());

  // Create new timer element with unique identifier
  const timer = document.createElement('div');
  timer.className = 'ds-token-timer';
  timer.setAttribute('data-token-id', tokenId); // Add unique identifier
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

  // Try multiple insertion strategies to insert inline with token name
  let inserted = false;

  // Strategy 1: Insert after ds-dex-table-row-base-token-name-text inside ds-dex-table-row-base-token-name
  try {
    // Find the parent row first, then search for token elements within it
    const tableRow = link.closest('.ds-dex-table-row');
    const tokenNameContainer = tableRow ? tableRow.querySelector('.ds-dex-table-row-base-token-name') : link.closest('.ds-dex-table-row-base-token-name');
    const tokenNameText = tableRow ? tableRow.querySelector('.ds-dex-table-row-base-token-name-text') : link.closest('.ds-dex-table-row-base-token-name-text');

    if (tokenNameContainer && tokenNameText) {
      // Insert timer right after the token name text element
      tokenNameText.parentNode.insertBefore(timer, tokenNameText.nextSibling);
      console.log('✅ Inserted timer after .ds-dex-table-row-base-token-name-text for token:', tokenId);
      inserted = true;
    } else if (tokenNameContainer) {
      // Fallback: insert at end of token name container
      tokenNameContainer.appendChild(timer);
      console.log('✅ Inserted timer inside .ds-dex-table-row-base-token-name (no text element found) for token:', tokenId);
      inserted = true;
    } else {
      console.log('⚠️ Strategy 1: Could not find token container. tableRow:' + tableRow + ', tokenNameContainer:' + tokenNameContainer + ' for token:', tokenId);
    }
  } catch (e) {
    console.log('❌ Strategy 1 failed:', e);
  }

  // Strategy 2: Find parent span/div of the link and insert after link
  if (!inserted) {
    try {
      // Find the immediate parent container of the link
      let parentContainer = link.parentElement;
      if (parentContainer && parentContainer.tagName !== 'TD') {
        // Insert after the link inside its parent
        if (link.nextSibling) {
          parentContainer.insertBefore(timer, link.nextSibling);
        } else {
          parentContainer.appendChild(timer);
        }
        inserted = true;
      }
    } catch (e) {
      // Silent failure
    }
  }

  // Strategy 3: Insert directly after the link element
  if (!inserted) {
    try {
      if (link.nextSibling) {
        link.parentNode.insertBefore(timer, link.nextSibling);
        inserted = true;
      } else if (link.parentNode) {
        link.parentNode.appendChild(timer);
        inserted = true;
      }
    } catch (e) {
      // Silent failure
    }
  }

  // Strategy 4: Fallback - find any nearby container and insert
  if (!inserted) {
    try {
      const tdCell = link.closest('td');
      if (tdCell) {
        // Try to find the token name wrapper div
        const tokenWrapper = tdCell.querySelector('.ds-dex-table-row-base-token-name');
        if (tokenWrapper) {
          tokenWrapper.appendChild(timer);
          inserted = true;
        } else {
          tdCell.appendChild(timer);
          inserted = true;
        }
      }
    } catch (e) {
      // Silent failure
    }
  }

  if (!inserted) {
    timersBeingCreated.delete(tokenId);
    return;
  }

  // Initial update with same logic as update above
  const tokenData = openedTokensData.get(tokenId);
  const cooldownDuration = getCooldownDuration(tokenId);

  let countdownSeconds = 0;
  let elapsed = 0;
  let isInCooldown = false;

  if (tokenData && tokenData.timestamp) {
    // Token was opened - calculate countdown from when it was opened
    const openedTime = tokenData.timestamp;
    const now = Date.now();
    elapsed = Math.floor((now - openedTime) / 1000);

    if (elapsed < cooldownDuration) {
      // Still in cooldown
      isInCooldown = true;
      countdownSeconds = cooldownDuration - elapsed;
    } else {
      // Cooldown has expired
      isInCooldown = false;
      countdownSeconds = 0;
    }
  }

  // Only show timer if token is in cooldown
  if (isInCooldown) {
    timer.textContent = formatTime(countdownSeconds);
  } else {
    // Remove timer if not in cooldown (no READY badge)
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

  // Clear the creation flag now that timer is created
  timersBeingCreated.delete(tokenId);
}

// Clean up duplicate timers periodically
function cleanupDuplicateTimers() {
  // Get all timers with data-token-id
  const allTimers = document.querySelectorAll('.ds-token-timer[data-token-id]');
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
      // Keep the first, remove the rest
      for (let i = 1; i < timers.length; i++) {
        timers[i].remove();
      }
    }
  });

  // Also clean up any timers without data-token-id (orphaned timers)
  const orphanedTimers = document.querySelectorAll('.ds-token-timer:not([data-token-id])');
  orphanedTimers.forEach(timer => timer.remove());
}

// Update countdown displays for all token rows
function updateCountdownDisplays() {
  // Prevent recursive calls
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
    const tokenLinks = findTokenLinks(currentChain, true);
    console.log('🔄 updateCountdownDisplays: Found', tokenLinks.length, 'token links');

    if (tokenLinks.length === 0) {
      return;
    }

    tokenLinks.forEach((link, index) => {
    const tokenId = getTokenIdFromLink(link, currentChain);
    console.log(`🔗 Link ${index}: tokenId=${tokenId || 'NO_ID'}, href=${link.href?.substring(0, 80)}`);

    if (!tokenId) return;

      // Only show timer for tokens that are in cooldown
      if (isTokenInCooldown(tokenId)) {
        try {
          console.log('⏰ Calling addCountdownTimer for:', tokenId);
          addCountdownTimer(link, tokenId);
        } catch (error) {
          console.error('❌ Error in addCountdownTimer:', error);
        }
      }
    });
  } finally {
    // Allow updates after a brief delay
    setTimeout(() => {
      isUpdatingDOM = false;
    }, 50);
  }
}

// Start countdown timer updates with optimized frequency
function startCountdownUpdates() {
  // Prevent multiple intervals from being created
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Update every 1 second for accurate countdown display
  countdownInterval = setInterval(() => {
    updateCountdownDisplays();
  }, 1000); // 1 second for smooth countdown

  // Fetch fresh data every 30 seconds
  fetchOpenedTokens(); // Initial fetch
  setInterval(() => {
    fetchOpenedTokens();
  }, 30000); // Reduced frequency
}

// Track URL changes and opened filter URLs
let lastUrl = location.href;
let openedFilterUrls = new Set();

// Countdown timer functionality
let openedTokensData = new Map(); // tokenId -> {timestamp, cooldownMs}
let countdownInterval = null;

// Supabase configuration for new filters to improve cooldown performance
const SUPABASE_URL = 'https://putcecldtpverondjprx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGNlY2xkdHB2ZXJvbmRqcHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Mzk0NjQsImV4cCI6MjA3NzIxNTQ2NH0.mNcGdDw_3F3MLT1jG0iX4LF-ffKtgsHII4SCOJqIBwY';

// Track token detection time (when token was first detected)
let tokenDetectionTime = new Map(); // tokenId -> detectionTimestamp

// Track new filters to avoid duplicate logging
let newFilterUrls = new Set();

// Function to log filter to Supabase
async function logFilterToSupabase(filterUrl, chain) {
  // Skip if already new in this session
  if (newFilterUrls.has(filterUrl)) {
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/new_filter`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        filter_url: filterUrl,
        chain: chain || null
      })
    });

    if (response.ok || response.status === 201 || response.status === 204) {
      newFilterUrls.add(filterUrl);
      console.log('✅ New filter to Supabase:', filterUrl.substring(0, 80));
    } else {
      console.error('Failed to log filter:', response.status, response.statusText);
    }
  } catch (error) {
    // Silent fail - don't interrupt user experience
    console.error('Error logging filter to Supabase:', error);
  }
}

// Detect URL changes and open new filter tabs
function detectUrlChange() {
  const currentUrl = location.href;

  // Check if URL has actually changed
  if (currentUrl === lastUrl) return;

  // Only process dexscreener.com URLs
  if (!currentUrl.includes('dexscreener.com')) return;

  // Skip token detail pages (check all supported chains)
  const detectedChain = detectChain();
  if (detectedChain && currentUrl.match(`/${detectedChain}/([A-Za-z0-9]+)$`)) return;

  // Check if this is a filter URL (has query parameters)
  const hasQueryParams = currentUrl.includes('?');

  if (hasQueryParams) {
    // Check if we've already opened this filter URL
    if (!openedFilterUrls.has(currentUrl)) {
      console.log('🔍 New filter URL detected:', currentUrl);

      // Log filter to Supabase for analytics
      logFilterToSupabase(currentUrl, detectedChain);

      // Send message to background to open this filter URL
      chrome.runtime.sendMessage({
        action: 'openFilterUrl',
        url: currentUrl
      });

      openedFilterUrls.add(currentUrl);

      // Clean up old URLs (keep only last 100)
      if (openedFilterUrls.size > 100) {
        const urls = Array.from(openedFilterUrls);
        openedFilterUrls = new Set(urls.slice(50)); // Keep last 50
      }
    } else {
      console.log('⏭️ Filter URL already processed:', currentUrl);
    }
  }

  lastUrl = currentUrl;
}

// Track if we have a main observer to avoid duplicates
let mainObserver = null;

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const currentUrl = location.href;
  const detectedChain = detectChain();

  console.log('DexScreener extension content script loaded');
  console.log('📍 Current URL:', currentUrl);
  console.log('🔗 Detected Chain:', detectedChain || 'None');

  if (detectedChain) {
    // Run initial token check immediately (no delay for faster detection)
    setTimeout(() => {
      console.log('🔍 Running initial token check...');
      invalidateTokenCache(); // Clear cache for fresh scan
      checkMatchingTokens();
    }, 500); // Reduced delay

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

  // Check initial URL
  detectUrlChange();
}

// OPTIMIZATION: Debounced URL detection to avoid excessive checks
const debouncedUrlCheck = debounce(detectUrlChange, 500);

// Consolidated: Single setInterval with throttled URL check
let urlCheckInterval = setInterval(debouncedUrlCheck, 2000); // Check every 2 seconds instead of 1

// Listen for popstate (browser back/forward) - debounced
window.addEventListener('popstate', () => {
  setTimeout(debouncedUrlCheck, 300);
});

// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  cachedTokenLinks = null; // Clear cache on unload
});

