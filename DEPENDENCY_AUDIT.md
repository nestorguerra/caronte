# Caronte - Dependency Audit Report

**Date:** 2025-12-20
**Auditor:** Claude Code
**Project:** Caronte - Personalized AI-generated book platform

---

## Executive Summary

This project is a JavaScript/Node.js web application with **no formal dependency management** (missing `package.json`). The server uses only Node.js built-in modules, while the frontend relies on CDN-hosted libraries. Several critical security vulnerabilities and outdated dependencies were identified.

### Risk Level: **HIGH**

---

## 1. Dependency Inventory

### 1.1 Server-Side Dependencies (Node.js)

| Module | Type | Status |
|--------|------|--------|
| `http` | Built-in | ✅ OK |
| `fs` | Built-in | ✅ OK |
| `path` | Built-in | ✅ OK |

**Assessment:** The server uses only Node.js built-in modules. No external npm packages are required. This minimizes attack surface but limits functionality.

### 1.2 Frontend CDN Dependencies

| Library | Current Version | Latest Version | Status |
|---------|----------------|----------------|--------|
| EmailJS Browser | @3 | @4.4.1 | ⚠️ **OUTDATED** |
| jsPDF | 2.5.1 | 3.0.4 | ⚠️ **OUTDATED** |
| JSZip | 3.10.1 | 3.10.1 | ✅ OK |
| Google Fonts | N/A | N/A | ✅ OK |

### 1.3 External Services

| Service | Usage | Location |
|---------|-------|----------|
| fonts.googleapis.com | Typography | index.html, login.html, register.html, dashboard.html |
| fonts.gstatic.com | Font files | All HTML files |
| cdn.jsdelivr.net | EmailJS | index.html, login.html |
| cdnjs.cloudflare.com | jsPDF, JSZip | dashboard.html |
| via.placeholder.com | Placeholder images | dashboard.html |

---

## 2. Outdated Dependencies (Action Required)

### 2.1 EmailJS Browser

**Files affected:** `index.html:1520`, `login.html:439`

**Current:**
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
```

**Recommended:**
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"
        integrity="sha384-[HASH]"
        crossorigin="anonymous"></script>
```

**Changes in v4:**
- Improved TypeScript support
- Better error handling
- Security fixes

### 2.2 jsPDF

**Files affected:** `dashboard.html:629`

**Current:**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

**Recommended:**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js"
        integrity="sha384-[HASH]"
        crossorigin="anonymous"></script>
```

**Changes in v3:**
- Major API improvements
- Better font handling
- Performance optimizations
- **Note:** May require code changes due to breaking API changes

---

## 3. Security Vulnerabilities

### 3.1 CRITICAL: Hardcoded Credentials

**File:** `auth.js:17-22`

```javascript
const initialDB = {
    'demo@caronte.com': { pass: 'futuro2026', name: 'Demo User' },
    'nestor.guerra@gmail.com': { pass: 'caronte2026', name: 'Néstor Guerra' }
};
```

**Risk:** Credentials exposed in client-side code are visible to anyone viewing source.

**Recommendation:**
- Remove all hardcoded credentials immediately
- Implement server-side authentication with hashed passwords
- Use environment variables for sensitive data

### 3.2 HIGH: Missing Subresource Integrity (SRI)

**Files affected:** All HTML files with CDN scripts

**Risk:** CDN compromise could inject malicious code into your application.

**Recommendation:** Add integrity hashes to all CDN scripts:
```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

### 3.3 HIGH: CORS Wildcard Configuration

**File:** `server.js:25-27`

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

**Risk:** Any website can make requests to your API.

**Recommendation:**
```javascript
const ALLOWED_ORIGINS = ['https://yourdomain.com'];
const origin = req.headers.origin;
if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
}
```

### 3.4 MEDIUM: Plain-Text Password Storage

**File:** `auth.js:155`

```javascript
db[email] = { pass: password, name: name };
```

**Risk:** Passwords stored in localStorage are unencrypted and accessible via XSS.

**Recommendation:**
- Never store passwords client-side
- Use server-side authentication with bcrypt hashing
- Use HTTP-only secure cookies for sessions

### 3.5 MEDIUM: HTTP API Endpoints

**File:** `index.html:1639`, `server.js`

```javascript
fetch('http://localhost:3000/api/register', ...)
```

**Risk:** Data transmitted in plain text can be intercepted.

