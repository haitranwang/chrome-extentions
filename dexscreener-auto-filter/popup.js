// Popup script for settings

// Supabase configuration
const SUPABASE_URL = 'https://putcecldtpverondjprx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGNlY2xkdHB2ZXJvbmRqcHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Mzk0NjQsImV4cCI6MjA3NzIxNTQ2NH0.mNcGdDw_3F3MLT1jG0iX4LF-ffKtgsHII4SCOJqIBwY';

let currentFilters = [];
let browserFingerprint = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOM loaded');

  // Initialize browser fingerprint
  try {
    browserFingerprint = await getBrowserFingerprint();
    console.log('Browser fingerprint loaded:', browserFingerprint);
  } catch (error) {
    console.error('Error loading browser fingerprint:', error);
  }

  loadSettings();
  loadStats();
  setupTabs();
  loadCurrentFilter();
  loadFavorites();

  // Setup event listeners
  const addBtn = document.getElementById('addFavoriteBtn');
  console.log('Add button found:', addBtn);

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      console.log('Add button clicked!');
      addCurrentFilterToFavorites();
    });
  }

  const settingsForm = document.getElementById('settingsForm');
  const resetBtn = document.getElementById('resetBtn');
  const extensionEnabled = document.getElementById('extensionEnabled');

  if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
  if (resetBtn) resetBtn.addEventListener('click', resetSettings);
  if (extensionEnabled) extensionEnabled.addEventListener('change', handleExtensionToggle);

  console.log('All event listeners attached');
});

