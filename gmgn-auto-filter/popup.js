// Popup script for GMGN Auto Filter settings

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');

  loadSettings();
  loadStats();

  // Setup event listeners
  const settingsForm = document.getElementById('settingsForm');
  const resetBtn = document.getElementById('resetBtn');
  const extensionEnabled = document.getElementById('extensionEnabled');

  if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
  if (resetBtn) resetBtn.addEventListener('click', resetSettings);
  if (extensionEnabled) extensionEnabled.addEventListener('change', handleExtensionToggle);

  // Filter checkbox change handlers - enable/disable input fields
  setupFilterCheckboxes();

  console.log('All event listeners attached');
});

// Setup filter checkbox handlers
function setupFilterCheckboxes() {
  const filterMappings = [
    { checkboxId: 'filterOneMinEnabled', inputId: 'filterOneMinThreshold', rowId: 'filterRowOneMin' },
    { checkboxId: 'filterFiveMinEnabled', inputId: 'filterFiveMinThreshold', rowId: 'filterRowFiveMin' },
    { checkboxId: 'filterOneHourEnabled', inputId: 'filterOneHourThreshold', rowId: 'filterRowOneHour' }
  ];

  filterMappings.forEach(({ checkboxId, inputId, rowId }) => {
    const checkbox = document.getElementById(checkboxId);
    const input = document.getElementById(inputId);
    const row = document.getElementById(rowId);

    if (checkbox && input && row) {
      checkbox.addEventListener('change', (e) => {
        input.disabled = !e.target.checked;
        if (e.target.checked) {
          row.classList.remove('disabled');
        } else {
          row.classList.add('disabled');
        }
      });
    }
  });
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['cooldownMinutes', 'extensionEnabled', 'filterConfig'], (data) => {
    if (data.cooldownMinutes) {
      document.getElementById('cooldownMinutes').value = data.cooldownMinutes;
    }
    document.getElementById('extensionEnabled').checked = data.extensionEnabled !== false;

    // Load filter configuration
    if (data.filterConfig) {
      const config = data.filterConfig;

      // 1m% filter
      const oneMinEnabled = document.getElementById('filterOneMinEnabled');
      const oneMinThreshold = document.getElementById('filterOneMinThreshold');
      const oneMinRow = document.getElementById('filterRowOneMin');
      if (oneMinEnabled && oneMinThreshold && oneMinRow) {
        oneMinEnabled.checked = config.oneMin.enabled;
        oneMinThreshold.value = config.oneMin.threshold;
        oneMinThreshold.disabled = !config.oneMin.enabled;
        oneMinRow.classList.toggle('disabled', !config.oneMin.enabled);
      }

      // 5m% filter
      const fiveMinEnabled = document.getElementById('filterFiveMinEnabled');
      const fiveMinThreshold = document.getElementById('filterFiveMinThreshold');
      const fiveMinRow = document.getElementById('filterRowFiveMin');
      if (fiveMinEnabled && fiveMinThreshold && fiveMinRow) {
        fiveMinEnabled.checked = config.fiveMin.enabled;
        fiveMinThreshold.value = config.fiveMin.threshold;
        fiveMinThreshold.disabled = !config.fiveMin.enabled;
        fiveMinRow.classList.toggle('disabled', !config.fiveMin.enabled);
      }

      // 1h% filter
      const oneHourEnabled = document.getElementById('filterOneHourEnabled');
      const oneHourThreshold = document.getElementById('filterOneHourThreshold');
      const oneHourRow = document.getElementById('filterRowOneHour');
      if (oneHourEnabled && oneHourThreshold && oneHourRow) {
        oneHourEnabled.checked = config.oneHour.enabled;
        oneHourThreshold.value = config.oneHour.threshold;
        oneHourThreshold.disabled = !config.oneHour.enabled;
        oneHourRow.classList.toggle('disabled', !config.oneHour.enabled);
      }
    }
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

  if (isNaN(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 60) {
    showStatus('Invalid cooldown period (1-60 minutes)', 'error');
    return;
  }

  // Get filter configuration
  const filterConfig = {
    oneMin: {
      enabled: document.getElementById('filterOneMinEnabled').checked,
      threshold: parseFloat(document.getElementById('filterOneMinThreshold').value) || 0
    },
    fiveMin: {
      enabled: document.getElementById('filterFiveMinEnabled').checked,
      threshold: parseFloat(document.getElementById('filterFiveMinThreshold').value) || 0
    },
    oneHour: {
      enabled: document.getElementById('filterOneHourEnabled').checked,
      threshold: parseFloat(document.getElementById('filterOneHourThreshold').value) || 0
    }
  };

  // Validate filter thresholds
  const hasEnabledFilter = filterConfig.oneMin.enabled || filterConfig.fiveMin.enabled || filterConfig.oneHour.enabled;
  if (hasEnabledFilter) {
    // Check if all enabled filters have valid thresholds
    if ((filterConfig.oneMin.enabled && isNaN(filterConfig.oneMin.threshold)) ||
        (filterConfig.fiveMin.enabled && isNaN(filterConfig.fiveMin.threshold)) ||
        (filterConfig.oneHour.enabled && isNaN(filterConfig.oneHour.threshold))) {
      showStatus('Please enter valid threshold values for enabled filters', 'error');
      return;
    }
  }

  chrome.storage.local.set({
    cooldownMinutes: cooldownMinutes,
    filterConfig: filterConfig
  }, () => {
    showStatus('Settings saved!', 'success');
    loadStats();
  });
}

// Reset settings to defaults
function resetSettings() {
  if (confirm('Reset to default settings?')) {
    document.getElementById('cooldownMinutes').value = 15;

    // Reset filter configuration
    const defaultConfig = {
      oneMin: { enabled: false, threshold: 0 },
      fiveMin: { enabled: false, threshold: 0 },
      oneHour: { enabled: false, threshold: 0 }
    };

    // Reset UI
    document.getElementById('filterOneMinEnabled').checked = false;
    document.getElementById('filterOneMinThreshold').value = '';
    document.getElementById('filterOneMinThreshold').disabled = true;
    document.getElementById('filterRowOneMin').classList.add('disabled');

    document.getElementById('filterFiveMinEnabled').checked = false;
    document.getElementById('filterFiveMinThreshold').value = '';
    document.getElementById('filterFiveMinThreshold').disabled = true;
    document.getElementById('filterRowFiveMin').classList.add('disabled');

    document.getElementById('filterOneHourEnabled').checked = false;
    document.getElementById('filterOneHourThreshold').value = '';
    document.getElementById('filterOneHourThreshold').disabled = true;
    document.getElementById('filterRowOneHour').classList.add('disabled');

    chrome.storage.local.set({
      cooldownMinutes: 15,
      filterConfig: defaultConfig
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
      const isOnGMGN = currentTab.url?.includes('gmgn.ai');

      if (!enabled) {
        statusEl.textContent = 'Extension Disabled';
        statusEl.style.color = '#999';
      } else if (isOnGMGN) {
        statusEl.textContent = 'Active on GMGN';
        statusEl.style.color = '#4caf50';
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

