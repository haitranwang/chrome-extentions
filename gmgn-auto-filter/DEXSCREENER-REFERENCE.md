# DexScreener Auto Filter Extension - Technical Reference

**Created:** For GMGN Auto Filter development
**Purpose:** Comprehensive documentation of dexscreener-auto-filter architecture to guide gmgn-auto-filter implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Key Patterns](#key-patterns)
5. [Data Flow](#data-flow)
6. [Token Detection & Filtering](#token-detection--filtering)
7. [Tab Management](#tab-management)
8. [User Interface](#user-interface)
9. [Database Integration](#database-integration)
10. [Performance Optimizations](#performance-optimizations)
11. [Important Differences for GMGN](#important-differences-for-gmgn)

---

## Overview

The `dexscreener-auto-filter` extension is a sophisticated Chrome extension that:
- Automatically detects tokens on DexScreener.com
- Opens token detail tabs automatically based on filter criteria
- Tracks opened tokens to prevent duplicates
- Manages favorite filter configurations
- Supports 17+ blockchain networks

**Key Points:**
- No custom filter configuration (DexScreener has built-in filters)
- All filtering happens via URL parameters
- Extension auto-opens tabs for ALL tokens on a page
- Cooldown mechanism prevents re-opening same tokens

---

## Architecture

### Tech Stack

- **Manifest Version:** V3 (latest Chrome Extension standard)
- **Background:** Service Worker (`background.js`)
- **Content:** Content Script (`content.js`)
- **UI:** Popup HTML/CSS/JS (`popup.html`, `popup.js`)
- **Storage:** Chrome Local Storage + Supabase Database
- **Permissions:** `tabs`, `storage`, host permissions

### File Structure

```
dexscreener-auto-filter/
├── manifest.json              # V3 manifest with permissions
├── background.js              # Service worker for tab management
├── content.js                 # Content script for token detection
├── popup.html                 # Settings UI
├── popup.js                   # Popup logic
├── fingerprint.js             # Browser fingerprinting for user isolation
├── filter-url-builder.js     # Helper for building filter URLs
├── icon*.png                  # Extension icons
├── README.md                  # User-facing documentation
├── FILTER-REFERENCE.md        # DexScreener filter parameters
└── USER_ISOLATION_IMPLEMENTATION.md  # User isolation docs
```

### Communication Flow

```
Content Script ←→ Background Service Worker ←→ Popup
                    ↓                           ↓
                Chrome API                Storage API
                    ↓                           ↓
                   Tabs                  Local Storage + Supabase
```

---

## Core Components

### 1. Background Service Worker (`background.js`)

**Purpose:** Manages tab opening, cooldown tracking, and settings

**Key Responsibilities:**
- Opens token tabs with duplicate prevention
- Tracks opened tokens with timestamps
- Manages cooldown periods (configurable, default 15 min)
- Handles tab removal cleanup
- Processes messages from content scripts

**Data Structures:**
```javascript
let openedTokens = new Map();           // tokenId -> timestamp
let tokenUrlToId = new Map();           // tokenUrl -> tokenId
let tabIdToTokenInfo = new Map();       // tabId -> {tokenId, tokenUrl, timestamp}
let tokensBeingOpened = new Set();      // Prevent race conditions
let openedFilterUrls = new Set();       // Track opened filter URLs
let settings = { cooldownMinutes: 15 };
```

**Key Functions:**
- `openTokenTab(tokenId, chain)`: Opens token tab with cooldown check
- `openFilterUrl(url)`: Opens filter URL in new tab
- Message handler: Processes `tokenMatchesFilter`, `getStats`, etc.

**Race Condition Prevention:**
```javascript
// Critical: Check if token is being opened to prevent duplicates
if (tokensBeingOpened.has(tokenKey)) {
  return false;
}
tokensBeingOpened.add(tokenKey);
// ... create tab ...
tokensBeingOpened.delete(tokenKey);
```

**Cooldown Cleanup:**
- Removes tokens older than cooldown period from tracking Maps
- Prevents memory leaks from long sessions

### 2. Content Script (`content.js`)

**Purpose:** Detects tokens, monitors page changes, displays countdown timers

**Key Responsibilities:**
- Scans page for token links
- Detects supported blockchain chains
- Sends token matches to background script
- Displays countdown timers on token rows
- Monitors URL changes for filter detection
- Logs filters to Supabase for analytics

**Key Data Structures:**
```javascript
let cachedTokenLinks = null;                        // Token link cache
let lastProcessedTokens = new Set();                // Prevent reprocessing
let tokensWithPendingMessages = new Map();          // Track pending requests
let tokensBeingChecked = new Set();                 // Prevent concurrent checks
let successfullyProcessedTokens = new Map();        // Mark processed tokens
let openedTokensData = new Map();                   // tokenId -> {timestamp, cooldownMs}
```

**Token Detection Flow:**
```javascript
1. Watch for DOM changes (MutationObserver)
2. Detect current blockchain chain from URL
3. Find all token links on page (findTokenLinks)
4. Extract token IDs from links (validate length >= 20)
5. Check if already processed (multiple checks)
6. Verify cooldown with background script
7. Send open request to background
8. Add countdown timer to row
```

**Supported Chains:**
```javascript
const SUPPORTED_CHAINS = [
  'solana', 'bsc', 'base', 'ethereum', 'pulsechain',
  'polygon', 'ton', 'hyperliquid', 'sui', 'avalanche',
  'worldchain', 'abstract', 'xrpl', 'arbitrum', 'hyperevm', 'near', 'sonic'
];
```

**URL Detection Patterns:**
```javascript
// Pattern 1: /solana/TOKENID
let match = href.match(`/${currentChain}/([A-Za-z0-9]+)`);

// Pattern 2: /token/SOMEID
match = href.match(/\/token\/([A-Za-z0-9]+)/);

// Validation: Token IDs must be >= 20 characters
if (tokenId && tokenId.length < 20) {
  tokenId = null; // Not a real token
}
```

**Visibility Detection:**
```javascript
function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  // Check display, visibility, opacity
  // Check bounding rect dimensions
  // Check if within viewport (+ 100px buffer for virtual scrolling)
}
```

**Countdown Timer Display:**
```javascript
// Adds timer badge to token row showing cooldown remaining
// Color-coded: green → blue → yellow → orange/red
// Updates every 1 second
// Removed when cooldown expires
```

**Performance Optimizations:**
- Throttling: Token checks limited to every 1 second
- Debouncing: URL checks limited to every 500ms
- Caching: Token links cached for 500ms
- Process interval: Max once per 2 seconds
- Processed token timeout: 60 seconds

### 3. Popup UI (`popup.html`, `popup.js`)

**Purpose:** Settings configuration and favorite filters management

**Key Features:**
- **Settings Tab:**
  - Extension enable/disable toggle
  - Cooldown period configuration (1-60 minutes)
  - Statistics display (extension status, tabs opened)

- **Favorite Filters Tab:**
  - View current filter URL
  - Add filter to favorites
  - List saved favorite filters
  - Delete favorites
  - Open filters in new tabs

**UI Components:**
```html
- Tabs: Settings / Favorite Filters
- Toggle switch: Enable/disable extension
- Number input: Cooldown minutes
- Statistics panel: Status and counts
- Filter list: Scrollable list with delete buttons
- Empty state: No filters message
```

**Storage Operations:**
```javascript
// Settings
chrome.storage.local.set({ cooldownMinutes: 15 });
chrome.storage.local.get(['extensionEnabled']);

// Statistics
chrome.runtime.sendMessage({ action: 'getStats' });

// Favorites (Supabase)
GET    /rest/v1/dexscreener-filter?user_id=eq.{fingerprint}
POST   /rest/v1/dexscreener-filter { filter, user_id }
DELETE /rest/v1/dexscreener-filter?id=eq.{id}&user_id=eq.{fingerprint}
```

### 4. Browser Fingerprinting (`fingerprint.js`)

**Purpose:** Generate unique user identifier for database isolation

**How It Works:**
1. Collects browser characteristics:
   - User agent, platform, language
   - Screen dimensions, color depth
   - Timezone offset
   - Hardware concurrency, device memory
   - Canvas fingerprint (rendered text hash)
   - WebGL vendor/renderer
   - Available fonts

2. Generates SHA-256 hash of all collected data

3. Stores in Chrome local storage for persistence

4. Used as `user_id` in Supabase database

**Key Functions:**
```javascript
generateBrowserFingerprint() // Creates new fingerprint
getBrowserFingerprint()      // Gets stored or creates new
getCanvasFingerprint()       // Canvas rendering hash
detectFonts()                // Font availability detection
```

---

## Key Patterns

### 1. Cooldown Management

**Goal:** Prevent opening the same token multiple times within a time period

**Implementation:**
```javascript
// Background checks
const lastOpened = openedTokens.get(tokenId);
if (lastOpened && (now - lastOpened < cooldownPeriod)) {
  return false; // Still in cooldown
}

// Content script checks
chrome.runtime.sendMessage({ action: 'checkTokenCooldown', tokenId }, (response) => {
  if (response.isInCooldown) {
    return; // Skip
  }
  // Proceed with opening
});
```

### 2. Race Condition Prevention

**Problem:** Multiple content script checks can trigger duplicate tab opens

**Solutions:**
```javascript
// 1. Tokens being opened (background)
let tokensBeingOpened = new Set();
if (tokensBeingOpened.has(tokenKey)) return false;

// 2. Tokens being checked (content)
let tokensBeingChecked = new Set();
if (tokensBeingChecked.has(tokenId)) return;

// 3. Pending messages (content)
let tokensWithPendingMessages = new Map();
if (tokensWithPendingMessages.has(tokenId)) return;

// 4. Successfully processed (content)
let successfullyProcessedTokens = new Map();
if (successfullyProcessedTokens.has(tokenId)) return;
```

### 3. State Synchronization

**Problem:** Content script needs to know which tokens are in cooldown

**Solution:**
```javascript
// Content fetches data from background
function fetchOpenedTokens() {
  chrome.runtime.sendMessage({ action: 'getOpenedTokens' }, (response) => {
    openedTokensData.clear();
    response.tokens.forEach(({ tokenId, timestamp, cooldownMs }) => {
      openedTokensData.set(tokenId, { timestamp, cooldownMs });
    });
  });
}

// Periodically updates (every 30 seconds)
setInterval(fetchOpenedTokens, 30000);
```

### 4. URL Change Detection

**Problem:** Need to detect when user changes filter parameters

**Solution:**
```javascript
let lastUrl = location.href;

// Debounced check every 2 seconds
setInterval(debouncedUrlCheck, 2000);

function detectUrlChange() {
  const currentUrl = location.href;
  if (currentUrl === lastUrl) return;

  if (hasQueryParams) {
    // Open filter URL in new tab
    chrome.runtime.sendMessage({ action: 'openFilterUrl', url: currentUrl });
  }

  lastUrl = currentUrl;
}
```

---

## Data Flow

### Token Opening Flow

```
User navigates to DexScreener page
    ↓
Content script detects page load
    ↓
MutationObserver triggers on DOM changes
    ↓
findTokenLinks() scans for token links
    ↓
Extract token IDs, validate length >= 20
    ↓
Check if already processed (4 different checks)
    ↓
Request cooldown status from background
    ↓
If not in cooldown: Send open request
    ↓
Background checks race conditions
    ↓
Background checks cooldown
    ↓
Background checks if tab already open
    ↓
Background creates new tab
    ↓
Background updates Maps with token info
    ↓
Content displays countdown timer
    ↓
Background cleans up old tokens
```

### Filter URL Detection Flow

```
User changes filter parameters in URL
    ↓
Content script detects URL change (debounced)
    ↓
Extract query parameters
    ↓
Check if already opened
    ↓
Send message to background
    ↓
Background checks all tabs for URL
    ↓
Open new tab if not found
    ↓
Log to Supabase for analytics
    ↓
Add to openedFilterUrls Set
```

---

## Token Detection & Filtering

### Token Link Finding

**Strategy 1: Chain-specific links**
```javascript
// Pattern: /solana/TOKENID
const match = href.match(`/${chain}/([A-Za-z0-9]+)`);
```

**Strategy 2: Token links**
```javascript
// Pattern: /token/TOKENID
const match = href.match(/\/token\/([A-Za-z0-9]+)/);
```

**Validation:**
- Token ID must be >= 20 characters
- Exclude known non-token paths (moonit, watchlist, etc.)
- Must be in visible table row
- Must be in main table container

### Token ID Validation

**Critical Check:**
```javascript
// Real token IDs are 30-50+ characters
// Short strings are navigation links
if (tokenId && tokenId.length < 20) {
  tokenId = null;
}
```

**Exclusion List:**
```javascript
const excludedPaths = [
  'moonit', 'new-pairs', 'top-gainers', 'top-losers',
  'watchlist', 'portfolio', 'multicharts'
];
```

### Visibility Checks

**Why Important:** Virtual scrolling can load tokens outside viewport

**Implementation:**
```javascript
function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  const rect = element.getBoundingClientRect();
  // Allow 100px buffer for virtual scrolling
  if (rect.bottom < -100 || rect.top > viewportHeight + 100) return false;

  return true;
}
```

---

## Tab Management

### Tab Opening

**Request Flow:**
```javascript
content.js:
  chrome.runtime.sendMessage({
    action: 'tokenMatchesFilter',
    tokenId: 'xxx',
    chain: 'solana'
  });

background.js:
  openTokenTab(tokenId, chain) {
    // 1. Check race condition
    // 2. Check cooldown
    // 3. Check if tab already exists
    // 4. Create tab
    // 5. Update Maps
    // 6. Cleanup
  }
```

### Tab Tracking

**Three-level tracking:**
1. `openedTokens` - For cooldown (key: tokenId)
2. `tokenUrlToId` - For URL lookup (key: tokenUrl)
3. `tabIdToTokenInfo` - For tab cleanup (key: tabId)

**Tab Removal:**
```javascript
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const { tokenId, tokenUrl } = tabIdToTokenInfo.get(tabId);
  tokenUrlToId.delete(tokenUrl);
  tabIdToTokenInfo.delete(tabId);

  // NOTE: Keep in openedTokens for cooldown!
});
```

### Cooldown Cleanup

**Automatic cleanup on each open:**
```javascript
const now = Date.now();
for (const [token, timestamp] of openedTokens.entries()) {
  if (now - timestamp > cooldownPeriod) {
    openedTokens.delete(token);
    // Clean up from all Maps
  }
}
```

---

## User Interface

### Popup Tabs

**Tab Switching:**
```javascript
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update content
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tabName}Tab`).classList.add('active');
}
```

### Settings Form

**Form Fields:**
- Extension toggle (checkbox with custom switch styling)
- Cooldown input (number, 1-60)
- Save/Reset buttons
- Status messages

**Event Handling:**
```javascript
extensionEnabled.addEventListener('change', handleExtensionToggle);
settingsForm.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);
```

### Favorite Filters

**Add Filter:**
```javascript
async function addCurrentFilterToFavorites() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const filterUrl = currentTab.url;

  // POST to Supabase
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter`, {
    method: 'POST',
    body: JSON.stringify({ filter: filterUrl, user_id: browserFingerprint })
  });

  loadFavorites(); // Refresh list
}
```

**Delete Filter:**
```javascript
async function deleteFilter(id) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dexscreener-filter?id=eq.${id}&user_id=eq.${browserFingerprint}`,
    { method: 'DELETE' }
  );

  loadFavorites(); // Refresh list
}
```

---

## Database Integration

### Supabase Configuration

```javascript
const SUPABASE_URL = 'https://putcecldtpverondjprx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Database Schema

```sql
CREATE TABLE dexscreener-filter (
  id BIGSERIAL PRIMARY KEY,
  filter TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT,              -- Browser fingerprint
  INDEX idx_user_id (user_id)
);
```

### API Operations

**GET (Load Favorites):**
```javascript
fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter?user_id=eq.${browserFingerprint}`, {
  method: 'GET',
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
```

**POST (Add Favorite):**
```javascript
fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter`, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ filter: url, user_id: browserFingerprint })
});
```

**DELETE (Remove Favorite):**
```javascript
fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter?id=eq.${id}&user_id=eq.${fingerprint}`, {
  method: 'DELETE'
});
```

### Analytics

**Filter URL Logging:**
```javascript
async function logFilterToSupabase(filterUrl, chain) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/new_filter`, {
    method: 'POST',
    body: JSON.stringify({ filter_url: filterUrl, chain: chain })
  });
}
```

---

## Performance Optimizations

### Content Script Optimizations

**1. Throttling & Debouncing:**
```javascript
const throttledCheck = throttle(() => {
  invalidateTokenCache();
  checkMatchingTokens();
}, 1000); // Max once per second

const debouncedUrlCheck = debounce(detectUrlChange, 500);
setInterval(debouncedUrlCheck, 2000); // Every 2 seconds
```

**2. Caching:**
```javascript
let cachedTokenLinks = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 500; // 500ms cache

if (!forceRefresh && cachedTokenLinks && (now - cacheTimestamp) < CACHE_DURATION) {
  return cachedTokenLinks; // Return cached
}
```

**3. Process Intervals:**
```javascript
let lastProcessCheck = 0;
const PROCESS_INTERVAL = 2000; // Only process every 2 seconds

if (now - lastProcessCheck < PROCESS_INTERVAL) {
  return; // Skip
}
```

**4. Processed Token Memory:**
```javascript
let successfullyProcessedTokens = new Map();
const PROCESSED_TOKEN_TIMEOUT = 60000; // 60 seconds

// Cleanup old entries
for (const [tokenId, timestamp] of successfullyProcessedTokens.entries()) {
  if (now - timestamp > PROCESSED_TOKEN_TIMEOUT) {
    successfullyProcessedTokens.delete(tokenId);
  }
}
```

**5. Single MutationObserver:**
```javascript
let mainObserver = null;
if (mainObserver) return; // Already watching

mainObserver = new MutationObserver(() => {
  throttledCheck();
});
mainObserver.observe(document.body, { childList: true, subtree: true });
```

### Background Script Optimizations

**1. Batch Cleanup:**
```javascript
// Only cleanup on token open (not continuously)
function openTokenTab(tokenId, chain) {
  // ... open tab ...

  // Clean up old entries
  for (const [token, timestamp] of openedTokens.entries()) {
    if (now - timestamp > cooldownPeriod) {
      // Delete from all Maps
    }
  }
}
```

**2. Filter URL Cleanup:**
```javascript
// Keep only last 50 filter URLs
if (openedFilterUrls.size > 50) {
  const urls = Array.from(openedFilterUrls);
  openedFilterUrls = new Set(urls.slice(25));
}
```

---

## Important Differences for GMGN

### Critical Differences

**1. Filter Configuration:**
- **DexScreener:** No configuration needed (uses DexScreener's built-in filters)
- **GMGN:** REQUIRES custom filter configuration UI for price change thresholds

**2. Token Opening Logic:**
- **DexScreener:** Opens ALL tokens on page
- **GMGN:** Opens ONLY tokens matching configured filters

**3. Filter Criteria:**
- **DexScreener:** URL parameters determine what tokens are shown
- **GMGN:** Extension reads table cells and applies custom logic

**4. URL Pattern:**
- **DexScreener:** `https://dexscreener.com/{chain}/{tokenId}`
- **GMGN:** `https://gmgn.ai/{chain}/token/{tokenId}`

**5. Chain Detection:**
- **DexScreener:** `/{chain}/` in URL
- **GMGN:** `?chain={chain}` or `/{chain}/` in URL
- **GMGN URL Examples:**
  - Trend page: `https://gmgn.ai/trend/0cvNAY8R?chain=sol`
  - Token page: `https://gmgn.ai/sol/token/TOKENID`

**6. Required Changes for GMGN:**

```javascript
// NEW: Filter configuration
const filters = {
  oneMin: { enabled: false, threshold: 0 },
  fiveMin: { enabled: false, threshold: 0 },
  oneHour: { enabled: false, threshold: 0 }
};

// NEW: Read price change from table cells
const oneMinCell = document.querySelector('#GlobalScrollDomId > div > div.py-0.overflow-x-auto.px-\[8px\] > div.px-0.py-0.overflow-x-auto.block > div > div > div > div > div.g-table-tbody-virtual.g-table-tbody > div.g-table-tbody-virtual-holder > div > div > div:nth-child(1) > div:nth-child(12) > div > span');

// NEW: Check if token matches filters
function tokenMatchesFilters(tokenRow) {
  if (filters.oneMin.enabled) {
    const value = parseFloat(oneMinCell.textContent);
    if (value < filters.oneMin.threshold) return false;
  }
  // ... check other filters
  return true;
}

// NEW: Highlight matching tokens
function highlightTokenRow(tokenRow) {
  tokenRow.style.filter = 'brightness(1.3)';
}

// MODIFIED: Only open matching tokens
if (tokenMatchesFilters(tokenRow)) {
  chrome.runtime.sendMessage({ action: 'tokenMatchesFilter', tokenId, chain });
  highlightTokenRow(tokenRow);
}
```

---

## Key Takeaways for GMGN Development

1. **Architecture:** Follow the same component structure (background, content, popup)

2. **Performance:** Implement all optimization patterns (throttling, caching, cleanup)

3. **Race Conditions:** Use all prevention mechanisms (Sets and Maps for tracking)

4. **Cooldown:** Implement identical cooldown management

5. **User Isolation:** Use browser fingerprinting for database isolation

6. **UI Patterns:** Follow popup tab structure and styling

7. **NEW Requirement:** Add filter configuration UI and logic

8. **NEW Requirement:** Implement token row highlighting

9. **NEW Requirement:** Read values from GMGN table cells using provided selectors

10. **MODIFIED:** Change URL patterns for GMGN structure

---

## Conclusion

The `dexscreener-auto-filter` extension provides a robust foundation with:
- Solid architecture using Manifest V3
- Comprehensive race condition handling
- Excellent performance optimizations
- User-friendly UI patterns
- Database integration with user isolation

For GMGN, adapt this architecture with:
- Custom filter configuration
- Token row reading and highlighting
- GMGN-specific URL patterns
- Filter-based token opening (not all tokens)

This documentation provides everything needed to implement a similar extension for GMGN while adding the required custom filtering capabilities.

