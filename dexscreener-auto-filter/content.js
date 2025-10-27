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
}

// Listen for navigation changes (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });

