# How to Create Extension Icons

The Chrome extension requires three icon sizes: 16x16, 48x48, and 128x128 pixels.

## Option 1: Using Online Tool (Easiest)

1. Open https://realfavicongenerator.net/ or https://www.favicon-generator.org/
2. Upload the provided `icon.svg` file
3. Download the generated PNG files in the required sizes
4. Save them as `icon16.png`, `icon48.png`, and `icon128.png` in the extension folder

## Option 2: Using Node.js (If you have Node installed)

1. Install the canvas package: `npm install canvas`
2. Run: `node generate-icons.js`
3. The script will generate all three icon sizes

## Option 3: Manual Creation

Create simple icons with purple gradient background and white "DS" text:
- **Colors**: Gradient from #667eea to #764ba2
- **Text**: "DS" in white, centered
- **Background**: Purple gradient
- **Format**: PNG with transparency support

You can use any image editor (Photoshop, GIMP, Figma, etc.) to create these.

## Option 4: Use Placeholder Icons

For testing purposes, you can use the `icon.svg` file directly, but Chrome Extensions typically require PNG format for icons.

## Quick Solution

If you just want to test the extension:
1. Create simple 16x16, 48x48, and 128x128 PNG images with a purple background and "DS" text
2. Or use any PNG images temporarily (they don't affect functionality)

The extension will work without icons, but Chrome will show a default icon instead.

