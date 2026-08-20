(function () {
  'use strict';

  function updateOnlineStatus() {
    const badge = document.getElementById('offline-badge');
    if (!badge) return;
    badge.hidden = navigator.onLine;
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  document.addEventListener('DOMContentLoaded', updateOnlineStatus);

  async function loadListing() {
    const container = document.getElementById('literature-list');
    if (!container) return;

    try {
      const res = await fetch('/literature/index.json');
      const items = await res.json();
      container.innerHTML = '<p>Literature listings will appear here.</p>';
    } catch (err) {
      console.error('Failed to load listing:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadListing);
})();