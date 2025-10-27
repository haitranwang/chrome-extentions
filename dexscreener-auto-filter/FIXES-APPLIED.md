# Chrome Extension Errors - Fixes Applied

## Errors Fixed

### Error 1: Service Worker Registration Failed (Status Code 15)
**Cause**: Service worker registration fails when there's a syntax error or runtime error in the service worker code.

### Error 2: "Uncaught ReferenceError: window is not defined"
**Location**: Line 60 in `background.js`
**Cause**: Attempted to access `window.openedTokens = openedTokens;`

---

## Root Cause Analysis

### Why the `window` Error Occurs

In **Manifest V3 Chrome Extensions**, service workers run in a **separate execution context** that is fundamentally different from web pages:

1. **No DOM Access**: Service workers cannot access the DOM or window object
2. **Separate Context**: They run in an isolated JavaScript environment
3. **No Global `window`**: The `window` object doesn't exist in service workers

#### Comparison: Manifest V2 vs Manifest V3

**Manifest V2 (Background Pages):**
```javascript
// Had DOM access
window.myVariable = something;  // ✅ Worked
```

**Manifest V3 (Service Workers):**
```javascript
// NO DOM access
window.myVariable = something;  // ❌ ReferenceError: window is not defined
```

### Why This Caused Service Worker Registration to Fail

When Chrome tries to register the service worker:
1. Chrome loads `background.js`
2. Executes the code line by line
3. Reaches: `window.openedTokens = openedTokens;`
4. Throws ReferenceError because `window` doesn't exist
5. Service worker registration fails (Status Code 15)

---

## Fixes Applied

### Fix 1: Removed `window` Reference

**Before (Line 60):**
```javascript
// Export for debugging
window.openedTokens = openedTokens;
```

**After:**
```javascript
// Note: Service workers don't have a 'window' object
// For debugging, use: console.log(openedTokens);
```

### Why This Fix Works

1. **Removes the error**: No more `window` reference, so no error
2. **Service worker loads**: Chrome can now successfully register the service worker
3. **Maintains functionality**: All core functionality (tab opening, cooldown) remains intact

---

## Alternative Debugging Methods

Since `window` is not available in service workers, use these alternatives:

### 1. Console Logging (Recommended)
```javascript
console.log('Opened tokens:', openedTokens);
console.log('Current cooldown state:', openedTokens.size);
```

### 2. Chrome DevTools Inspection
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Inspect views: service worker"
4. Access variables in the console

### 3. Use `globalThis` (Not Recommended)
```javascript
globalThis.openedTokens = openedTokens;  // Works but not needed
```

---

## Verification Steps

### To Verify the Extension Works:

1. **Load the extension**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dexscreener-auto-filter/` folder

2. **Check for errors**:
   - Should see no service worker errors
   - Extension should show "Enabled" status

3. **Test the functionality**:
   - Navigate to `https://dexscreener.com`
   - Wait for the page to load
   - Tokens should automatically open in new tabs
   - Check console (F12) for debugging output

---

## Updated Code Structure

### background.js (Fixed)
```javascript
// Background service worker for Chrome Extension

let openedTokens = new Map(); // tokenId -> timestamp
const COOLDOWN_PERIOD = 15 * 60 * 1000; // 15 minutes in milliseconds

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('DexScreener Extension installed');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tokenMatchesFilter') {
    openTokenTab(request.tokenId);
  }
});

// Function to open token tab with cooldown
async function openTokenTab(tokenId) {
  try {
    const now = Date.now();

    // Check cooldown
    const lastOpened = openedTokens.get(tokenId);
    if (lastOpened && (now - lastOpened < COOLDOWN_PERIOD)) {
      console.log(`Token ${tokenId} is in cooldown`);
      return;
    }

    // Check if token already exists in any tab
    const tabs = await chrome.tabs.query({});
    const tokenUrl = `https://dexscreener.com/solana/${tokenId}`;

    for (const tab of tabs) {
      if (tab.url === tokenUrl) {
        console.log(`Token ${tokenId} already open`);
        openedTokens.set(tokenId, now);
        return;
      }
    }

    // Open new tab
    await chrome.tabs.create({ url: tokenUrl, active: false });
    openedTokens.set(tokenId, now);

    console.log(`Opened token ${tokenId}`);

    // Clean up old entries (older than cooldown period)
    for (const [token, timestamp] of openedTokens.entries()) {
      if (now - timestamp > COOLDOWN_PERIOD) {
        openedTokens.delete(token);
      }
    }
  } catch (error) {
    console.error('Error opening token tab:', error);
  }
}

// Note: Service workers don't have a 'window' object
// For debugging, use: console.log(openedTokens);
```

---

## Key Takeaways

1. **Manifest V3 service workers** don't have DOM access
2. **No `window` object** in service workers
3. **Use `console.log()`** for debugging instead
4. **Service workers are isolated** from the DOM and web pages

---

## Testing the Fix

The extension should now:
- ✅ Load without errors
- ✅ Register service worker successfully
- ✅ Detect tokens on dexscreener.com
- ✅ Open tabs with 15-minute cooldown
- ✅ Prevent duplicate tabs

---

## If You Still See Errors

1. **Clear extension data**:
   - Go to `chrome://extensions/`
   - Click "Remove" on the extension
   - Reload it

2. **Check the console**:
   - Open DevTools (F12)
   - Check for other errors

3. **Verify manifest.json**:
   - Ensure syntax is correct
   - Check permissions are appropriate

