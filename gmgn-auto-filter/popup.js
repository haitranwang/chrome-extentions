// Popup script for GMGN Auto Filter settings

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');

  loadSettings();
  loadStats();

  // Setup event listeners
  const settingsForm = document.getElementById('settingsForm');
  const resetBtn = document.getElementById('resetBtn');
  const extensionEnabled = document.getElementById('extensionEnabled');
  const soundEnabled = document.getElementById('soundEnabled');

  if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
  if (resetBtn) resetBtn.addEventListener('click', resetSettings);
  if (extensionEnabled) extensionEnabled.addEventListener('change', handleExtensionToggle);
  if (soundEnabled) soundEnabled.addEventListener('change', handleSoundToggle);

  // Filter checkbox change handlers - enable/disable input fields
  setupFilterCheckboxes();

  // Setup mutually exclusive filter input logic
  setupMutuallyExclusiveFilters();

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
        const lessInput = document.getElementById(inputIds[0]);
        const greaterInput = document.getElementById(inputIds[1]);

        if (e.target.checked) {
          row.classList.remove('disabled');
          // Enable inputs but apply mutual exclusivity
          lessInput.disabled = false;
          greaterInput.disabled = false;
          applyMutualExclusivity(inputIds[0], inputIds[1]);
        } else {
          row.classList.add('disabled');
          // Disable both inputs but preserve values
          lessInput.disabled = true;
          greaterInput.disabled = true;
        }
      });
    }
  });
}

// Setup mutually exclusive filter inputs
// When one field has a value, disable the other field
function setupMutuallyExclusiveFilters() {
  const filterPairs = [
    { lessId: 'filterOneMinThresholdLess', greaterId: 'filterOneMinThresholdGreater' },
    { lessId: 'filterFiveMinThresholdLess', greaterId: 'filterFiveMinThresholdGreater' },
    { lessId: 'filterOneHourThresholdLess', greaterId: 'filterOneHourThresholdGreater' }
  ];

  filterPairs.forEach(({ lessId, greaterId }) => {
    const lessInput = document.getElementById(lessId);
    const greaterInput = document.getElementById(greaterId);

    if (lessInput && greaterInput) {
      // When "Less than" field changes
      lessInput.addEventListener('input', () => {
        applyMutualExclusivity(lessId, greaterId);
      });

      // When "Greater than" field changes
      greaterInput.addEventListener('input', () => {
        applyMutualExclusivity(lessId, greaterId);
      });

      // Also check on load
      applyMutualExclusivity(lessId, greaterId);
    }
  });
}

// Apply mutual exclusivity between two filter inputs
function applyMutualExclusivity(lessId, greaterId) {
  const lessInput = document.getElementById(lessId);
  const greaterInput = document.getElementById(greaterId);

  if (!lessInput || !greaterInput) return;

  // Find the checkbox for this filter row to check if filter is enabled
  const rowId = lessInput.closest('.filter-row')?.id;
  if (!rowId) return;

  const checkboxMap = {
    'filterRowOneMin': 'filterOneMinEnabled',
    'filterRowFiveMin': 'filterFiveMinEnabled',
    'filterRowOneHour': 'filterOneHourEnabled'
  };
  const checkboxId = checkboxMap[rowId];
  if (!checkboxId) return;

  const checkbox = document.getElementById(checkboxId);
  if (!checkbox || !checkbox.checked) {
    // Filter is disabled, both inputs should be disabled
    lessInput.disabled = true;
    greaterInput.disabled = true;
    return;
  }

  const lessValue = lessInput.value.trim();
  const greaterValue = greaterInput.value.trim();

  // If "Less than" has a value, disable and clear "Greater than"
  if (lessValue !== '') {
    lessInput.disabled = false;
    greaterInput.disabled = true;
    if (greaterValue !== '') {
      greaterInput.value = ''; // Clear the value
    }
  }
  // If "Greater than" has a value, disable and clear "Less than"
  else if (greaterValue !== '') {
    greaterInput.disabled = false;
    lessInput.disabled = true;
    if (lessValue !== '') {
      lessInput.value = ''; // Clear the value
    }
  }
  // If both are empty, enable both
  else {
    lessInput.disabled = false;
    greaterInput.disabled = false;
  }
}


// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['cooldownMinutes', 'extensionEnabled', 'filterConfig', 'soundEnabled', 'audioUnlocked', 'maxTabsOpen'], (data) => {
    if (data.cooldownMinutes) {
      document.getElementById('cooldownMinutes').value = data.cooldownMinutes;
    }
    if (data.maxTabsOpen) {
      document.getElementById('maxTabsOpen').value = data.maxTabsOpen;
    }
    document.getElementById('extensionEnabled').checked = data.extensionEnabled !== false;
    document.getElementById('soundEnabled').checked = data.soundEnabled !== false;

    // Note: If sound is enabled but audio is not unlocked, user needs to toggle
    // the switch again (which provides user gesture) to unlock audio

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
        oneMinRow.classList.toggle('disabled', !config.oneMin.enabled);
        // Apply mutual exclusivity after loading values
        if (config.oneMin.enabled) {
          applyMutualExclusivity('filterOneMinThresholdLess', 'filterOneMinThresholdGreater');
        } else {
          oneMinThresholdLess.disabled = true;
          oneMinThresholdGreater.disabled = true;
        }
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
        fiveMinRow.classList.toggle('disabled', !config.fiveMin.enabled);
        // Apply mutual exclusivity after loading values
        if (config.fiveMin.enabled) {
          applyMutualExclusivity('filterFiveMinThresholdLess', 'filterFiveMinThresholdGreater');
        } else {
          fiveMinThresholdLess.disabled = true;
          fiveMinThresholdGreater.disabled = true;
        }
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
        oneHourRow.classList.toggle('disabled', !config.oneHour.enabled);
        // Apply mutual exclusivity after loading values
        if (config.oneHour.enabled) {
          applyMutualExclusivity('filterOneHourThresholdLess', 'filterOneHourThresholdGreater');
        } else {
          oneHourThresholdLess.disabled = true;
          oneHourThresholdGreater.disabled = true;
        }
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

// Handle sound toggle
function handleSoundToggle() {
  const enabled = document.getElementById('soundEnabled').checked;

  // Save the setting
  chrome.storage.local.set({ soundEnabled: enabled }, () => {
    if (enabled) {
      // When enabling sound, unlock audio (toggle click is a user gesture)
      chrome.runtime.sendMessage({ action: 'unlockAudio' }, (response) => {
        if (response && response.success) {
          showStatus('✅ Sound notification enabled!', 'success');
        } else {
          showStatus('⚠️ Sound enabled but failed to unlock audio. Please try again.', 'error');
          // Revert checkbox if unlock failed
          document.getElementById('soundEnabled').checked = false;
          chrome.storage.local.set({ soundEnabled: false });
        }
      });
    } else {
      showStatus('🔇 Sound notification disabled!', 'success');
    }
  });
}

// Save settings
function saveSettings(e) {
  e.preventDefault();

  const cooldownMinutes = parseInt(document.getElementById('cooldownMinutes').value);
  const maxTabsOpen = parseInt(document.getElementById('maxTabsOpen').value);

  if (isNaN(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 60) {
    showStatus('Invalid cooldown period (1-60 minutes)', 'error');
    return;
  }

  if (isNaN(maxTabsOpen) || maxTabsOpen < 1 || maxTabsOpen > 50) {
    showStatus('Invalid max tabs (1-50)', 'error');
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
    // Check if all enabled filters have exactly one threshold (mutually exclusive)
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
      showStatus('Please enter a threshold value for enabled filters', 'error');
      return;
    }

    // Check that only one threshold type is set per filter (mutually exclusive)
    const oneMinBothSet = filterConfig.oneMin.enabled &&
                          filterConfig.oneMin.thresholdLess !== null &&
                          filterConfig.oneMin.thresholdGreater !== null;
    const fiveMinBothSet = filterConfig.fiveMin.enabled &&
                          filterConfig.fiveMin.thresholdLess !== null &&
                          filterConfig.fiveMin.thresholdGreater !== null;
    const oneHourBothSet = filterConfig.oneHour.enabled &&
                          filterConfig.oneHour.thresholdLess !== null &&
                          filterConfig.oneHour.thresholdGreater !== null;

    if (oneMinBothSet || fiveMinBothSet || oneHourBothSet) {
      showStatus('Only one filter type (Less than OR Greater than) can be active at a time', 'error');
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
    maxTabsOpen: maxTabsOpen,
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
    document.getElementById('maxTabsOpen').value = 5;
    document.getElementById('soundEnabled').checked = false;

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
      maxTabsOpen: 5,
      filterConfig: defaultConfig,
      soundEnabled: false
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

