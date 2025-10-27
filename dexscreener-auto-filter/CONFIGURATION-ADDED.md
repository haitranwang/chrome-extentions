# Configuration Options Added

## Overview
Added configurable settings to control the token tab opening behavior:
1. **Cooldown Period** - Configurable delay before opening the same token again
2. **Maximum Tabs** - Limit on number of token tabs that can be opened

## Files Added

### 1. popup.html
- Modern, clean UI for configuration
- Input fields for cooldown minutes and max tabs
- Settings display and status information
- Reset and Save buttons

### 2. popup.js
- Settings loading from chrome.storage
- Settings saving with validation
- Statistics display
- Reset to defaults functionality

## Files Modified

### 3. manifest.json
**Added:**
- `"storage"` permission
- `"default_popup": "popup.html"` in action

### 4. background.js
**Added:**
- Settings loading on startup
- Settings change listener
- Configurable cooldown period calculation
- Maximum tabs limit enforcement
- Statistics reporting to popup

## Configuration Options

### 1. Cooldown Period
- **Purpose**: Time before opening the same token again
- **Range**: 1-60 minutes
- **Default**: 15 minutes
- **Validation**: Positive integer between 1-60

### 2. Maximum Tabs
- **Purpose**: Limit number of token tabs opened
- **Range**: 1-100 tabs
- **Default**: 10 tabs
- **Validation**: Positive integer between 1-100

## How It Works

1. **User Configuration**:
   - Click extension icon to open popup
   - Set cooldown period (minutes)
   - Set maximum tabs limit
   - Click "Save"
   - Settings stored in chrome.storage

2. **Background Script**:
   - Loads settings on startup
   - Listens for settings changes
   - Applies cooldown period dynamically
   - Enforces maximum tabs limit

3. **Token Opening Logic**:
   ```javascript
   // Check cooldown with configured period
   const cooldownPeriod = settings.cooldownMinutes * 60 * 1000;

   // Check maximum tabs limit
   if (openedTokens.size >= settings.maxTabs) {
     return; // Skip opening
   }
   ```

## Usage

### Setting Up Configuration
1. Load extension in Chrome
2. Click extension icon in toolbar
3. Configure settings in popup
4. Click "Save"

### Default Behavior
- Cooldown: 15 minutes
- Max Tabs: 10
- Starts working immediately

### Resetting
- Click "Reset" button in popup
- Resets to defaults: 15 minutes cooldown, 10 max tabs

## Validation

### Cooldown Period
- Minimum: 1 minute
- Maximum: 60 minutes
- Must be integer

### Maximum Tabs
- Minimum: 1 tab
- Maximum: 100 tabs
- Must be integer

## Statistics Display

The popup shows:
- Extension status (Active/Inactive)
- Number of tabs opened

## Storage

Settings are stored in `chrome.storage.local`:
```javascript
{
  cooldownMinutes: 15,
  maxTabs: 10
}
```

## Testing

1. Load extension
2. Open popup
3. Change settings (e.g., 5 minutes, 20 tabs)
4. Save
5. Navigate to dexscreener.com
6. Verify new settings are applied

## Benefits

✅ **Configurable**: Users can adjust behavior to their needs
✅ **Validation**: Input validation prevents invalid values
✅ **Persistent**: Settings saved across browser sessions
✅ **Responsive**: Settings apply immediately
✅ **User-Friendly**: Simple, clear UI

## Technical Details

### Background Script Changes
- Added `loadSettings()` function
- Added `settings` object for configuration
- Updated `openTokenTab()` to use configurable settings
- Added statistics reporting

### Popup Script Features
- Settings persistence with chrome.storage
- Real-time validation
- Status display
- Statistics from background script

### Error Handling
- Invalid input validation
- Error status messages
- Defaults fallback

