// Popup script for GMGN Auto Filter settings

document.addEventListener('DOMContentLoaded', () => {
  console.log('GMGN Auto Filter: Popup DOM loaded');

  loadSettings();
  loadStats();

  // Setup event listeners
  const settingsForm = document.getElementById('settingsForm');
  const resetBtn = document.getElementById('resetBtn');
  const extensionEnabled = document.getElementById('extensionEnabled');

  if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
  if (resetBtn) resetBtn.addEventListener('click', resetSettings);
  if (extensionEnabled) extensionEnabled.addEventListener('change', handleExtensionToggle);

  console.log('GMGN Auto Filter: All event listeners attached');
});

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['cooldownMinutes', 'maxTabs', 'extensionEnabled'], (data) => {
    if (data.cooldownMinutes) {
      document.getElementById('cooldownMinutes').value = data.cooldownMinutes;
    }
    if (data.maxTabs) {
      document.getElementById('maxTabs').value = data.maxTabs;
    }
    document.getElementById('extensionEnabled').checked = data.extensionEnabled !== false;
  });
}

// Handle extension toggle
function handleExtensionToggle() {
  const enabled = document.getElementById('extensionEnabled').checked;

  chrome.storage.local.set({ extensionEnabled: enabled }, () => {
    showStatus(enabled ? 'Extension enabled!' : 'Extension disabled!', 'success');
    loadStats();
  });
}

// Save settings
function saveSettings(e) {
  e.preventDefault();

  const cooldownMinutes = parseInt(document.getElementById('cooldownMinutes').value);
  const maxTabs = parseInt(document.getElementById('maxTabs').value);

  if (isNaN(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 60) {
    showStatus('Invalid cooldown period (1-60 minutes)', 'error');
    return;
  }

  if (isNaN(maxTabs) || maxTabs < 1 || maxTabs > 100) {
    showStatus('Invalid maximum tabs (1-100)', 'error');
    return;
  }

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
  chrome.storage.local.get(['extensionEnabled'], (data) => {
    const enabled = data.extensionEnabled !== false;
    const statusEl = document.getElementById('extensionStatus');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const isOnGmgn = currentTab.url?.includes('gmgn.ai');

      if (!enabled) {
        statusEl.textContent = 'Extension Disabled';
        statusEl.style.color = '#999';
      } else if (isOnGmgn) {
        statusEl.textContent = 'Active on GMGN';
        statusEl.style.color = '#10b981';
      } else {
        statusEl.textContent = 'Inactive - Navigate to GMGN';
        statusEl.style.color = '#666';
      }
    });

    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
      if (response && response.tabCount !== undefined) {
        document.getElementById('tabsCount').textContent = response.tabCount;
      }
    });
  });
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;

    setTimeout(() => {
      status.className = 'status';
      status.textContent = '';
    }, 3000);
  }
}

