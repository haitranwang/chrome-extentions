# Chrome Extensions Repository

A monorepo for developing and managing multiple Chrome extensions. This repository is organized to support multiple independent Chrome extension projects while maintaining shared documentation and resources.

## 📁 Repository Structure

```
chrome-extensions/
├── README.md                          # This file - repository overview
├── dexscreener-auto-filter/           # DexScreener Chrome Extension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── options.html
│   ├── options.js
│   ├── popup.html
│   ├── popup.js
│   ├── icon.svg
│   ├── generate-icons.js
│   └── README.md                      # Extension-specific documentation
├── docs/                              # Shared documentation
│   ├── ICONS-README.md
│   ├── SETUP.md
│   └── PROJECT-OVERVIEW.md
└── [future-extensions]/               # Additional extensions go here
```

## 🎯 Extensions

### [DexScreener Auto Filter](./dexscreener-auto-filter/)
Automatically reload DexScreener.com with custom filters and open matching token tabs.

- **Features**: Auto-reload with custom filters, auto-open token tabs, 15-minute cooldown
- **Status**: Ready to use
- **Documentation**: See [dexscreener-auto-filter/README.md](./dexscreener-auto-filter/README.md)

## 🚀 Quick Start

### For Each Extension:

1. **Navigate to the extension folder** (e.g., `cd dexscreener-auto-filter`)
2. **Create icon files** if required (see `docs/ICONS-README.md`)
3. **Load the extension** in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder
4. **Configure and use** the extension

### Adding a New Extension:

1. Create a new folder with a descriptive name
2. Add all extension files (manifest.json, scripts, assets, etc.)
3. Create a README.md specific to that extension
4. Update this root README to include the new extension

## 📚 Documentation

- **[Setup Guide](./docs/SETUP.md)** - Quick setup instructions
- **[Icons Guide](./docs/ICONS-README.md)** - How to create extension icons
- **[Project Overview](./docs/PROJECT-OVERVIEW.md)** - Technical project overview

## 🛠️ Development

### Extension Structure Requirements

Each extension should contain:
- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - Service worker (optional)
- `content.js` - Content scripts (optional)
- UI files (popup, options pages, etc.)
- `README.md` - Extension-specific documentation
- Icon files (16x16, 48x48, 128x128 PNG)

### Best Practices

1. **Keep extensions self-contained** - Each extension folder should have all its dependencies
2. **Document thoroughly** - Include a README in each extension folder
3. **Follow Manifest V3** - Use the latest Chrome Extension standards
4. **Test before committing** - Load each extension and verify it works
5. **Update this README** - When adding new extensions

## 🔧 Common Tasks

### Loading an Extension
```bash
# Navigate to Chrome extensions page
chrome://extensions/

# Enable Developer mode
# Click "Load unpacked"
# Select the extension folder
```

### Creating Icons
See [docs/ICONS-README.md](./docs/ICONS-README.md) for detailed instructions on creating extension icons.

### Updating an Extension
1. Make changes to extension files
2. In Chrome extensions page, click the reload icon on the extension card
3. Test the changes

## 📝 File Organization

- **Root level**: Repository-wide files (this README, .gitignore, etc.)
- **Extension folders**: Each extension in its own folder with all its files
- **docs/**: Shared documentation, guides, and resources

## 🎨 Extension Naming Convention

Folders should use kebab-case and be descriptive:
- ✅ `dexscreener-auto-filter/`
- ✅ `youtube-transcript-extractor/`
- ❌ `my-extension/` (too generic)
- ❌ `Extension_Name/` (use kebab-case)

## 🤝 Contributing

1. Create a new branch for your extension
2. Add your extension to its own folder
3. Document the extension in its README
4. Update this root README
5. Test thoroughly before submitting

## 📄 License

MIT License - Extensions in this repository may have their own licenses

## 🔗 Useful Links

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Web Store Publishing](https://developer.chrome.com/docs/webstore/publish/)

---

## 📦 Current Extensions

| Extension | Status | Description |
|-----------|--------|-------------|
| [DexScreener Auto Filter](./dexscreener-auto-filter/) | ✅ Ready | Auto-reload with custom filters and token tab opener |

