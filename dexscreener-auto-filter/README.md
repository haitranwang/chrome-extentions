# DexScreener Auto Token Opener Chrome Extension

A streamlined Chrome extension that automatically opens new tabs for tokens detected on DexScreener.com.

> **Note**: This extension is part of the [Chrome Extensions Repository](../README.md). For repository structure and organization, see the main README.

## Features

### Auto-open Token Tabs
- Automatically opens new tabs for all Solana tokens detected on dexscreener.com
- 15-minute cooldown period to prevent spam and duplicate tabs
- Track opened tokens to avoid opening the same token multiple times
- Opens tabs in background for uninterrupted browsing
- Simple, no-configuration extension that just works

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

### Using the Extension

1. Load the extension in Chrome (see Installation)
2. Navigate to [dexscreener.com](https://dexscreener.com)
3. The extension automatically opens new tabs for Solana tokens detected on the page
4. Tabs open in the background - no interruption to your browsing
5. Same token won't open again for 15 minutes (cooldown period)

**Note**: The extension works automatically without any configuration needed.

## How It Works

The extension monitors the dexscreener.com page for Solana token links. When detected:
1. Extracts the token ID from the URL
2. Checks if the token was opened in the last 15 minutes
3. Opens the token page in a new background tab
4. Records the token and timestamp to prevent duplicates

### Features

- **Automatic**: Works without any configuration
- **Smart cooldown**: 15-minute cooldown per token
- **Background tabs**: Doesn't interrupt your browsing
- **No duplicate tabs**: Checks if token is already open

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome Extension Manifest V3 standard
- **Background Service Worker**: Manages tab opening with cooldown tracking
- **Content Scripts**: Detects token links on dexscreener.com pages
- **No Storage**: Operates entirely in memory

### Permissions

- `tabs`: Open and manage tabs
- `host_permissions`: Access dexscreener.com domains

### Files Structure

```
dexscreener-auto-filter/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for tab management and cooldown tracking
├── content.js            # Content script for token detection
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
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
- Make sure you're on dexscreener.com
- Check browser console for errors (F12)
- Ensure you have permissions to open tabs
- Try reloading the page

### Extension not working
- Disable and re-enable the extension
- Reload the extension from `chrome://extensions/`
- Check the service worker for errors
- Verify that the extension is enabled on dexscreener.com

## Privacy & Security

- No data is stored anywhere
- No data is sent to external servers
- The extension only interacts with dexscreener.com
- No tracking or analytics
- Operates entirely in browser memory

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an issue on the GitHub repository.
