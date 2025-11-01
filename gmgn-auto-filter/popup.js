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
    { checkboxId: 'filterOneMinEnabled', inputIds: ['filterOneMinThresholdLess', 'filterOneMinThresholdGreater'], rowId: 'filterRowOneMin' },
    { checkboxId: 'filterFiveMinEnabled', inputIds: ['filterFiveMinThresholdLess', 'filterFiveMinThresholdGreater'], rowId: 'filterRowFiveMin' },
    { checkboxId: 'filterOneHourEnabled', inputIds: ['filterOneHourThresholdLess', 'filterOneHourThresholdGreater'], rowId: 'filterRowOneHour' }
  ];

  filterMappings.forEach(({ checkboxId, inputIds, rowId }) => {
    const checkbox = document.getElementById(checkboxId);
    const row = document.getElementById(rowId);

    if (checkbox && row) {
      checkbox.addEventListener('change', (e) => {
        inputIds.forEach(inputId => {
          const input = document.getElementById(inputId);
          if (input) {
            input.disabled = !e.target.checked;
          }
        });
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
      const oneMinThresholdLess = document.getElementById('filterOneMinThresholdLess');
      const oneMinThresholdGreater = document.getElementById('filterOneMinThresholdGreater');
      const oneMinRow = document.getElementById('filterRowOneMin');
      if (oneMinEnabled && oneMinThresholdLess && oneMinThresholdGreater && oneMinRow) {
        oneMinEnabled.checked = config.oneMin.enabled;
        oneMinThresholdLess.value = config.oneMin.thresholdLess || '';
        oneMinThresholdGreater.value = config.oneMin.thresholdGreater || '';
        oneMinThresholdLess.disabled = !config.oneMin.enabled;
        oneMinThresholdGreater.disabled = !config.oneMin.enabled;
        oneMinRow.classList.toggle('disabled', !config.oneMin.enabled);
      }

      // 5m% filter
      const fiveMinEnabled = document.getElementById('filterFiveMinEnabled');
      const fiveMinThresholdLess = document.getElementById('filterFiveMinThresholdLess');
      const fiveMinThresholdGreater = document.getElementById('filterFiveMinThresholdGreater');
      const fiveMinRow = document.getElementById('filterRowFiveMin');
      if (fiveMinEnabled && fiveMinThresholdLess && fiveMinThresholdGreater && fiveMinRow) {
        fiveMinEnabled.checked = config.fiveMin.enabled;
        fiveMinThresholdLess.value = config.fiveMin.thresholdLess || '';
        fiveMinThresholdGreater.value = config.fiveMin.thresholdGreater || '';
        fiveMinThresholdLess.disabled = !config.fiveMin.enabled;
        fiveMinThresholdGreater.disabled = !config.fiveMin.enabled;
        fiveMinRow.classList.toggle('disabled', !config.fiveMin.enabled);
      }

      // 1h% filter
      const oneHourEnabled = document.getElementById('filterOneHourEnabled');
      const oneHourThresholdLess = document.getElementById('filterOneHourThresholdLess');
      const oneHourThresholdGreater = document.getElementById('filterOneHourThresholdGreater');
      const oneHourRow = document.getElementById('filterRowOneHour');
      if (oneHourEnabled && oneHourThresholdLess && oneHourThresholdGreater && oneHourRow) {
        oneHourEnabled.checked = config.oneHour.enabled;
        oneHourThresholdLess.value = config.oneHour.thresholdLess || '';
        oneHourThresholdGreater.value = config.oneHour.thresholdGreater || '';
        oneHourThresholdLess.disabled = !config.oneHour.enabled;
        oneHourThresholdGreater.disabled = !config.oneHour.enabled;
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
      thresholdLess: document.getElementById('filterOneMinThresholdLess').value ? parseFloat(document.getElementById('filterOneMinThresholdLess').value) : null,
      thresholdGreater: document.getElementById('filterOneMinThresholdGreater').value ? parseFloat(document.getElementById('filterOneMinThresholdGreater').value) : null
    },
    fiveMin: {
      enabled: document.getElementById('filterFiveMinEnabled').checked,
      thresholdLess: document.getElementById('filterFiveMinThresholdLess').value ? parseFloat(document.getElementById('filterFiveMinThresholdLess').value) : null,
      thresholdGreater: document.getElementById('filterFiveMinThresholdGreater').value ? parseFloat(document.getElementById('filterFiveMinThresholdGreater').value) : null
    },
    oneHour: {
      enabled: document.getElementById('filterOneHourEnabled').checked,
      thresholdLess: document.getElementById('filterOneHourThresholdLess').value ? parseFloat(document.getElementById('filterOneHourThresholdLess').value) : null,
      thresholdGreater: document.getElementById('filterOneHourThresholdGreater').value ? parseFloat(document.getElementById('filterOneHourThresholdGreater').value) : null
    }
  };

  // Validate filter thresholds
  const hasEnabledFilter = filterConfig.oneMin.enabled || filterConfig.fiveMin.enabled || filterConfig.oneHour.enabled;
  if (hasEnabledFilter) {
    // Check if all enabled filters have at least one threshold and they are valid
    const oneMinInvalid = filterConfig.oneMin.enabled &&
                          filterConfig.oneMin.thresholdLess === null &&
                          filterConfig.oneMin.thresholdGreater === null;
    const fiveMinInvalid = filterConfig.fiveMin.enabled &&
                          filterConfig.fiveMin.thresholdLess === null &&
                          filterConfig.fiveMin.thresholdGreater === null;
    const oneHourInvalid = filterConfig.oneHour.enabled &&
                          filterConfig.oneHour.thresholdLess === null &&
                          filterConfig.oneHour.thresholdGreater === null;

    if (oneMinInvalid || fiveMinInvalid || oneHourInvalid) {
      showStatus('Please enter at least one threshold value for enabled filters', 'error');
      return;
    }

    // Validate that values are valid numbers if provided
    const oneMinHasNaN = filterConfig.oneMin.enabled &&
                        ((filterConfig.oneMin.thresholdLess !== null && isNaN(filterConfig.oneMin.thresholdLess)) ||
                         (filterConfig.oneMin.thresholdGreater !== null && isNaN(filterConfig.oneMin.thresholdGreater)));
    const fiveMinHasNaN = filterConfig.fiveMin.enabled &&
                         ((filterConfig.fiveMin.thresholdLess !== null && isNaN(filterConfig.fiveMin.thresholdLess)) ||
                          (filterConfig.fiveMin.thresholdGreater !== null && isNaN(filterConfig.fiveMin.thresholdGreater)));
    const oneHourHasNaN = filterConfig.oneHour.enabled &&
                         ((filterConfig.oneHour.thresholdLess !== null && isNaN(filterConfig.oneHour.thresholdLess)) ||
                          (filterConfig.oneHour.thresholdGreater !== null && isNaN(filterConfig.oneHour.thresholdGreater)));

    if (oneMinHasNaN || fiveMinHasNaN || oneHourHasNaN) {
      showStatus('Please enter valid numeric values for thresholds', 'error');
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
      oneMin: { enabled: false, thresholdLess: null, thresholdGreater: null },
      fiveMin: { enabled: false, thresholdLess: null, thresholdGreater: null },
      oneHour: { enabled: false, thresholdLess: null, thresholdGreater: null }
    };

    // Reset UI - 1m%
    document.getElementById('filterOneMinEnabled').checked = false;
    document.getElementById('filterOneMinThresholdLess').value = '';
    document.getElementById('filterOneMinThresholdGreater').value = '';
    document.getElementById('filterOneMinThresholdLess').disabled = true;
    document.getElementById('filterOneMinThresholdGreater').disabled = true;
    document.getElementById('filterRowOneMin').classList.add('disabled');

    // Reset UI - 5m%
    document.getElementById('filterFiveMinEnabled').checked = false;
    document.getElementById('filterFiveMinThresholdLess').value = '';
    document.getElementById('filterFiveMinThresholdGreater').value = '';
    document.getElementById('filterFiveMinThresholdLess').disabled = true;
    document.getElementById('filterFiveMinThresholdGreater').disabled = true;
    document.getElementById('filterRowFiveMin').classList.add('disabled');

    // Reset UI - 1h%
    document.getElementById('filterOneHourEnabled').checked = false;
    document.getElementById('filterOneHourThresholdLess').value = '';
    document.getElementById('filterOneHourThresholdGreater').value = '';
    document.getElementById('filterOneHourThresholdLess').disabled = true;
    document.getElementById('filterOneHourThresholdGreater').disabled = true;
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

