# Quick Setup Guide

## Step 1: Create the Icon Files

The extension requires three icon files. Choose one of these methods:

### Easiest Method:
1. Open any image editor (or online tool like https://www.favicon-generator.org/)
2. Create three PNG files:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
3. Each icon should have a purple gradient background with white "DS" text
4. Colors: Gradient from #667eea to #764ba2, white text

**Quick Icon Design:**
- Background: Linear gradient purple (#667eea → #764ba2)
- Text: Bold white "DS" letters, centered
- Style: Modern, clean, professional

See `ICONS-README.md` for more options.

## Step 2: Load the Extension

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the folder containing these files
6. The extension will appear in your Chrome toolbar

## Step 3: Configure Settings

1. Click the extension icon in your toolbar
2. Click "Open Settings"
3. Configure your filters:
   - Choose ranking method (Trending Score, Volume, etc.)
   - Set minimum liquidity and pair age
   - Select blockchain networks to monitor
   - Enable/disable auto-apply and auto-open features
4. Click "Save Settings"

## Step 4: Use the Extension

1. Navigate to [dexscreener.com](https://dexscreener.com)
2. If auto-apply is enabled, filters will be applied automatically
3. The extension will:
   - Apply your configured filters
   - Sort results by price change if configured
   - Automatically open matching token tabs (with 15-min cooldown)

## Troubleshooting

### Extension won't load
- Make sure all required files are present
- Create the icon files (see Step 1)
- Check for any errors in `chrome://extensions/`

### Filters not applying
- Make sure you're on dexscreener.com
- Check that auto-apply is enabled in settings
- Reload the page after saving settings

### Tabs not opening
- Verify that auto-open is enabled in settings
- Check browser console for errors (F12)
- Make sure you have permission to open tabs

## Files Included

- `manifest.json` - Extension configuration (Manifest V3)
- `background.js` - Network monitoring and tab management
- `content.js` - DOM manipulation and filter application
- `options.html/js` - Settings page
- `popup.html/js` - Extension popup
- `README.md` - Full documentation
- `icon.svg` - Source icon file

## Need Help?

Check the main `README.md` file for detailed documentation on:
- All features and capabilities
- Configuration options
- Technical architecture
- Development guide

