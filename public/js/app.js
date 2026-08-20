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

      if (!res.ok) {
        container.innerHTML = '<p>No literature available yet. Add a .txt file to <code>public/text/</code> and push to GitHub.</p>';
        return;
      }

      const items = await res.json();

      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<p>No books converted yet.</p>';
        return;
      }

      const html = items.map(book => {
        const dateStr = book.datePublished
          ? `<span class="book-date">${book.datePublished}</span>`
          : '';
        const descStr = book.description
          ? `<p class="book-desc">${book.description}</p>`
          : '';

        return `<article class="book-entry">
  <h3><a href="${book.url}">${book.title}</a></h3>
  <p class="book-author">by ${book.author}</p>
  ${dateStr}
  ${descStr}
</article>`;
      }).join('\n');

      container.innerHTML = html;
    } catch (err) {
      console.error('Failed to load listing:', err);
      container.innerHTML = '<p>Could not load literature catalogue. You may be offline.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', loadListing);
})();
