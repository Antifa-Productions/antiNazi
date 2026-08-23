/**
 * Service Worker registration with update handling.
 * Also exposes a message API for reading progress sync.
 *
 * Place in <head> with defer.
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (reg) {
        console.log('SW registered:', reg.scope);

        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function () {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New SW version available. Refresh to update.');
              }
            });
          }
        });
      })
      .catch(function (err) {
        console.error('SW registration failed:', err);
      });
  });
}
