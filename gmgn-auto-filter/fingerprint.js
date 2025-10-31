// Browser Fingerprinting Utility for Chrome Extension
// Generates a stable, unique identifier based on browser characteristics

/**
 * Generates a browser fingerprint using stable browser characteristics
 * The fingerprint is consistent for the same user/browser installation
 * @returns {Promise<string>} SHA-256 hash of browser fingerprint
 */
async function generateBrowserFingerprint() {
  // Collect browser characteristics
  const fingerprintData = {
    // User agent info
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages?.join(',') || '',

    // Screen properties
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenColorDepth: screen.colorDepth,
    screenPixelDepth: screen.pixelDepth,

    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),

    // Hardware properties
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: navigator.deviceMemory || 0,

    // Canvas fingerprint (increased uniqueness)
    canvasHash: await getCanvasFingerprint(),

    // WebGL fingerprint
    webglVendor: getWebGLVendor(),
    webglRenderer: getWebGLRenderer(),

    // Font detection (basic)
    fonts: await detectFonts(),

    // Extension-specific constant
    extensionVersion: chrome.runtime.getManifest().version || '1.0.0'
  };

  // Convert to JSON string
  const fingerprintString = JSON.stringify(fingerprintData);

  // Generate hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Generates a canvas fingerprint for increased uniqueness
 * @returns {Promise<string>} Canvas data hash
 */
async function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');

    // Draw some text with various characteristics
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Browser fingerprint 🦄', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Browser fingerprint 🦄', 4, 17);

    // Get canvas data
    const canvasData = canvas.toDataURL();

    // Hash the canvas data
    const encoder = new TextEncoder();
    const data = encoder.encode(canvasData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  } catch (e) {
    console.error('Error generating canvas fingerprint:', e);
    return 'canvas-error';
  }
}

/**
 * Gets WebGL vendor string
 * @returns {string}
 */
function getWebGLVendor() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
  } catch (e) {
    return 'error';
  }
}

/**
 * Gets WebGL renderer string
 * @returns {string}
 */
function getWebGLRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
  } catch (e) {
    return 'error';
  }
}

/**
 * Detects available fonts (basic detection)
 * @returns {Promise<string>} Comma-separated list of detected fonts
 */
async function detectFonts() {
  try {
    const testFonts = [
      'Arial', 'Verdana', 'Courier New', 'Times New Roman', 'Georgia',
      'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
      'Arial Black', 'Impact', 'Monaco', 'Menlo', 'Consolas'
    ];

    const detectedFonts = [];

    // Use Promise.all for concurrent detection
    const fontPromises = testFonts.map(font => detectFont(font));
    const results = await Promise.all(fontPromises);

    results.forEach((detected, index) => {
      if (detected) {
        detectedFonts.push(testFonts[index]);
      }
    });

    return detectedFonts.join(',') || 'none';
  } catch (e) {
    console.error('Error detecting fonts:', e);
    return 'error';
  }
}

/**
 * Detects if a specific font is available
 * @param {string} fontName - Name of font to detect
 * @returns {Promise<boolean>} True if font is available
 */
function detectFont(fontName) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Set a baseline
    context.font = '72px monospace';
    const baselineWidth = context.measureText('mmmmmmmmmmlli').width;

    // Test font
    context.font = `72px "${fontName}", monospace`;
    const testWidth = context.measureText('mmmmmmmmmmlli').width;

    // Font is available if width differs
    resolve(testWidth !== baselineWidth);
  });
}

/**
 * Gets or creates the browser fingerprint
 * Stores it in Chrome local storage for persistence
 * @returns {Promise<string>} Browser fingerprint
 */
async function getBrowserFingerprint() {
  try {
    // Try to get existing fingerprint from storage
    const result = await chrome.storage.local.get(['browserFingerprint']);

    if (result.browserFingerprint) {
      console.log('Using existing browser fingerprint from storage');
      return result.browserFingerprint;
    }

    // Generate new fingerprint
    console.log('Generating new browser fingerprint...');
    const fingerprint = await generateBrowserFingerprint();

    // Store it for future use
    await chrome.storage.local.set({ browserFingerprint: fingerprint });

    console.log('Browser fingerprint generated and stored:', fingerprint);
    return fingerprint;
  } catch (error) {
    console.error('Error getting browser fingerprint:', error);
    // Return a fallback ID based on timestamp
    const fallback = `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return fallback;
  }
}

// Export for use in popup and other contexts
if (typeof window !== 'undefined') {
  window.getBrowserFingerprint = getBrowserFingerprint;
  window.generateBrowserFingerprint = generateBrowserFingerprint;
}

// For Chrome extension context
if (typeof chrome !== 'undefined' && chrome.storage) {
  // Make functions globally available
  globalThis.getBrowserFingerprint = getBrowserFingerprint;
  globalThis.generateBrowserFingerprint = generateBrowserFingerprint;
}

