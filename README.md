# Literature PWA

Converts plain-text public-domain literature into accessible HTML5 documents and serves them as an offline-capable Progressive Web App.

## Quick Start

1. Drop a `.txt` file into `public/text/`
2. Push to GitHub
3. The **Convert Literature** action generates HTML in `public/literature/`
4. The **Hash Precache Manifest** action scans all asset directories and produces `public/precache-manifest.json`
5. The service worker uses that manifest for offline caching

## Local Development
