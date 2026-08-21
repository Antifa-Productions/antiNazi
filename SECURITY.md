# Security Policy

## Supported Versions

The following versions of this project are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Latest `main` | :white_check_mark: |
| Older versions | :x:              |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public GitHub issue.**

Instead, please email the site owner directly. You can typically find contact information linked from the site's footer (e.g., the `/About` page on the live site).

Please include the following in your report:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce the issue
3. Any proof-of-concept code or screenshots
4. Your suggested fix (if any)

### Response Timeline

- **Acknowledgement:** Within 48 hours
- **Initial Assessment:** Within 5 business days
- **Resolution:** Depends on severity, but critical issues will be prioritized

You will be kept informed throughout the remediation process. Once the issue is resolved, we are happy to credit you in the commit history (unless you prefer to remain anonymous).

## Scope

This security policy applies to the source code contained within this GitHub repository, including:

- Node.js conversion and hashing scripts (`src/`)
- Service worker and client-side JavaScript (`public/sw.js`, `public/sw-register.js`, `public/js/`)
- HTML templates and CSS (`src/template.mjs`, `public/css/`)
- GitHub Actions workflows (`.github/workflows/`)
- PWA manifest and configuration files

### Out of Scope

- Third-party libraries (e.g., Workbox) — report to upstream maintainers
- Vulnerabilities in Project Gutenberg source texts
- Issues related to the hosting provider (Cloudflare) infrastructure
- Social engineering attacks
- Denial of Service (DoS) attacks
- Rate limiting or resource exhaustion on free-tier infrastructure

## Security Measures Already in Place

This project implements the following security practices:

- **Zero external runtime dependencies** — Pure Node.js standard library for all server-side scripts
- **Self-hosted Workbox** — No CDN dependency for service worker libraries
- **Input sanitization** — All user-supplied or text-derived content is HTML-escaped before rendering
- **Same-origin service worker** — The SW only intercepts same-origin GET requests
- **Strict CSP-ready** — No `unsafe-eval` or `unsafe-inline` required for core functionality
- **Minimal permissions** — GitHub Actions use `contents: write` only where needed for auto-committing
- **SHA1 file hashing** — Precache manifest uses content-addressed revisions for cache integrity

## Attribution

We appreciate responsible disclosure and will credit researchers who help improve the security of this project.
