# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**My Notes** is a static web-based Markdown note viewer for browsing GitHub repositories. It displays `.md` files in a sidebar tree and renders them with Marked.js, KaTeX, and Prism.js.

**Live Demo**: https://shingwha.github.io/my-notes/

---

## Local Development

This is a **pure static application** - no build tools, bundlers, or package managers.

### Starting a Local Server

**Windows (Recommended)**:
```bash
start.bat
```

**Manual Options**:
```bash
# Python 3
python -m http.server 8080

# Node.js
npx http-server -p 8080

# VS Code: Right-click index.html → "Open with Live Server"
```

### No Build Process

- Edit `index.html`, `css/styles.css`, or `js/*.js` directly
- Changes reflect immediately after browser refresh
- No npm, no webpack, no transpilation

---

## Architecture

### Module Pattern (ES6 Classes)

The app uses three core modules with clear separation of concerns:

| Module | File | Responsibility |
|--------|------|----------------|
| `ConfigManager` | `js/config.js` | GitHub repo config, token storage, URL parsing |
| `DataManager` | `js/data.js` | GitHub API communication, tree building, content fetching |
| `UIManager` | `js/ui.js` | DOM manipulation, event handling, markdown rendering |

Entry point: `js/main.js` (initializes all three modules and exposes globals for debugging)

### Data Flow

```
User Input → UIManager → ConfigManager → DataManager → GitHub API
                ↓                                      ↓
           localStorage ←────────────────────────── JSON Response
                ↓
            UIManager.renderMarkdown()
                ↓
            Marked.js + KaTeX + Prism.js → HTML Output
```

---

## Key Patterns

### URL Configuration Priority

```javascript
URL Parameters > Hash Route > Domain Detection > localStorage
```

ConfigManager detects repo from:
1. `?user=xxx&repo=yyy&path=zzz` (URL params)
2. `#/xxx/yyy/zzz` (hash routing)
3. `github.com/user/repo` (GitHub URL)
4. `username.github.io/repo` (GitHub Pages)

### Token Storage

```javascript
// Tokens stored per-repo in localStorage
key: "username/repo".toLowerCase()
value: "github_pat_xxxx"
```

When switching repos, the corresponding token is auto-loaded.

### GitHub API Strategy

| Scenario | Method |
|----------|--------|
| **Public repo** | `raw.githubusercontent.com/...` (no headers, no CORS) |
| **Private repo** | `api.github.com/repos/.../contents/...` with `Accept: application/vnd.github.v3.raw` |
| **Tree structure** | `api.github.com/repos/.../git/trees/HEAD?recursive=1` (single call, cached) |

### Error Types

```javascript
"AUTH_REQUIRED"           // 401 - Invalid/expired token
"NOT_FOUND_OR_PRIVATE"    // 404 - Wrong repo OR private repo without token
"RATE_LIMIT_OR_FORBIDDEN" // 403 - API limits or insufficient token permissions
"FETCH_ERROR"             // Other network errors
```

Error handling in `ui.js:refreshData()` shows contextual help messages and "前往配置" button when appropriate.

---

## Theme System

- **5-layer CSS variable structure** in `css/styles.css`
- **14 themes**: 2 modes (light/dark) × 7 colors (blue, green, purple, orange, red, pink, rose)
- Toggle via **palette icon** in sidebar header
- Storage format: `localStorage` stores `"light"` (default blue) or `"dark-purple"` (mode + color)
- Theme applied immediately via inline script in `<head>` to prevent flash
- Accent color drives links, buttons, focus states, and active borders

---

## Hash Routing

Format: `#/user/repo/path/to/file.md`

- `#/user/repo` → Shows home (folder list)
- `#/user/repo/docs` → Root path set to `docs/`
- `#/user/repo/docs/note.md` → Renders that note

Switching hash to different repo triggers:
1. Config update
2. Token reload for that repo
3. Tree cache clear (`dataManager.treeData = null`)
4. Data refresh

Implementation in `ui.js:handleRouting()` at line 304.

---

## Dependencies (CDN)

- **Marked.js** v11.1.1 - Markdown parsing
- **KaTeX** v0.16.9 - Math formulas (custom `$$...$$` and `$...$` extensions)
- **Prism.js** v1.29.0 - Syntax highlighting (bash, js, ts, python, markdown)
- **Google Fonts** - IBM Plex Mono/Serif + Inter

---

## File Structure

```
├── index.html           # Main entry (modular version)
├── index_old.html       # Legacy single-file - can run via file:// protocol
├── start.bat            # Windows launcher - auto-detects Python/Node
├── README.md            # Demo URL only
├── 部署教程.md           # Chinese deployment guide
├── css/
│   └── styles.css       # 5-layer theme system (1300+ lines)
├── js/
│   ├── main.js          # Entry: inits modules, exposes debug globals
│   ├── config.js        # ConfigManager: tokens, URL detection, localStorage
│   ├── data.js          # DataManager: GitHub API, tree building, caching
│   └── ui.js            # UIManager: DOM, markdown rendering, events
└── example_notes/       # Sample markdown for testing
```

---

## Testing Changes

1. Start local server: `start.bat`
2. Open http://localhost:8080
3. Edit files and refresh browser (no build step)
4. Check browser console for errors
5. **Debug globals** (exposed in main.js):
   - `window.ui` - UIManager instance (DOM, rendering, events)
   - `window.config` - ConfigManager instance (tokens, settings)
   - `window.data` - DataManager instance (API calls, tree cache)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+F` / `Cmd+F` | Focus search box |
| `Escape` | Close settings modal / theme panel / mobile sidebar |

## Settings UX Patterns

- **Token auto-fill**: When changing username/repo in settings, the stored token for that repo auto-fills
- **Quick import**: Paste any GitHub URL to auto-parse user/repo/path
- **Per-repo tokens**: Tokens stored as `"user/repo"` keys, automatically switched when changing repos

---

## Deployment to GitHub Pages

1. Push to repository
2. Settings → Pages → Source: `Deploy from a branch` → `main` → `/ (root)`
3. Access at `https://username.github.io/repo`

---

## Notes

- All markdown files end with `.md` (case-insensitive filtering)
- Folders without `.md` files are **hidden from tree** (filtered in `data.js:buildTree`)
- Sidebar collapses on mobile (width ≤ 1024px) via CSS media query
- Search filters **filenames only** client-side (no full-text search)
- Chinese language support throughout UI and comments
- **index_old.html** is a legacy single-file version that works without HTTP server (file:// protocol)
