# GMGN Auto Filter Chrome Extension

A Chrome extension for GMGN.ai that automatically opens tabs for top-ranked tokens with configurable cooldown management and multi-chain support (Solana and BSC).

> **Note**: This extension is part of the [Chrome Extensions Repository](../README.md). For repository structure and organization, see the main README.

## Features

### Auto-Open Top-Ranked Tokens
- Automatically detects tokens on GMGN filter pages
- Opens token tabs in sequence (top-ranked → down)
- Configurable cooldown period (default: 15 minutes)
- Configurable maximum tabs limit (default: 10)
- Tracks opened tokens to prevent duplicates
- Opens tabs in background for uninterrupted browsing

### Multi-Chain Support
- **Solana**: Works on `https://gmgn.ai/?chain=sol`
- **Binance Smart Chain (BSC)**: Works on `https://gmgn.ai/?chain=bsc`
- Automatically detects the current chain from the URL
- Opens token pages with correct chain-specific URLs

### Cooldown Management
- Prevents opening the same token multiple times within cooldown period
- Visual countdown timer displayed next to token name
- Cooldown persists even if tab is closed
- Configurable cooldown period (1-60 minutes)

### Tab Management
- Tracks all open token tabs
- Respects maximum tab limit
- Prevents duplicate token tabs
- Automatically cleans up expired cooldown records

## Installation

1. Clone or download the [Chrome Extensions Repository](..) to your local machine
2. Navigate to the `gmgn-auto-filter/` folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in the top right)
5. Click "Load unpacked"
6. Select the `gmgn-auto-filter/` folder (not the parent repository)
7. The extension should now appear in your extensions list

## Usage

### Basic Usage

1. Load the extension in Chrome (see Installation)
2. Configure settings by clicking the extension icon (optional):
   - Toggle extension on/off
   - Set cooldown period (1-60 minutes)
   - Set maximum tabs (1-100)
   - Click "Save"
3. Navigate to [gmgn.ai](https://gmgn.ai) on Solana or BSC
4. Add filter parameters if desired (the extension will detect tokens automatically)
5. The extension automatically opens new tabs for detected tokens

### Configuration Options

**Extension Enable/Disable**: Global on/off toggle (default: enabled)

**Cooldown Period**: Time before opening the same token again (default: 15 minutes)

**Maximum Tabs**: Total limit on token tabs opened (default: 10)

## Supported Chains

### Solana
- Filter page: `https://gmgn.ai/?chain=sol`
- Token page format: `https://gmgn.ai/sol/token/{ADDRESS}`

### Binance Smart Chain (BSC)
- Filter page: `https://gmgn.ai/?chain=bsc`
- Token page format: `https://gmgn.ai/bsc/token/{ADDRESS}`

## How It Works

### Token Detection
1. Content script detects the current blockchain chain from the URL
2. Scans the filter page for token links
3. Extracts token IDs from GMGN's URL patterns
4. Sends token information to the background script

### Tab Opening
1. Checks if the token was recently opened (cooldown period)
2. Verifies if the token tab is already open
3. Ensures the maximum tabs limit is not exceeded
4. Opens the token page in a new background tab
5. Records the token and timestamp for tracking

### Cooldown Timer Display
1. Countdown timer appears next to token name on filter pages
2. Updates every second
3. Shows remaining cooldown time
4. Changes color based on remaining time (green → blue → yellow → orange)
5. Removes timer when cooldown expires

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome Extension Manifest V3 standard
- **Background Service Worker**: Manages tab opening with cooldown tracking and settings
- **Content Scripts**: Detects token links on gmgn.ai pages
- **Popup UI**: Provides settings interface for configuration
- **Storage**: Saves user settings (cooldown, max tabs) locally

### Permissions

- `tabs`: Open and manage tabs
- `storage`: Save user configuration
- `host_permissions`: Access gmgn.ai domain

### Files Structure

```
gmgn-auto-filter/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for tab management and cooldown tracking
├── content.js            # Content script for token detection
├── popup.html            # Settings popup UI
├── popup.js              # Settings popup logic
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
├── gmgn-logo.png         # GMGN logo (source file)
├── generate-icons.js     # Utility to generate icon files
├── package.json          # Node.js dependencies
├── DOCUMENTATION.md      # Developer documentation
└── README.md             # This file
```

## Development

### Prerequisites

- Google Chrome (latest version)
- Node.js (for generating icons)
- Basic knowledge of Chrome Extensions

### Generating Icons

To regenerate the extension icons:

```bash
cd gmgn-auto-filter
npm install
node generate-icons.js
```

### Testing

1. Load the extension in developer mode
2. Navigate to gmgn.ai (Solana or BSC filter page)
3. Observe that tokens are detected automatically
4. Verify that tabs open for detected tokens
5. Check that countdown timers appear
6. Verify that the same token doesn't open within the cooldown period

### Debugging

- Open Chrome DevTools (F12)
- Go to Extensions page (`chrome://extensions/`)
- Click "Inspect views: service worker" for background script logs
- Use browser console for content script logs

## Troubleshooting

### Tabs not opening automatically

- Make sure you're on gmgn.ai with a supported chain (Solana or BSC)
- Check that the extension is enabled (click extension icon)
- Verify you're on a filter page (has `?chain=sol` or `?chain=bsc` in URL)
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

### Countdown timers not appearing

- Make sure you're on a filter page (not a token detail page)
- Check that tokens have been opened
- Verify the extension is enabled
- Check browser console for errors

## Differences from DexScreener Extension

Unlike the `dexscreener-auto-filter` extension, this GMGN extension:

- **No Filter URL Management**: GMGN doesn't update filters in URLs like DexScreener does
- **Simpler Architecture**: Focuses solely on opening tokens from rankings
- **Direct Token Opening**: Opens tokens in sequence from top-ranked to bottom
- **Top-to-Bottom Sequence**: Designed for sequential token opening

## Privacy & Security

- Settings are stored locally in browser storage
- No data is sent to external servers
- The extension only interacts with gmgn.ai
- No tracking or analytics
- All tab tracking happens in browser memory
- No external API calls or data transmission

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use and modify as needed.

