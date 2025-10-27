// Popup script for settings

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();

  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
});

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['cooldownMinutes', 'maxTabs'], (data) => {
    if (data.cooldownMinutes) {
      document.getElementById('cooldownMinutes').value = data.cooldownMinutes;
    }
    if (data.maxTabs) {
      document.getElementById('maxTabs').value = data.maxTabs;
    }
  });
}

// Save settings
function saveSettings(e) {
  e.preventDefault();

  const cooldownMinutes = parseInt(document.getElementById('cooldownMinutes').value);
  const maxTabs = parseInt(document.getElementById('maxTabs').value);

  // Validate inputs
  if (isNaN(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 60) {
    showStatus('Invalid cooldown period (1-60 minutes)', 'error');
    return;
  }

  if (isNaN(maxTabs) || maxTabs < 1 || maxTabs > 100) {
    showStatus('Invalid maximum tabs (1-100)', 'error');
    return;
  }

  // Save to storage
  chrome.storage.local.set({
    cooldownMinutes: cooldownMinutes,
    maxTabs: maxTabs
  }, () => {
    showStatus('Settings saved!', 'success');
    loadStats();
  });
}

// Reset settings to defaults
function resetSettings() {
  if (confirm('Reset to default settings?')) {
    document.getElementById('cooldownMinutes').value = 15;
    document.getElementById('maxTabs').value = 10;
    const cooldownMinutes = 15;
    const maxTabs = 10;

    chrome.storage.local.set({
      cooldownMinutes: cooldownMinutes,
      maxTabs: maxTabs
    }, () => {
      showStatus('Settings reset to defaults!', 'success');
      loadStats();
    });
  }
}

// Load and display statistics
function loadStats() {
  // Check if extension is active on dexscreener.com
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const statusEl = document.getElementById('extensionStatus');

    if (currentTab.url?.includes('dexscreener.com')) {
      statusEl.textContent = 'Active on DexScreener';
      statusEl.style.color = '#4caf50';
    } else {
      statusEl.textContent = 'Inactive - Navigate to DexScreener';
      statusEl.style.color = '#666';
    }
  });

  // Get tab count (send message to background)
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (response && response.tabCount !== undefined) {
      document.getElementById('tabsCount').textContent = response.tabCount;
    }
  });
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    status.className = 'status';
    status.textContent = '';
  }, 3000);
}

