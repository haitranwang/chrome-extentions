# Repository Structure

This document shows the current structure of the Chrome Extensions repository.

## Directory Tree

```
chrome-extensions/
│
├── README.md                          # Main repository README
├── .gitignore                         # Git ignore patterns
├── STRUCTURE.md                       # This file
│
├── dexscreener-auto-filter/           # 🎯 DexScreener Extension
│   ├── manifest.json                  # Extension manifest (V3)
│   ├── background.js                  # Service worker
│   ├── content.js                     # Content script
│   ├── options.html                   # Options page UI
│   ├── options.js                     # Options page logic
│   ├── popup.html                     # Popup UI
│   ├── popup.js                       # Popup logic
│   ├── icon.svg                       # Icon source file
│   ├── generate-icons.js              # Icon generator script
│   └── README.md                      # Extension documentation
│
└── docs/                              # 📚 Shared Documentation
    ├── ICONS-README.md                # Icon creation guide
    ├── SETUP.md                       # Quick setup guide
    └── PROJECT-OVERVIEW.md            # Technical overview
```

## How to Use This Repository

### Loading the DexScreener Extension

1. Navigate to `dexscreener-auto-filter/` folder
2. Create icon files (see `docs/ICONS-README.md`)
3. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dexscreener-auto-filter/` folder

### Adding a New Extension

1. Create a new folder in the root (e.g., `my-new-extension/`)
2. Add all extension files to that folder
3. Create a `README.md` in the extension folder
4. Update the main `README.md` to list the new extension

## File References

All file paths within the extensions are relative to their own folder. The manifest.json files reference assets within the same directory, so no path updates are needed after moving files into subdirectories.

## Notes

- Each extension is self-contained
- Shared documentation is in `docs/`
- Extension-specific documentation is in each extension's folder
- Icons can be generated using `generate-icons.js` in the extension folder

