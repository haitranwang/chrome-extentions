# GMGN Auto Filter - Implementation Documentation

## Overview

The `gmgn-auto-filter` Chrome extension is designed to automatically open token tabs from GMGN.ai's top-ranked tokens in sequential order. Unlike the `dexscreener-auto-filter` extension, this extension **does NOT** include URL-based filter synchronization features since GMGN does not update filters directly in the URL.

## Key Differences from DexScreener Extension

### Core Functionality
- **DexScreener**: Opens tokens matching URL-based filters AND automatically opens filter URLs
- **GMGN**: Opens top-ranked tokens sequentially WITHOUT any filter URL management

### Technical Differences
- **No Filter URL Detection**: GMGN doesn't update filters in URLs like DexScreener does
- **Simpler Architecture**: No need for filter URL tracking or synchronization
- **Direct Token Opening**: Focuses solely on opening tokens from rankings
- **Top-to-Bottom Sequence**: Opens tokens in order from rankings

## Features

### 1. Automatic Token Tab Opening
- Detects tokens on GMGN filter pages
- Opens token tabs in sequence (top-ranked → down)
- Configurable cooldown between tokens (default: 15 minutes)
- Maximum tab limit enforcement (default: 10 tabs)

### 2. Multi-Chain Support
- **Solana**: `https://gmgn.ai/?chain=sol`
- **Binance Smart Chain (BSC)**: `https://gmgn.ai/?chain=bsc`
- Automatically detects chain from URL
- Supports chain-specific token page URLs

### 3. Cooldown Management
- Prevents opening the same token multiple times within cooldown period
- Visual countdown timer displayed next to token name
- Cooldown persists even if tab is closed
- Configurable cooldown period (1-60 minutes)

### 4. Tab Management
- Tracks all open token tabs
- Respects maximum tab limit
- Prevents duplicate token tabs
- Cleans up expired cooldown records

## Token URL Formats

### Solana
```
https://gmgn.ai/sol/token/FyZCJJ5VbhkgrviigFoJHaXup7ZA57rNgYghiMJ7pump
```

### BSC
```
https://gmgn.ai/bsc/token/0x8b2955679eb9effbd268520c05673972ffd34444
```

## Cooldown Timer Location

The countdown timer is displayed next to the token name using this CSS selector:

```css
#GlobalScrollDomId > main > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > div > div > div > div > div > div:nth-child(1) > div > div > div.flex.flex-1.h-full.overflow-hidden > div > div.relative.flex.justify-between > div.flex.flex-col.w-full > div.flex.items-center.min-w-0.overflow-hidden.text-base.gap-x-4px.whitespace-nowrap.leading-\[20px\].h-\[20px\] > div > div.flex.items-center.cursor-pointer.gap-x-4px.text-text-300.text-\[12px\].font-normal.group.hover\:text-text-100.transition-colors.min-w-0.max-w-full > div
```

## Architecture Overview

### Components

1. **manifest.json**
   - Defines extension metadata
   - Permissions: `tabs`, `storage`
   - Host permissions for GMGN domains
   - Background service worker
   - Content scripts for GMGN pages
   - Popup action for settings UI

2. **background.js** (Service Worker)
   - Manages token cooldown tracking
   - Handles tab opening with cooldown checks
   - Enforces maximum tab limits
   - Tracks open tabs
   - Cleans up expired cooldowns
   - Loads/saves user settings

3. **content.js** (Content Script)
   - Detects current blockchain chain from URL
   - Finds token links on GMGN pages
   - Extracts token IDs from links
   - Sends token data to background script
   - Displays countdown timers for tokens in cooldown
   - Handles dynamic content loading
   - Performance optimizations (throttling, caching)

4. **popup.html & popup.js**
   - Settings interface
   - Configure cooldown period
   - Configure maximum tabs
   - Enable/disable extension
   - View statistics (open tabs count)
   - No filter management needed (unlike DexScreener)

### Data Flow

1. User navigates to GMGN filter page (Solana or BSC)
2. Content script detects chain and scans for token links
3. Token links are extracted and validated
4. Background script checks:
   - If token is in cooldown
   - If tab limit is reached
   - If token tab is already open
