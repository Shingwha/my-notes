/**
 * 配置管理模块
 * 负责管理 GitHub 仓库配置、Token 存储和 URL 自动检测
 */
export class ConfigManager {
    constructor() {
        this.tokens = this.loadTokens();
        this.config = this.loadConfig();

        // 主题配置
        this.themeConfig = { mode: 'light', color: 'blue' };
        this.loadThemeConfig();

        // 优先级：URL 参数 > Hash 路由 > 域名检测 > 本地存储
        const urlCfg = this.autoDetectFromUrl();
        if (urlCfg) {
            this.config = { ...this.config, ...urlCfg };
            // 切换到 URL 指定的仓库时，加载该仓库对应的 Token
            this.loadTokenForRepo();
        }
    }

    loadThemeConfig() {
        const saved = localStorage.getItem("theme") || "light";
        if (saved.includes('-')) {
            const [mode, color] = saved.split('-');
            this.themeConfig = { mode, color };
        } else {
            // 向后兼容
            this.themeConfig = { mode: saved, color: 'blue' };
        }
    }

    getThemeConfig() {
        return this.themeConfig;
    }

    setTheme(mode, color) {
        this.themeConfig = { mode, color };
        const themeValue = color === 'blue' ? mode : `${mode}-${color}`;
        localStorage.setItem("theme", themeValue);
        document.documentElement.setAttribute("data-theme", themeValue);
    }

    loadTokens() {
        const stored = localStorage.getItem("blog_tokens_v1");
        return stored ? JSON.parse(stored) : {};
    }

    saveToken(username, repo, token) {
        if (!username || !repo) return;
        const key = `${username}/${repo}`.toLowerCase();
        if (token) {
            this.tokens[key] = token;
        } else {
            delete this.tokens[key];
        }
        localStorage.setItem("blog_tokens_v1", JSON.stringify(this.tokens));
    }

    loadTokenForRepo() {
        const key = `${this.config.username}/${this.config.repo}`.toLowerCase();
        this.config.token = this.tokens[key] || "";
    }

    loadConfig() {
        const stored = localStorage.getItem("blog_config_v1");
        let cfg = stored
            ? JSON.parse(stored)
            : { username: "", repo: "", path: "", token: "" };
        // 加载该仓库保存的 Token
        if (cfg.username && cfg.repo) {
            const key = `${cfg.username}/${cfg.repo}`.toLowerCase();
            cfg.token = this.tokens[key] || "";
        }
        return cfg;
    }

    saveConfig(config) {
        this.config = { ...this.config, ...config };
        // 保存当前主配置 (不包含 token，或者包含也没关系，但我们主攻 token 字典)
        localStorage.setItem("blog_config_v1", JSON.stringify(this.config));
        // 同步到 Token 字典
        this.saveToken(
            this.config.username,
            this.config.repo,
            this.config.token,
        );
    }

    autoDetectFromUrl(customUrl = null) {
        let urlStr = customUrl || window.location.href;
        // 如果不包含协议头，补全协议头以便 URL 构造函数解析
        if (
            urlStr &&
            !urlStr.includes("://") &&
            (urlStr.startsWith("github.com") ||
                urlStr.startsWith("www.github.com"))
        ) {
            urlStr = "https://" + urlStr;
        }

        try {
            const url = new URL(urlStr);
            const params = url.searchParams;
            let username = "",
                repo = "",
                path = "",
                token = "";

            // 1. GitHub 标准 URL 支持 (https://github.com/user/repo)
            if (url.hostname === "github.com") {
                const parts = url.pathname.split("/").filter((p) => p);
                if (parts.length >= 2) {
                    username = parts[0];
                    repo = parts[1];
                    // 如果路径中有 /tree/main/notes 这种，可以尝试解析
                    if (parts[2] === "tree" && parts[4]) {
                        path = parts.slice(4).join("/");
                    }
                }
            }

            // 2. URL 参数优先 (?user=xxx&repo=xxx)
            if (!username && (params.has("user") || params.has("username"))) {
                username = params.get("user") || params.get("username");
                repo = params.get("repo") || "";
                path = params.get("path") || "";
                token = params.get("token") || "";
            }

            // 3. Hash 路由 (#/user/repo/...)
            if (!username) {
                const hash = window.location.hash.slice(1);
                if (hash && hash.startsWith("/")) {
                    const parts = hash.split("/").filter((p) => p);
                    if (parts.length >= 2) {
                        username = parts[0];
                        repo = parts[1];
                    }
                }
            }

            // 4. GitHub Pages 域名 (username.github.io/repo)
            if (!username) {
                const hostname = url.hostname;
                const pathname = url.pathname.replace(/\/$/, "");
                if (hostname.endsWith(".github.io")) {
                    username = hostname.split(".")[0];
                    const parts = pathname.split("/").filter((p) => p);
                    if (parts.length >= 1) {
                        repo = parts[0];
                    }
                }
            }

            if (username && repo) {
                return { username, repo, path, token };
            }
        } catch (e) {
            console.error("Invalid URL:", urlStr);
        }
        return null;
    }

    getApiUrl(subPath = "") {
        const { username, repo, path } = this.config;
        const fullPath = subPath || path || "";
        return `https://api.github.com/repos/${username}/${repo}/contents/${fullPath}`;
    }

    getRepoUrl() {
        return `https://github.com/${this.config.username}/${this.config.repo}`;
    }

    isValid() {
        return this.config.username && this.config.repo;
    }
}
