(function () {
  'use strict';

  function updateOnlineStatus() {
    var badge = document.getElementById('offline-badge');
    if (!badge) return;
    badge.hidden = navigator.onLine;
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  document.addEventListener('DOMContentLoaded', updateOnlineStatus);

  function renderBooks(items) {
    var container = document.getElementById('literature-list');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '<p>No books converted yet.</p>';
      return;
    }

    var html = items.map(function (book) {
      var dateStr = book.datePublished
        ? '<span class="book-date">' + book.datePublished + '</span>'
        : '';
      var descStr = book.description
        ? '<p class="book-desc">' + book.description + '</p>'
        : '';

      return '<article class="book-entry">' +
        '<h3><a href="' + book.url + '">' + book.title + '</a></h3>' +
        '<p class="book-author">by ' + book.author + '</p>' +
        dateStr + descStr +
        '</article>';
    }).join('\n');

    container.innerHTML = html;
  }

  function loadFromNetwork() {
    return fetch('/literature/index.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  function loadFromIDB() {
    return new Promise(function (resolve) {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        resolve([]);
        return;
      }

      var channel = new MessageChannel();
      var timeout = setTimeout(function () {
        resolve([]);
      }, 3000);

      channel.port1.onmessage = function (event) {
        clearTimeout(timeout);
        resolve(event.data.metadata || []);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_ALL_METADATA' },
        [channel.port2]
      );
    });
  }

  async function loadListing() {
    var container = document.getElementById('literature-list');
    if (!container) return;

    container.innerHTML = '<p>Loading…</p>';

    try {
      var items = await loadFromNetwork();
      renderBooks(items);
    } catch (err) {
      console.warn('Network fetch failed, trying IDB fallback:', err);
      try {
        var cached = await loadFromIDB();
        if (cached && cached.length > 0) {
          renderBooks(cached);
        } else {
          container.innerHTML = '<p>Could not load literature catalogue. You may be offline.</p>';
        }
      } catch (idbErr) {
        container.innerHTML = '<p>Could not load literature catalogue. You may be offline.</p>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', loadListing);
})();
