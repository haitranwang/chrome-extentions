# DexScreener Auto Token Opener Chrome Extension

A Chrome extension that automatically opens tabs for tokens detected on DexScreener.com with advanced filtering and multi-chain support.

> **Note**: This extension is part of the [Chrome Extensions Repository](../README.md). For repository structure and organization, see the main README.

## Features

### Multi-Chain Support
- Works with 17 blockchain networks (Solana, BSC, Base, Ethereum, Polygon, and more)
- Automatically detects the current chain from the page URL
- Opens token pages with correct chain-specific URLs

### Auto-Open Token Tabs
- Automatically detects and opens tabs for tokens on any supported chain
- Configurable cooldown period (default: 15 minutes)
- Configurable maximum tabs limit (default: 10)
- Tracks opened tokens to prevent duplicates
- Opens tabs in background for uninterrupted browsing

### Filter URL Detection
- Automatically opens new tabs when you change filter parameters in the URL
- Compare different filter combinations side-by-side
- Duplicate prevention for filter URLs
- Supports all DexScreener filter parameters

## Installation

1. Clone or download the [Chrome Extensions Repository](..) to your local machine
2. Navigate to the `dexscreener-auto-filter/` folder
3. Create the required icon files (see [docs/ICONS-README.md](../docs/ICONS-README.md))
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in the top right)
6. Click "Load unpacked"
7. Select the `dexscreener-auto-filter/` folder (not the parent repository)
8. The extension should now appear in your extensions list

## Usage

### Basic Usage

1. Load the extension in Chrome (see Installation)
2. Configure settings by clicking the extension icon (optional):
   - Set cooldown period (1-60 minutes)
   - Set maximum tabs (1-100)
   - Click "Save"
3. Navigate to [dexscreener.com](https://dexscreener.com) on any supported chain
4. The extension automatically opens new tabs for detected tokens
5. Change filter parameters in the URL to automatically open filtered views

### Configuration Options

**Cooldown Period**: Time before opening the same token again (default: 15 minutes)
**Maximum Tabs**: Total limit on token tabs and filter URL tabs opened (default: 10)

### Supported Chains

The extension supports 17 blockchain networks: Solana, BSC, Base, Ethereum, Polygon, PulseChain, TON, Hyperliquid, Sui, Avalanche, World Chain, Abstract, XRPL, Arbitrum, HyperEVM, NEAR, and Sonic.

## How It Works

### Token Detection
1. Content script detects the current blockchain chain from the URL
2. Scans the page for token links using multiple detection strategies
3. Extracts token IDs from various URL patterns
4. Sends token information to the background script

### Tab Opening
1. Checks if the token was recently opened (cooldown period)
2. Verifies if the token tab is already open
3. Ensures the maximum tabs limit is not exceeded
4. Opens the token page in a new background tab
5. Records the token and timestamp for tracking

### Filter URL Detection
1. Monitors URL changes on dexscreener.com
2. Detects when filter parameters are added or modified
3. Automatically opens a new tab with the filter URL
4. Prevents duplicate filter URLs from opening

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome Extension Manifest V3 standard
- **Background Service Worker**: Manages tab opening with cooldown tracking and settings
- **Content Scripts**: Detects token links and URL changes on dexscreener.com pages
- **Popup UI**: Provides settings interface for configuration
- **Storage**: Saves user settings (cooldown, max tabs)

### Permissions

- `tabs`: Open and manage tabs
- `storage`: Save user configuration
- `host_permissions`: Access dexscreener.com domains

### Files Structure

```
dexscreener-auto-filter/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for tab management and cooldown tracking
├── content.js            # Content script for token and URL detection
├── popup.html            # Settings popup UI
├── popup.js              # Settings popup logic
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
├── generate-icons.js     # Utility to generate icon files
├── icon.svg              # Icon source file
├── filter-url-builder.js # Helper for building filter URLs (optional)
├── FILTER-REFERENCE.md   # DexScreener filter parameters reference
└── README.md             # This file
```

## Development

### Prerequisites

- Google Chrome (latest version)
- Basic knowledge of Chrome Extensions

### Testing

1. Load the extension in developer mode
2. Navigate to dexscreener.com
3. Observe that tokens are detected automatically
4. Verify that tabs open for detected tokens
5. Check that the same token doesn't open within 15 minutes

### Debugging

- Open Chrome DevTools (F12)
- Go to Extensions page (`chrome://extensions/`)
- Click "Inspect views: service worker" for background script logs
- Use browser console for content script logs

## Troubleshooting

### Tabs not opening automatically
- Make sure you're on dexscreener.com with a supported chain
- Check browser console for errors (F12)
- Ensure maximum tabs limit is not reached
- Verify cooldown period hasn't expired
- Try reloading the page

### Extension not working
- Disable and re-enable the extension
- Reload the extension from `chrome://extensions/`
- Check the service worker for errors (click "Inspect views: service worker")
- Verify that settings are saved (check popup)
- Check that you're on a supported chain page

## Privacy & Security

- Settings are stored locally in browser storage
- No data is sent to external servers
- The extension only interacts with dexscreener.com
- No tracking or analytics
- All tab tracking happens in browser memory

## Additional Resources

- See `FILTER-REFERENCE.md` for complete DexScreener filter parameters
- Use the popup settings to configure cooldown and tab limits
- Check browser console (F12) for detailed logging

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use and modify as needed.