5. If valid, opens token tab in background
6. Records token with timestamp for cooldown tracking
7. Content script displays countdown timer for tokens in cooldown
8. Timer updates every second
9. Expired cooldowns are cleaned up automatically

### Key Data Structures

```javascript
// Background Service Worker
openedTokens = Map<tokenId, timestamp>  // Tracks when tokens were opened
tabIdToTokenInfo = Map<tabId, {tokenId, tokenUrl, timestamp}>  // Maps tabs to tokens
settings = {cooldownMinutes, maxTabs}  // User configuration

// Content Script
openedTokensData = Map<tokenId, {timestamp, cooldownMs}>  // Cache for UI updates
```

## Implementation Approach

### Simplifications Compared to DexScreener

1. **No Filter URL Management**
   - Remove all filter URL detection logic
   - Remove filter URL opening functionality
   - No `openFilterUrl()` function needed
   - No filter tracking variables (`openedFilterUrls`, etc.)

2. **Simplified Token Detection**
   - Focus on extracting token IDs from GMGN's specific URL patterns
   - No need to detect filter parameters
   - Simpler URL parsing logic

3. **Simpler Popup UI**
   - Remove "Favorite Filters" tab entirely
   - Only show Settings tab
   - No filter management interface
   - No Supabase integration for filters

4. **Optimized Selectors**
   - Use the provided CSS selector for cooldown timer display
   - Adapt selector patterns for GMGN's DOM structure

### What to Keep from DexScreener

1. **Core Tab Management**
   - Cooldown tracking logic
   - Maximum tab limit enforcement
   - Tab cleanup on close
   - Settings management

2. **Performance Optimizations**
   - Throttling and debouncing utilities
   - Token link caching
   - DOM update batching
   - Duplicate timer prevention

3. **UI Patterns**
   - Popup interface styling
   - Settings form layout
   - Toggle switches
   - Statistics display

4. **Extension Infrastructure**
   - Manifest V3 setup
   - Background service worker pattern
   - Content script initialization
   - Message passing between components

## Configuration Options

### User Settings

- **Cooldown Period** (1-60 minutes, default: 15)
  - Time before a token can be opened again
  - Applied per token, not globally

- **Maximum Tabs** (1-100, default: 10)
  - Total limit on open token tabs
  - Enforced before opening new tabs

- **Extension Enable/Disable** (toggle)
  - Global on/off switch
  - Preserves settings when disabled

## Files to Create

```
gmgn-auto-filter/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (simplified)
├── content.js            # Content script (simplified)
├── popup.html            # Settings UI (simplified)
├── popup.js              # Settings logic (simplified)
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
├── gmgn-logo.png         # GMGN logo (already exists)
├── README.md             # User documentation
└── DOCUMENTATION.md      # This file
```

## Testing Considerations

1. **Chain Detection**
   - Test on Solana filter page (`?chain=sol`)
   - Test on BSC filter page (`?chain=bsc`)
   - Verify correct token URL format for each chain

2. **Token Detection**
   - Verify token links are found correctly
   - Check token ID extraction from URLs
   - Test with dynamic content loading

3. **Cooldown Logic**
   - Verify tokens don't reopen within cooldown period
   - Check countdown timer accuracy
   - Test cleanup of expired cooldowns

4. **Tab Management**
   - Verify maximum tab limit enforcement
   - Test opening 10+ tokens
   - Check duplicate prevention

5. **Performance**
   - Monitor memory usage with many open tabs
   - Verify no memory leaks in cooldown tracking
   - Check timer update performance

## Browser Compatibility

- **Chrome**: Full support (Manifest V3)
- **Edge**: Should work (Chromium-based)
- **Brave**: Should work (Chromium-based)
- **Other browsers**: Not tested

## Security & Privacy

- All data stored locally in browser storage
- No external API calls or data transmission
- No tracking or analytics
- No Supabase or external database usage
- Only interacts with GMGN.ai domains

## Future Enhancements (Optional)

1. Support additional chains (Ethereum, Base, etc.)
2. Customizable cooldown periods per chain
3. Token ranking sorting options
4. Export opened tokens list
5. Keyboard shortcuts for controls

