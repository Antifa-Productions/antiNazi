/**
 * Minimal promise-based IndexedDB wrapper.
 * No external dependencies. Loaded via importScripts() in the service worker.
 *
 * Provides two object stores:
 *   - reading-progress: Tracks scroll position and chapter per book
 *   - book-metadata:    Caches book listings for offline browsing
 */

var IDB = (function () {

  var DB_NAME = 'literature-db';
  var DB_VERSION = 1;
  var STORES = {
    PROGRESS: 'reading-progress',
    METADATA: 'book-metadata',
  };

  function openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = function () {
        reject(request.error);
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
          var progressStore = db.createObjectStore(STORES.PROGRESS, { keyPath: 'bookSlug' });
          progressStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'url' });
        }
      };
    });
  }

  function tx(db, storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  return {
    STORES: STORES,

    put: async function (storeName, value) {
      var db = await openDB();
      return promisify(tx(db, storeName, 'readwrite').put(value));
    },

    get: async function (storeName, key) {
      var db = await openDB();
      return promisify(tx(db, storeName, 'readonly').get(key));
    },

    getAll: async function (storeName) {
      var db = await openDB();
      return promisify(tx(db, storeName, 'readonly').getAll());
    },

    delete: async function (storeName, key) {
      var db = await openDB();
      return promisify(tx(db, storeName, 'readwrite').delete(key));
    },

    clear: async function (storeName) {
      var db = await openDB();
      return promisify(tx(db, storeName, 'readwrite').clear());
    },
  };
})();
