# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**My Notes** is a pure static web application for browsing Markdown notes stored in GitHub repositories. It runs entirely in the browser with no build tools or backend server required.

### Key Features
- Fetches and renders Markdown files from GitHub repositories (public or private)
- Supports GitHub Personal Access Tokens for private repository access
- Image caching using IndexedDB
- KaTeX math rendering and Prism.js syntax highlighting
- 14 theme combinations (2 modes × 7 colors)
- Hash-based routing for shareable links

---

## Development Commands

### Local Development
```bash
# Windows - Double-click to start
start.bat

# Manual Python server
python -m http.server 8080

# Manual Node.js server
npx http-server -p 8080
```

The application runs at `http://localhost:8080`. Press `Ctrl+C` to stop the server.

### No Build Process
This is a **pure static HTML/CSS/JS application** with no build step. Simply edit files and refresh the browser to see changes.

---

## Architecture

### Module Structure

The application uses ES6 modules with four main classes:

```
js/
├── main.js       # Entry point - initializes all modules
├── config.js     # ConfigManager - config, tokens, theme, URL detection
├── data.js       # DataManager - GitHub API communication
├── ui.js         # UIManager - DOM rendering, event handling
└── cache.js      # ImageCache - IndexedDB image storage
```

### Data Flow

1. **Config Detection Priority** (config.js:15-20):
   - URL parameters (`?user=xxx&repo=xxx`)
   - Hash routing (`#/user/repo/path`)
   - GitHub Pages domain detection
   - localStorage fallback

2. **Tree Building** (data.js:22-64):
   - Single GitHub API call: `/repos/{owner}/{repo}/git/trees/HEAD?recursive=1`
   - Filters for `.md` files only
   - Converts flat paths to nested tree structure
   - Filters out folders containing no markdown files

3. **Image Loading** (ui.js:659-762):
   - Relative paths resolved against markdown file location
   - Cached in IndexedDB with 7-day expiration
   - Private repos: GitHub API with token
   - Public repos: raw.githubusercontent.com

### Key Implementation Details

**Token Management**: Tokens are stored per-repo in `localStorage.blog_tokens_v1` as a dictionary, allowing seamless switching between multiple private repositories.

**Theme System**: CSS variable cascade with 5 layers (root → mode → color → component → utilities). Theme format: `{mode}-{color}` (e.g., `dark-purple`). Blue color uses simplified format (`light`/`dark` only) for backward compatibility.

**Hash Routing**: Format `#/{username}/{repo}/{optional-path}`. Switching repositories via hash automatically loads the corresponding saved token.

---

## External Dependencies (CDN)

All loaded via CDN in `index.html`:
- **marked@11.1.1** - Markdown parsing
- **katex@0.16.9** - Math rendering
- **prismjs@1.29.0** - Code highlighting (bash, js, ts, python, markdown)

---

## Common Tasks

### Adding a New Prism Language
1. Add CSS link in `<head>`: `prism-{lang}.min.css`
2. Add script tag before closing `</body>`: `prism-{lang}.min.js`

### Modifying Theme Colors
Edit `css/styles.css` lines 79-120+ where accent colors are defined per `[data-theme="..."]` selector.

### Debugging
All modules expose `window.*` globals for console debugging:
- `window.config` - ConfigManager instance
- `window.data` - DataManager instance
- `window.ui` - UIManager instance
- `window.imageCache` - ImageCache instance
