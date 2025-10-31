# GMGN Auto Filter Chrome Extension

A Chrome extension for GMGN.ai that automatically opens tabs for tokens matching custom price change filters, highlights matching tokens, and tracks opened tokens across multiple blockchains.

## Features

### Custom Price Change Filters

Configure filters based on price change percentages:
- **1m%** (1-minute price change) - Opens tokens with price change >= threshold
- **5m%** (5-minute price change) - Opens tokens with price change >= threshold
- **1h%** (1-hour price change) - Opens tokens with price change >= threshold

You can enable one or more filters simultaneously. Tokens must meet ALL enabled filter criteria to be opened.

### Token Highlighting

When a token matches your filter criteria:
- The token's row is highlighted/brightened to stand out
- The token is automatically opened in a new tab

### Multi-Chain Support

Works across multiple blockchain networks:
- Solana (sol)
- BSC
- Ethereum (eth)
- Base
- Arbitrum (arb)
- Polygon
- Avalanche (avax)
- Optimism (op)
- zkSync
- TON
- Sui
- Aptos
- NEAR

### Cooldown Management

- Configurable cooldown period (default: 15 minutes)
- Tracks opened tokens to prevent duplicates
- Opens tabs in background for uninterrupted browsing

### Smart Filtering

- Only processes tokens on listing/trend pages
- Skips token detail pages
- Prevents race conditions and duplicate tab opening
- Optimized performance with caching and throttling

## Installation

1. Clone or download the Chrome Extensions Repository to your local machine
2. Navigate to the `gmgn-auto-filter/` folder
3. Ensure you have the required icon files (icon16.png, icon48.png, icon128.png)
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in the top right)
6. Click "Load unpacked"
7. Select the `gmgn-auto-filter/` folder
8. The extension should now appear in your extensions list

## Usage

### Basic Setup

1. Load the extension in Chrome (see Installation)
2. Click the extension icon to open the popup
3. Configure your filter settings:
   - **Enable/Disable**: Toggle the extension on or off
   - **Cooldown Period**: Set minutes before opening the same token again (1-60)
   - **Price Change Filters**: Enable and set thresholds for 1m%, 5m%, and/or 1h%
4. Click "Save" to apply settings
5. Navigate to [gmgn.ai](https://gmgn.ai) on any supported chain
6. The extension automatically opens tabs for matching tokens

### Filter Configuration

**Example: Find tokens with significant short-term gains**

1. Enable the "1m%" filter
2. Set threshold to `10` (10% price increase)
3. Enable the "5m%" filter
4. Set threshold to `25` (25% price increase)
5. Save settings
6. Navigate to GMGN trend page
7. Tokens meeting BOTH criteria (>= 10% in 1m AND >= 25% in 5m) will be opened

**Note**: Multiple enabled filters use AND logic - tokens must meet ALL enabled thresholds.

### Extension UI

- **Enable Extension Toggle**: Master on/off switch
- **Cooldown Period**: Time before re-opening the same token
- **Filter Rows**: Each row has an enable checkbox and threshold input
- **Disabled Filters**: When checkbox is off, input is disabled (filter ignored)
- **Stats Display**: Shows extension status and tabs opened count

## How It Works

### Token Detection & Filtering

1. Content script detects the current blockchain chain from URL
2. Scans the page for token links and table rows
3. Reads price change values from table cells (1m%, 5m%, 1h%)
4. Applies configured filter thresholds
5. Highlights matching token rows
6. Sends token information to background script

### Tab Opening

1. Checks if the token was recently opened (cooldown period)
2. Verifies if the token tab is already open
3. Opens the token page in a new background tab
4. Records the token and timestamp for tracking

### Filter Logic

Filters use AND logic:
- If only 1m% is enabled: tokens with 1m% >= threshold are opened
- If 1m% AND 5m% are enabled: tokens must have 1m% >= threshold1 AND 5m% >= threshold2
- All enabled filters must be satisfied

## Technical Details

### Architecture

- **Manifest Version:** V3 (latest Chrome Extension standard)
- **Background:** Service Worker (`background.js`)
- **Content:** Content Script (`content.js`)
- **UI:** Popup HTML/CSS/JS (`popup.html`, `popup.js`)
- **Storage:** Chrome Local Storage
- **Permissions:** `tabs`, `storage`, host permissions

### Files Structure

```
gmgn-auto-filter/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for tab management
├── content.js             # Content script for token detection and filtering
├── popup.html             # Settings popup UI
├── popup.js               # Settings popup logic
├── fingerprint.js         # Browser fingerprinting utility
├── icon16.png             # Extension icon (16x16)
├── icon48.png             # Extension icon (48x48)
├── icon128.png            # Extension icon (128x128)
├── DEXSCREENER-REFERENCE.md  # Technical reference from dexscreener
└── README.md              # This file
```

### Permissions

- `tabs`: Open and manage tabs
- `storage`: Save user configuration
- `host_permissions`: Access gmgn.ai domains

## Differences from DexScreener Extension

| Feature | DexScreener | GMGN |
|---------|-------------|------|
| **Filter Configuration** | Uses built-in URL filters | Custom UI configuration |
| **Token Opening** | Opens ALL tokens on page | Opens ONLY matching tokens |
| **Filter Logic** | URL parameters | Extension reads table cells |
| **Highlighting** | Countdown timers | Row brightness |
| **Filter Storage** | Supabase database | Chrome storage only |

## Troubleshooting

### Tabs not opening automatically

- Make sure you're on a GMGN trend/listing page (not a token detail page)
- Check that at least one filter is enabled
- Verify filter thresholds are set correctly
- Check browser console for errors (F12)
- Ensure cooldown period hasn't expired
- Try reloading the page

### Filter not working

- Open popup and verify filters are enabled and saved
- Check that threshold values are entered
- Verify you're on a supported chain page
- Check browser console for errors
- Try disabling and re-enabling filters

### Extension not working

- Disable and re-enable the extension
- Reload the extension from `chrome://extensions/`
- Check the service worker for errors (click "Inspect views: service worker")
- Verify that settings are saved (check popup)
- Ensure you're on gmgn.ai (not dexscreener.com)
- Check browser console for errors

### Performance issues

- The extension uses caching and throttling to optimize performance
- Large tables may take a moment to process
- Adjust cooldown period if opening too many tabs
- Close old tabs to manage browser resources

## Privacy & Security

- Settings are stored locally in browser storage
- No data is sent to external servers
- The extension only interacts with gmgn.ai
- No tracking or analytics
- All tab tracking happens in browser memory

## Development

### Testing

1. Load the extension in developer mode
2. Navigate to gmgn.ai on a supported chain
3. Configure filters in the popup
4. Observe that matching tokens are highlighted
5. Verify that tabs open for matching tokens
6. Check that the same token doesn't open within cooldown period

### Debugging

- Open Chrome DevTools (F12)
- Go to Extensions page (`chrome://extensions/`)
- Click "Inspect views: service worker" for background script logs
- Use browser console for content script logs
- Check popup console by right-clicking popup and selecting "Inspect"

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use and modify as needed.

## Additional Resources

- See `DEXSCREENER-REFERENCE.md` for technical architecture details
- Use the popup settings to configure filters and cooldown
- Check browser console (F12) for detailed logging
- GMGN website: [gmgn.ai](https://gmgn.ai)

