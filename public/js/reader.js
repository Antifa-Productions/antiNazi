/**
 * Reader logic for book pages.
 * Tracks reading progress (chapter + scroll position) via
 * the service worker's IDB message channel.
 *
 * Requires: a service worker controller and a global
 * window.__BOOK_SLUG__ variable set by the template.
 */

(function () {
  'use strict';

  if (!window.__BOOK_SLUG__) return;

  var DEBOUNCE_MS = 1500;
  var saveTimer = null;

  function getCurrentChapter() {
    var sections = document.querySelectorAll('section[id]');
    if (sections.length === 0) return null;

    var scrollPos = window.scrollY + window.innerHeight / 3;

    for (var i = sections.length - 1; i >= 0; i--) {
      if (sections[i].offsetTop <= scrollPos) {
        return sections[i].id;
      }
    }

    return sections[0].id;
  }

  function saveProgress() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'SAVE_PROGRESS',
      bookSlug: window.__BOOK_SLUG__,
      chapterId: getCurrentChapter(),
      scrollOffset: Math.round(window.scrollY),
    });
  }

  function restoreProgress() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'GET_PROGRESS',
      bookSlug: window.__BOOK_SLUG__,
    });
  }

  // Debounced scroll handler
  window.addEventListener('scroll', function () {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProgress, DEBOUNCE_MS);
  }, { passive: true });

  // Save on page hide (mobile tab switch, app close, etc.)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      saveProgress();
    }
  });

  // Listen for progress data from SW
  navigator.serviceWorker.addEventListener('message', function (event) {
    var msg = event.data || {};

    if (msg.type === 'PROGRESS_DATA' && msg.progress) {
      var savedChapter = msg.progress.chapterId;
      var savedOffset = msg.progress.scrollOffset || 0;

      if (savedChapter) {
        var el = document.getElementById(savedChapter);
        if (el) {
          // Restore scroll position relative to the chapter
          window.scrollTo({
            top: el.offsetTop + savedOffset - el.offsetTop,
            behavior: 'smooth',
          });
        }
      } else if (savedOffset > 0) {
        window.scrollTo({ top: savedOffset, behavior: 'smooth' });
      }
    }
  });

  // Wait for SW to be ready, then restore progress
  if (navigator.serviceWorker.controller) {
    window.addEventListener('load', restoreProgress);
  } else {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      window.addEventListener('load', restoreProgress);
    });
  }
})();
