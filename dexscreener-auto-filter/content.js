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
    // Only trigger token checking when NOT updating countdowns
    if (!isUpdatingDOM) {
      throttledCheck();
    }
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

  // Multiple strategies to find token links
  const tokenLinks = findTokenLinks(currentChain);
  const processedTokens = new Set(); // Track tokens processed in this call
  let messageCount = 0;
  const MAX_MESSAGES = Math.min(maxTabs, 50); // Don't send more than maxTabs

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

        // Record detection time for this token
        if (!tokenDetectionTime.has(tokenId)) {
          tokenDetectionTime.set(tokenId, Date.now());
        }

        // Open tab for detected token with chain info
        chrome.runtime.sendMessage({
          action: 'tokenMatchesFilter',
          tokenId: tokenId,
          chain: currentChain
        }, (response) => {
          // Optional: Log response if needed
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
          }
        });

        messageCount++;
      }
    }
  });

  if (messageCount > 0) {
    console.log(`📊 Found ${messageCount} unique ${currentChain} tokens to process (maxTabs: ${maxTabs})`);
  } else {
    console.log(`🔍 No ${currentChain} tokens found. Total links found: ${tokenLinks.length}`);
    // Debug: Show sample of links found
    if (tokenLinks.length > 0 && tokenLinks.length <= 5) {
      tokenLinks.forEach(link => {
        console.log('   Link:', link.getAttribute('href'));
      });
    }
  }
}

// Enhanced token link finding with multiple strategies and caching
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

// Add countdown timer to a token row - now displays detection time countdown
function addCountdownTimer(link, tokenId) {
  // Validate link
  if (!link || !link.href) {
    return;
  }

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
    return;
  }

  // Look for existing timer in the container
  const existingTimer = container.querySelector('.ds-token-timer');
  if (existingTimer) {
    // Just update the existing timer element
    const timer = existingTimer;

    // Get detection time or default to 2 hours ago (for countdown)
    const detectionTime = tokenDetectionTime.get(tokenId) || Date.now() - (2 * 60 * 60 * 1000);
    const now = Date.now();
    const elapsed = Math.floor((now - detectionTime) / 1000); // seconds since detection
    const countdownSeconds = Math.max(0, (2 * 60 * 60) - elapsed); // 2 hours - elapsed

    // Format as HH:MM:SS
    timer.textContent = formatTime(countdownSeconds);

    // Update title with time since discovery
    if (elapsed < 3600) {
      timer.title = `Discovered ${formatTime(elapsed)} ago`;
    } else if (elapsed < 7200) {
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      timer.title = `Discovered ${hours}h ${minutes}m ago`;
    } else {
      const hours = Math.floor(elapsed / 3600);
      timer.title = `Discovered ${hours}h ago`;
    }

    // Change color based on how recent the discovery is
    if (elapsed < 300) { // Less than 5 minutes - very recent (green)
      timer.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
      timer.style.opacity = '1';
    } else if (elapsed < 1800) { // Less than 30 minutes - recent (blue)
      timer.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
      timer.style.opacity = '1';
    } else if (elapsed < 3600) { // Less than 1 hour - moderate (yellow)
      timer.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
      timer.style.opacity = '1';
    } else if (elapsed < 5400) { // Less than 1.5 hours (orange)
      timer.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
      timer.style.opacity = '0.9';
    } else if (elapsed < 7200) { // Less than 2 hours (red)
      timer.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      timer.style.opacity = '0.8';
    } else { // Over 2 hours - show as expired
      timer.textContent = 'EXPIRED';
      timer.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
      timer.style.opacity = '0.6';
    }

    return;
  }

  // Create new timer element
  const timer = document.createElement('div');
  timer.className = 'ds-token-timer';
  timer.style.cssText = `
    display: inline-block !important;
    padding: 3px 10px;
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    color: white !important;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    margin-left: 10px;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    letter-spacing: 0.5px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    z-index: 9999;
    position: relative;
  `;

  // Try multiple insertion strategies
  let inserted = false;

  // Strategy 1: Find a good container (td, div with certain classes, etc.)
  try {
    const tdCell = link.closest('td');
    if (tdCell) {
      tdCell.appendChild(timer);
      inserted = true;
    }
  } catch (e) {
    // Silent fail
  }

  // Strategy 2: Insert after the link
  if (!inserted) {
    try {
      if (link.parentNode) {
        link.parentNode.insertBefore(timer, link.nextSibling);
        inserted = true;
      }
    } catch (e) {
      // Silent fail
    }
  }

  // Strategy 3: Append to container
  if (!inserted) {
    try {
      if (container) {
        container.appendChild(timer);
        inserted = true;
      }
    } catch (e) {
      // Silent fail
    }
  }

  // Strategy 4: Fallback - append to link as last resort
  if (!inserted) {
    try {
      link.appendChild(timer);
      inserted = true;
    } catch (e) {
      // Silent fail
    }
  }

  if (!inserted) {
    return;
  }

  // Initial update with same logic as update above
  const detectionTime = tokenDetectionTime.get(tokenId) || Date.now() - (2 * 60 * 60 * 1000);
  const now = Date.now();
  const elapsed = Math.floor((now - detectionTime) / 1000);
  const countdownSeconds = Math.max(0, (2 * 60 * 60) - elapsed);

  timer.textContent = formatTime(countdownSeconds);

  if (elapsed < 3600) {
    timer.title = `Discovered ${formatTime(elapsed)} ago`;
  } else {
    const hours = Math.floor(elapsed / 3600);
    timer.title = `Discovered ${hours}h ago`;
  }

  // Set color
  if (elapsed < 300) {
    timer.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
    timer.style.opacity = '1';
  } else if (elapsed < 1800) {
    timer.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
    timer.style.opacity = '1';
  } else if (elapsed < 3600) {
    timer.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
    timer.style.opacity = '1';
  } else if (elapsed < 5400) {
    timer.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
    timer.style.opacity = '0.9';
  } else if (elapsed < 7200) {
    timer.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    timer.style.opacity = '0.8';
  } else {
    timer.textContent = 'EXPIRED';
    timer.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    timer.style.opacity = '0.6';
  }
}

// Update countdown displays for all token rows
function updateCountdownDisplays() {
  // Prevent recursive calls
  if (isUpdatingDOM) return;

  isUpdatingDOM = true;

  try {
    const currentChain = detectChain();
    if (!currentChain) return;

    // Find all token links - force refresh to get latest
    const tokenLinks = findTokenLinks(currentChain, true);

    if (tokenLinks.length === 0) {
      return;
    }

    tokenLinks.forEach(link => {
      const tokenId = getTokenIdFromLink(link, currentChain);
      if (!tokenId) return;

      // Show timer for all detected tokens
      try {
        addCountdownTimer(link, tokenId);
      } catch (error) {
        // Silent error handling
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
  if (countdownInterval) return;

  // Update every 5 seconds to reduce load on browser
  countdownInterval = setInterval(() => {
    updateCountdownDisplays();
  }, 5000); // Reduced to 5 seconds

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

// Track token detection time (when token was first detected)
let tokenDetectionTime = new Map(); // tokenId -> detectionTimestamp

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

