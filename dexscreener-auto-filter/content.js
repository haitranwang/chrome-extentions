// Content script for dexscreener.com

// Watch for new token listings
function watchForTokens() {
  const observer = new MutationObserver(() => {
    checkMatchingTokens();
  });

  const targetNode = document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });
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

function processTokens(currentChain, maxTabs) {
  // Multiple strategies to find token links
  const tokenLinks = findTokenLinks(currentChain);
  const processedTokens = new Set(); // Track tokens processed in this call
  let messageCount = 0;
  const MAX_MESSAGES = Math.min(maxTabs, 50); // Don't send more than maxTabs

  tokenLinks.forEach(link => {
    if (messageCount >= MAX_MESSAGES) return; // Stop if we've sent too many messages

    const href = link.getAttribute('href');

    // Try multiple patterns to extract token ID
    let tokenId = null;

    // Pattern 1: /solana/TOKENID
    let match = href.match(`/${currentChain}/([A-Za-z0-9]+)`);
    if (match) {
      tokenId = match[1];
    }

    // Pattern 2: /token/SOMEID (some pages use /token/)
    if (!tokenId) {
      match = href.match(/\/token\/([A-Za-z0-9]+)/);
      if (match) {
        tokenId = match[1];
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

// Enhanced token link finding with multiple strategies
function findTokenLinks(chain) {
  const links = new Set();

  // Strategy 1: Direct chain links
  document.querySelectorAll(`a[href*="/${chain}/"]`).forEach(link => links.add(link));

  // Strategy 2: Token links (some pages use /token/)
  document.querySelectorAll('a[href*="/token/"]').forEach(link => links.add(link));

  // Strategy 3: Look for links containing long alphanumeric IDs (likely token addresses)
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.match(/([A-Za-z0-9]{30,})/) && !href.includes('/new-pairs')) {
      links.add(link);
    }
  });

  return Array.from(links);
}

// Track URL changes and opened filter URLs
let lastUrl = location.href;
let openedFilterUrls = new Set();

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
    // Run initial token check immediately
    setTimeout(() => {
      console.log('🔍 Running initial token check...');
      checkMatchingTokens();
    }, 1000);
  }

  // Start watching for tokens
  watchForTokens();

  // Check initial URL
  detectUrlChange();
}

// Listen for URL changes (both SPA navigation and regular navigation)
let urlCheckInterval = setInterval(detectUrlChange, 1000);

// Also use MutationObserver for SPA navigation
new MutationObserver(() => {
  detectUrlChange();
}).observe(document, { subtree: true, childList: true });

// Listen for popstate (browser back/forward)
window.addEventListener('popstate', () => {
  setTimeout(detectUrlChange, 500);
});

// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
  }
});

