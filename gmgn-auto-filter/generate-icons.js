// Node.js script to generate icons for Chrome extension from GMGN logo
// Run with: node generate-icons.js

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const sizes = [16, 48, 128];
const logoPath = path.join(__dirname, 'gmgn-logo.png');

async function generateIcons() {
  try {
    // Load the GMGN logo
    const logo = await loadImage(logoPath);
    console.log(`Loaded logo: ${logo.width}x${logo.height}`);

    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Create dark background with rounded corners
      const radius = size * 0.19;
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fill();

      // Calculate padding to center the logo (leave some padding on all sides)
      const padding = size * 0.1; // 10% padding
      const logoSize = size - (padding * 2);

      // Calculate position to center the logo
      const x = padding;
      const y = padding;

      // Draw the logo, scaled to fit
      ctx.drawImage(logo, x, y, logoSize, logoSize);

      // Save the icon
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(`icon${size}.png`, buffer);
      console.log(`✅ Created icon${size}.png (${size}x${size})`);
    }

    console.log('\n🎉 All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    if (error.code === 'ENOENT') {
      console.error(`   File not found: ${logoPath}`);
      console.error('   Please make sure gmgn-logo.png exists in the same directory.');
    }
    process.exit(1);
  }
}

// Run the async function
generateIcons();

