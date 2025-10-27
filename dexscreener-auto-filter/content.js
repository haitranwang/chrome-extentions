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

function checkMatchingTokens() {
  const tokenLinks = document.querySelectorAll('a[href*="/solana/"]');
  const processedTokens = new Set(); // Track tokens processed in this call
  let messageCount = 0;
  const MAX_MESSAGES = 50; // Limit messages per check to prevent spam

  tokenLinks.forEach(link => {
    if (messageCount >= MAX_MESSAGES) return; // Stop if we've sent too many messages

    const href = link.getAttribute('href');
    const match = href.match(/\/solana\/([A-Za-z0-9]+)/);

    if (match) {
      const tokenId = match[1];

      // Only process each token once per check
      if (!processedTokens.has(tokenId)) {
        processedTokens.add(tokenId);

        // Open tab for detected token (one at a time)
        chrome.runtime.sendMessage({
          action: 'tokenMatchesFilter',
          tokenId: tokenId
        });

        messageCount++;
      }
    }
  });

  if (messageCount > 0) {
    console.log(`📊 Found ${messageCount} unique tokens to process`);
  }
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

  // Skip token detail pages
  if (currentUrl.match(/\/solana\/[A-Za-z0-9]+$/)) return;

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
  console.log('DexScreener extension content script loaded');

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