**Recommendation:**
- Use HTTPS in production
- Configure proper SSL certificates

### 3.6 LOW: External Placeholder Images

**File:** `dashboard.html:497, 524`

```html
<img src="https://via.placeholder.com/40" ...>
```

**Risk:** External dependency for UI elements; service outage affects UX.

**Recommendation:** Use local placeholder or inline SVG/data-URI.

---

## 4. Missing Infrastructure

### 4.1 No `package.json`

**Impact:**
- No version locking for dependencies
- No npm scripts for builds/tests
- Difficult to track and update dependencies
- Cannot use npm audit for vulnerability scanning

**Recommendation:** Create a `package.json`:

```json
{
  "name": "caronte",
  "version": "1.0.0",
  "private": true,
  "description": "Personalized AI-generated book platform",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 4.2 No Dependency Bundler

**Impact:**
- Reliance on CDNs introduces external failure points
- No tree-shaking or minification of custom code
- Harder to implement SRI

**Recommendation:** Consider using:
- Vite or Webpack for bundling
- npm packages instead of CDN for libraries

### 4.3 No Lock File

**Impact:** No guarantee of reproducible builds.

**Recommendation:** After creating package.json, use `npm install` to generate `package-lock.json`.

---

## 5. Unnecessary Bloat

### 5.1 Duplicate JavaScript Files

| File | Size | Issue |
|------|------|-------|
| `auth.js` (root) | 8,037 bytes | Duplicate of js/auth.js |
| `js/auth.js` | 8,037 bytes | Same content |
| `dashboard.js` (root) | 20,356 bytes | Duplicate of js/dashboard.js |
| `js/dashboard.js` | 20,356 bytes | Same content |

**Recommendation:** Remove duplicates from root directory, keep only `js/` versions.

### 5.2 Large Binary Assets

| File | Size | Purpose |
|------|------|---------|
| `caronte.pdf` | 6.1 MB | Sample/demo book |
| `caronte.epub` | 2.8 MB | Sample/demo book |
| `book-cover-bg.png` | 545 KB | Background image |
| `book-caronte-real.png` | 134 KB | Book cover |
| `book-caronte-new.png` | 119 KB | Book cover |

**Recommendation:**
- Consider using Git LFS for large binary files
- Compress images using WebP format
- Serve large files from a CDN

### 5.3 Inline CSS

All CSS is embedded in HTML files rather than separate stylesheets.

**Impact:**
- No caching benefit for CSS
- Harder to maintain
- Increased HTML file size

**Recommendation:** Extract CSS to separate files (e.g., `styles/main.css`).

---

## 6. Recommended Actions (Priority Order)

### Immediate (Security Critical)

1. **Remove hardcoded credentials** from `auth.js`
2. **Add SRI hashes** to all CDN script tags
3. **Restrict CORS** to specific origins in production

### Short-term (1-2 weeks)

4. **Update EmailJS** from @3 to @4.4.1
5. **Update jsPDF** from 2.5.1 to 3.0.x (test for breaking changes)
6. **Create `package.json`** for formal dependency management
7. **Remove duplicate files** from root directory

### Medium-term (1 month)

8. **Implement proper authentication** with server-side sessions
9. **Add HTTPS support** for production deployment
10. **Bundle dependencies** with Vite/Webpack instead of CDN
11. **Compress/optimize images** and use WebP format

### Long-term

12. **Add automated dependency updates** (Dependabot/Renovate)
13. **Implement CSP headers** for additional security
14. **Set up CI/CD pipeline** with security scanning

---

## 7. Updated CDN Links with SRI

Once you update dependencies, generate SRI hashes using https://www.srihash.org/ and add them:

```html
<!-- EmailJS (update to v4) -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"
        crossorigin="anonymous"></script>

<!-- jsPDF (update to v3) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js"
        crossorigin="anonymous"></script>

<!-- JSZip (current version is latest) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
        crossorigin="anonymous"></script>
```

---

## Sources

- [EmailJS Browser on npm](https://www.npmjs.com/package/@emailjs/browser)
- [jsPDF on npm](https://www.npmjs.com/package/jspdf)
- [jsPDF on cdnjs](https://cdnjs.com/libraries/jspdf)
- [JSZip on npm](https://www.npmjs.com/package/jszip)
- [JSZip on cdnjs](https://cdnjs.com/libraries/jszip)

---

*Report generated by Claude Code dependency audit*
