# Quick Start Guide

This is a quick guide to get the DexScreener Auto Filter extension up and running.

## Prerequisites

- Google Chrome browser
- Icon files (16x16, 48x48, 128x128 PNG format)

## Installation Steps

### Step 1: Create Icon Files

You need three PNG icon files. See [docs/ICONS-README.md](../../docs/ICONS-README.md) for detailed instructions.

**Quick method:**
1. Use the `icon.svg` file in this folder
2. Convert to PNG in three sizes (16, 48, 128 pixels)
3. Save as `icon16.png`, `icon48.png`, `icon128.png` in this folder

### Step 2: Load the Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select **this folder** (`dexscreener-auto-filter/`)
6. Done! The extension is now loaded.

### Step 3: Configure Settings

1. Click the extension icon in Chrome toolbar
2. Click "Open Settings"
3. Configure your filters:
   - Set ranking method
   - Choose minimum liquidity and pair age
   - Select blockchain networks
   - Enable auto-apply and auto-open features
4. Click "Save Settings"

### Step 4: Use on DexScreener

1. Navigate to https://dexscreener.com
2. Filters will auto-apply if enabled
3. Matching tokens will automatically open in new tabs

## Troubleshooting

**Extension won't load?**
- Make sure you created the three icon PNG files
- Select the correct folder (dexscreener-auto-filter/, not parent folder)

**Filters not working?**
- Check you're on dexscreener.com
- Ensure auto-apply is enabled in settings
- Reload the page after saving settings

**Need more help?**
- See the full [README.md](./README.md)
- Check [docs/SETUP.md](../../docs/SETUP.md)