// Tab Switching
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update content
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tabName}Tab`).classList.add('active');

  // Load data when switching to filters tab
  if (tabName === 'filters') {
    loadCurrentFilter();
    loadFavorites();
  }
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['cooldownMinutes', 'extensionEnabled'], (data) => {
    if (data.cooldownMinutes) {
      document.getElementById('cooldownMinutes').value = data.cooldownMinutes;
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

  if (isNaN(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 60) {
    showStatus('Invalid cooldown period (1-60 minutes)', 'error');
    return;
  }

  chrome.storage.local.set({
    cooldownMinutes: cooldownMinutes
  }, () => {
    showStatus('Settings saved!', 'success');
    loadStats();
  });
}

// Reset settings to defaults
function resetSettings() {
  if (confirm('Reset to default settings?')) {
    document.getElementById('cooldownMinutes').value = 15;
    const cooldownMinutes = 15;

    chrome.storage.local.set({
      cooldownMinutes: cooldownMinutes
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
      const isOnDexScreener = currentTab.url?.includes('dexscreener.com');

      if (!enabled) {
        statusEl.textContent = 'Extension Disabled';
        statusEl.style.color = '#999';
      } else if (isOnDexScreener) {
        statusEl.textContent = 'Active on DexScreener';
        statusEl.style.color = '#4caf50';
      } else {
        statusEl.textContent = 'Inactive - Navigate to DexScreener';
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

// Show status message (for settings tab)
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

// Show status message (for filters tab)
function showFiltersStatus(message, type) {
  const status = document.getElementById('filtersStatus');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
      status.style.display = 'none';
      status.className = 'status';
      status.textContent = '';
    }, 3000);
  }
  console.log(`[Filters Status] ${type}: ${message}`);
}

// ============= Favorite Filters Functions =============

// Load current filter from active tab
async function loadCurrentFilter() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (currentTab.url?.includes('dexscreener.com') && currentTab.url.includes('?')) {
      // Extract filter URL
      const filterUrl = currentTab.url;
      const currentFilterSection = document.getElementById('currentFilterSection');
      const currentFilterUrl = document.getElementById('currentFilterUrl');

      currentFilterUrl.textContent = filterUrl;
      currentFilterSection.style.display = 'block';
    } else {
      document.getElementById('currentFilterSection').style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading current filter:', error);
  }
}

// Load favorites from Supabase
async function loadFavorites() {
  const filtersList = document.getElementById('filtersList');
  const loadingFilters = document.getElementById('loadingFilters');
  const emptyState = document.getElementById('emptyState');

  // Wait for browser fingerprint to be loaded
  if (!browserFingerprint) {
    try {
      browserFingerprint = await getBrowserFingerprint();
      console.log('Browser fingerprint loaded during favorites load:', browserFingerprint);
    } catch (error) {
      console.error('Error loading browser fingerprint:', error);
      loadingFilters.textContent = 'Failed to initialize browser fingerprint';
      return;
    }
  }

  try {
    loadingFilters.style.display = 'block';
    filtersList.innerHTML = '';
    emptyState.style.display = 'none';

    // Filter by user_id to get only this user's favorites
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter?user_id=eq.${browserFingerprint}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load favorites');
    }

    const filters = await response.json();
    currentFilters = filters;

    loadingFilters.style.display = 'none';

    if (filters.length === 0) {
      emptyState.style.display = 'block';
    } else {
      filters.forEach(filter => {
        const filterElement = createFilterElement(filter);
        filtersList.appendChild(filterElement);
      });
    }
  } catch (error) {
    console.error('Error loading favorites:', error);
    loadingFilters.textContent = 'Failed to load favorites';
  }
}

// Create filter element
function createFilterElement(filter) {
  const div = document.createElement('div');
  div.className = 'filter-item';

  const date = new Date(filter.created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  div.innerHTML = `
    <div class="filter-info">
      <div class="filter-url" title="${filter.filter}">${filter.filter}</div>
      <div class="filter-date">Added ${formattedDate}</div>
    </div>
    <div class="filter-actions">
      <button class="btn-icon delete" data-filter-id="${filter.id}" title="Delete">
        🗑️
      </button>
    </div>
  `;

  // Add click handler to open filter
  div.style.cursor = 'pointer';
  div.addEventListener('click', (e) => {
    if (!e.target.classList.contains('btn-icon')) {
      chrome.tabs.create({ url: filter.filter });
    }
  });

  // Add delete button click handler
  const deleteBtn = div.querySelector('.btn-icon.delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent the parent click handler from firing
    const filterId = parseInt(deleteBtn.getAttribute('data-filter-id'));
    deleteFilter(filterId);
  });

  return div;
}

// Add current filter to favorites
async function addCurrentFilterToFavorites() {
  console.log('Add to favorites button clicked');

  // Ensure browser fingerprint is loaded
  if (!browserFingerprint) {
    try {
      browserFingerprint = await getBrowserFingerprint();
      console.log('Browser fingerprint loaded during add:', browserFingerprint);
    } catch (error) {
      console.error('Error loading browser fingerprint:', error);
      showFiltersStatus('❌ Failed to initialize browser fingerprint', 'error');
      return;
    }
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    console.log('Current tab URL:', currentTab.url);

    if (!currentTab.url?.includes('dexscreener.com')) {
      console.log('Not a dexscreener.com URL');
      showFiltersStatus('Error: Current page is not a DexScreener URL', 'error');
      return;
    }

    if (!currentTab.url.includes('?')) {
      console.log('URL does not have query parameters');
      showFiltersStatus('Error: Current page does not have filter parameters', 'error');
      return;
    }

    const filterUrl = currentTab.url;
    console.log('Filter URL to add:', filterUrl);

    // Check if already exists for this user
    if (currentFilters.some(f => f.filter === filterUrl && f.user_id === browserFingerprint)) {
      console.log('Filter already exists');
      showFiltersStatus('⚠️ Filter already in favorites', 'error');
      return;
    }

    console.log('Sending request to Supabase...');
    showFiltersStatus('Adding to favorites...', 'success');

    // Add to Supabase with user_id
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        filter: filterUrl,
        user_id: browserFingerprint
      })
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error:', errorText);
      throw new Error(`Failed to add favorite: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Added successfully:', result);

    showFiltersStatus('✅ Added to favorites successfully!', 'success');
    loadFavorites();
  } catch (error) {
    console.error('Error adding favorite:', error);
    showFiltersStatus(`❌ Failed to add favorite: ${error.message}`, 'error');
  }
}

// Delete filter from favorites
async function deleteFilter(id) {
  if (!confirm('Remove this filter from favorites?')) {
    return;
  }

  // Ensure browser fingerprint is loaded for security
  if (!browserFingerprint) {
    try {
      browserFingerprint = await getBrowserFingerprint();
      console.log('Browser fingerprint loaded during delete:', browserFingerprint);
    } catch (error) {
      console.error('Error loading browser fingerprint:', error);
      showFiltersStatus('❌ Failed to initialize browser fingerprint', 'error');
      return;
    }
  }

  try {
    console.log('Deleting filter with id:', id, 'for user:', browserFingerprint);
    showFiltersStatus('Removing filter...', 'success');

    // Delete with both id and user_id for security (double-check ownership)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dexscreener-filter?id=eq.${id}&user_id=eq.${browserFingerprint}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Delete response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase delete error:', errorText);
      throw new Error(`Failed to delete favorite: ${response.status} ${response.statusText}`);
    }

    showFiltersStatus('✅ Removed from favorites', 'success');
    loadFavorites();
  } catch (error) {
    console.error('Error deleting favorite:', error);
    showFiltersStatus(`❌ Failed to remove favorite: ${error.message}`, 'error');
  }
}
