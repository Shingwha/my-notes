/**
 * 界面管理模块
 * 负责 UI 渲染、事件绑定和用户交互
 */
export class UIManager {
    constructor(configManager, dataManager, imageCache = null) {
        this.configManager = configManager;
        this.dataManager = dataManager;
        this.imageCache = imageCache;
        this.searchMode = false;
        this.toastTimer = null;
        // Blob URL 内存管理
        this.blobUrls = new Set();
        // 存储当前笔记的原始 Markdown
        this.currentRawMarkdown = null;

        this.dom = {
            sidebar: document.getElementById("sidebar"),
            navTree: document.getElementById("navTree"),
            contentArea: document.getElementById("contentArea"),
            contentViewport: document.getElementById("contentViewport"),
            toolbarTitle: document.getElementById("toolbarTitle"),
            settingsModal: document.getElementById("settingsModal"),
            searchInput: document.getElementById("searchInput"),
            mobileOverlay: document.getElementById("mobileOverlay"),
            sidebarLogo: document.getElementById("sidebarLogo"),
            loadingBar: document.getElementById("loadingBar"),
        };

        this.init();
    }

    init() {
        // 初始化主题
        const themeConfig = this.configManager.getThemeConfig();
        const color = themeConfig.color || 'blue';
        const themeValue = color === 'blue'
            ? themeConfig.mode
            : `${themeConfig.mode}-${color}`;
        document.documentElement.setAttribute("data-theme", themeValue);

        // 自定义图片渲染器：保存原始路径到 data 属性，不立即加载
        const renderer = new marked.Renderer();
        renderer.image = function(href, title, text) {
            // 使用 DOM API 安全地构建图片标签
            const img = document.createElement('img');
            // 不设置 src，让 loadSingleImage() 统一处理
            img.alt = text || '加载中...';
            img.setAttribute('data-original-src', href);
            img.style.opacity = '0.5'; // 初始加载状态
            if (title) {
                img.title = title;
            }
            return img.outerHTML;
        };

        // 1. 块级公式扩展 ($$ ... $$)
        const blockMath = {
            name: "blockMath",
            level: "block",
            start(src) {
                return src.indexOf("$$");
            },
            tokenizer(src, tokens) {
                const cap = /^\$\$([\s\S]+?)\$\$/.exec(src);
                if (cap) {
                    return {
                        type: "blockMath",
                        raw: cap[0],
                        text: cap[1].trim(),
                    };
                }
            },
            renderer(token) {
                return `<div class="katex-display-wrapper">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
            },
        };

        // 2. 行内公式扩展 ($ ... $)
        const inlineMath = {
            name: "inlineMath",
            level: "inline",
            start(src) {
                return src.indexOf("$");
            },
            tokenizer(src, tokens) {
                const cap = /^\$((?:[^\$]|\\\$)+?)\$/.exec(src);
                if (cap) {
                    return {
                        type: "inlineMath",
                        raw: cap[0],
                        text: cap[1].trim(),
                    };
                }
            },
            renderer(token) {
                return katex.renderToString(token.text, {
                    displayMode: false,
                    throwOnError: false,
                });
            },
        };

        marked.use({ renderer, extensions: [blockMath, inlineMath] });

        // 配置 marked 全局选项
        marked.setOptions({
            highlight: function (code, lang) {
                if (window.Prism && Prism.languages[lang]) {
                    return Prism.highlight(code, Prism.languages[lang], lang);
                }
                return code;
            },
            breaks: true,
            gfm: true,
        });

        this.bindEvents();
        this.initFab();
        if (this.configManager.isValid()) {
            this.refreshData();
        } else {
            this.showSettings();
        }
    }

    bindEvents() {
        this.dom.sidebarLogo.onclick = () => this.showHome();

        document.getElementById("themeToggleBtn").onclick = () => {
            this.toggleThemePanel();
        };

        document.getElementById("refreshBtn").onclick = () => {
            this.dataManager.treeData = null;
            this.refreshData();
        };
        document.getElementById("settingsBtn").onclick = () =>
            this.showSettings();
        document.getElementById("settingsCloseBtn").onclick = () =>
            this.hideModal();
        document.getElementById("githubBtn").onclick = () => {
            window.open(this.configManager.getRepoUrl(), "_blank");
        };

        // Token 显示/隐藏切换
        const tokenToggleBtn = document.getElementById("tokenToggleBtn");
        const tokenInput = document.getElementById("githubToken");
        const eyeOpen = tokenToggleBtn.querySelector(".eye-open");
        const eyeClosed = tokenToggleBtn.querySelector(".eye-closed");
        tokenToggleBtn.onclick = () => {
            const isPassword = tokenInput.type === "password";
            tokenInput.type = isPassword ? "text" : "password";
            eyeOpen.style.display = isPassword ? "none" : "block";
            eyeClosed.style.display = isPassword ? "block" : "none";
        };

        this.dom.searchInput.oninput = (e) =>
            this.handleSearch(e.target.value);

        const toggleSidebar = () => {
            if (window.innerWidth <= 1024) {
                this.dom.sidebar.classList.toggle("open");
                this.dom.mobileOverlay.classList.toggle("active");
            } else {
                this.dom.sidebar.classList.toggle("collapsed");
            }
        };
        document.getElementById("mobileMenuBtn").onclick = toggleSidebar;
        this.dom.mobileOverlay.onclick = toggleSidebar;

        // 配置面板自动填充 Token 逻辑
        const autoFillToken = () => {
            const u = document.getElementById("githubUsername").value.trim();
            const r = document.getElementById("githubRepo").value.trim();
            if (u && r) {
                const key = `${u}/${r}`.toLowerCase();
                const token = this.configManager.tokens[key] || "";
                document.getElementById("githubToken").value = token;
            }
        };
        document.getElementById("githubUsername").oninput = autoFillToken;
        document.getElementById("githubRepo").oninput = autoFillToken;

        document.getElementById("settingsSave").onclick = () =>
            this.saveSettings();
        document.getElementById("settingsCancel").onclick = () =>
            this.hideModal();

        window.onhashchange = () => this.handleRouting();

        window.addEventListener("resize", () => {
            if (window.innerWidth > 1024) {
                this.dom.sidebar.classList.remove("open");
                this.dom.mobileOverlay.classList.remove("active");
            }
        });

        document.getElementById("importUrlBtn").onclick = () => {
            const input = document.getElementById("importUrlInput");
            const urlStr = input.value.trim();
            if (!urlStr) {
                this.showToast("请输入 GitHub 仓库链接");
                return;
            }

            const urlCfg = this.configManager.autoDetectFromUrl(urlStr);
            if (urlCfg) {
                document.getElementById("githubUsername").value =
                    urlCfg.username;
                document.getElementById("githubRepo").value = urlCfg.repo;
                document.getElementById("githubPath").value = urlCfg.path || "";
                // 导入后清空输入框
                input.value = "";
                this.showToast("解析成功：已自动填充配置");
            } else {
                this.showToast("无法识别该链接，请检查格式");
            }
        };

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.hideModal();
                this.dom.sidebar.classList.remove("open");
                this.dom.mobileOverlay.classList.remove("active");
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                e.preventDefault();
                this.dom.searchInput.focus();
            }
        });

        // 面包屑链接点击处理
        this.dom.toolbarTitle.addEventListener("click", (e) => {
            const link = e.target.closest(".breadcrumb-link");
            if (link) {
                e.preventDefault();
                const dirPath = link.dataset.path;
                this.navigateToDirectory(dirPath);
            }
        });

        // 目录项点击处理（事件委托）
        this.dom.contentArea.addEventListener("click", (e) => {
            const dirItem = e.target.closest(".dir-item");
            if (dirItem) {
                const path = dirItem.dataset.path;
                const type = dirItem.dataset.type;

                if (type === "folder") {
                    this.navigateToDirectory(path);
                } else if (type === "file") {
                    // 查找文件节点并打开
                    const findFile = (nodes, filePath) => {
                        for (const node of nodes) {
                            if (node.path === filePath) return node;
                            if (node.children && node.children.length) {
                                const found = findFile(node.children, filePath);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    const fileNode = findFile(this.dataManager.treeData || [], path);
                    if (fileNode) {
                        this.setActiveFile(fileNode, true);
                    }
                }
            }
        });
    }

    showToast(msg, duration = 3000) {
        const toast = document.getElementById("toast");
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(
            () => toast.classList.remove("show"),
            duration,
        );
    }

    showSettings() {
        const cfg = this.configManager.config;
        document.getElementById("githubUsername").value = cfg.username || "";
        document.getElementById("githubRepo").value = cfg.repo || "";
        document.getElementById("githubPath").value = cfg.path || "";
        document.getElementById("githubToken").value = cfg.token || "";
        this.dom.settingsModal.classList.add("active");
    }

    hideModal() {
        this.dom.settingsModal.classList.remove("active");
    }

    saveSettings() {
        const username = document
            .getElementById("githubUsername")
            .value.trim();
        const repo = document.getElementById("githubRepo").value.trim();
        const path = document.getElementById("githubPath").value.trim();
        const token = document.getElementById("githubToken").value.trim();

        if (!username || !repo) {
            this.showToast("用户名和仓库名为必填项");
            return;
        }

        this.configManager.saveConfig({ username, repo, path, token });
        this.hideModal();

        // 核心修复：强制清空旧数据并重新拉取
        this.dataManager.treeData = null;

        // 更新 URL Hash（包含根目录路径）
        let newHash = `#/${username}/${repo}`;
        if (path) {
            const cleanPath = path.replace(/^\/+|\/+$/g, "");
            if (cleanPath) newHash += `/${cleanPath}`;
        }

        if (window.location.hash !== newHash) {
            window.location.hash = newHash;
        }
        this.refreshData();
    }

    async refreshData() {
        this.dom.navTree.innerHTML = `
            <div class="empty-state">
                <div class="loading-spinner" style="margin-bottom: 16px;"></div>
                <p style="font-family: var(--font-mono); letter-spacing: 0.5px;">INDEXING...</p>
            </div>
        `;
        try {
            const tree = await this.dataManager.getFullTree();
            this.renderTree(this.dom.navTree, tree);
            this.showToast("数据同步成功");
            // 数据加载完成后，根据 URL 路由到具体文件
            this.handleRouting();
        } catch (e) {
            let helpfulMessage = e.message;
            let showSettingsBtn = true;

            if (e.type === "NOT_FOUND_OR_PRIVATE") {
                helpfulMessage =
                    "<b>找不到仓库</b><br>可能是拼写错误，或者是私有仓库（需在配置中设置 Token）";
            } else if (e.type === "AUTH_REQUIRED") {
                helpfulMessage =
                    "<b>Token 验证失败</b><br>请检查配置中的 Token 是否正确";
            }

            this.dom.navTree.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 24px; margin-bottom: 12px;">🔒</div>
                    <p style="color: #ef4444;">${helpfulMessage}</p>
                    ${showSettingsBtn ? '<button class="btn primary" onclick="document.getElementById(\'settingsBtn\').click()" style="margin-top:16px; width: 100%;">前往配置</button>' : ""}
                </div>
            `;
        }
    }

    handleRouting() {
        let hash = window.location.hash.slice(1);
        const { username, repo, path } = this.configManager.config;

        // 如果 Hash 为空且已有选定仓库，自动补全 Hash 以保持 URL 状态（包含根目录路径）
        if (!hash && username && repo) {
            let targetHash = `#/${username}/${repo}`;
            if (path) {
                // 确保路径格式正确，去掉多余斜杠
                const cleanPath = path.replace(/^\/+|\/+$/g, "");
                if (cleanPath) targetHash += `/${cleanPath}`;
            }
            window.location.hash = targetHash;
            return;
        }

        if (!hash) {
            this.showHome(true);
            return;
        }

        try {
            hash = decodeURIComponent(hash);
        } catch (e) {
            console.error("Malformed URI", e);
        }

        if (!hash.startsWith("/")) {
            this.showHome(true);
            return;
        }

        const parts = hash.split("/").filter((p) => p);
        if (parts.length < 2) return;

        const hashUser = parts[0];
        const hashRepo = parts[1];
        const currentCfg = this.configManager.config;

        // 核心改进：检测是否切换了仓库
        if (
            hashUser !== currentCfg.username ||
            hashRepo !== currentCfg.repo
        ) {
            console.log(
                `切换仓库: ${currentCfg.username}/${currentCfg.repo} -> ${hashUser}/${hashRepo}`,
            );
            // 更新当前配置
            this.configManager.config.username = hashUser;
            this.configManager.config.repo = hashRepo;
            this.configManager.config.path = ""; // 切换仓库时默认清空子路径

            // 自动加载该仓库对应的 Token
            this.configManager.loadTokenForRepo();

            this.dataManager.treeData = null;
            this.refreshData();
            return;
        }

        if (parts.length <= 2) {
            this.showHome(true);
            return;
        }

        const filePath = parts.slice(2).join("/");

        // 如果路径正好等于配置的根路径，视为首页
        const cleanConfigPath = path
            ? path.replace(/^\/+|\/+$/g, "")
            : "";
        if (filePath === cleanConfigPath) {
            this.showHome(true);
            return;
        }

        // 在树中寻找该文件
        const findFile = (nodes) => {
            for (const node of nodes) {
                if (node.path === filePath) return node;
                if (node.children && node.children.length) {
                    const found = findFile(node.children);
                    if (found) return found;
                }
            }
            return null;
        };

        const tree = this.dataManager.treeData || [];
        const targetNode = findFile(tree);
        if (targetNode) {
            if (targetNode.type === "file") {
                this.setActiveFile(targetNode, true);
            } else {
                // 如果是文件夹，使用目录视图
                this.navigateToDirectory(targetNode.path);
            }
        } else {
            // 如果在当前树中找不到，可能是还没加载完或者路径不对
            console.warn("未在目录树中找到路径:", filePath);
        }
    }

    showHome(isSilent = false) {
        if (!isSilent) {
            const { username, repo, path } = this.configManager.config;
            if (username && repo) {
                let targetHash = `#/${username}/${repo}`;
                if (path) {
                    const cleanPath = path.replace(/^\/+|^\/+$/g, "");
                    if (cleanPath) targetHash += `/${cleanPath}`;
                }
                if (window.location.hash !== targetHash) {
                    window.location.hash = targetHash;
                    return;
                }
            } else {
                const url = new URL(window.location.href);
                history.pushState(null, "", url.pathname + url.search);
            }
        }

        this.dom.searchInput.value = "";
        this.handleSearch("");

        this.dom.toolbarTitle.textContent = "选择一个笔记";
        document
            .querySelectorAll(".nav-item-content")
            .forEach((el) => {
                el.classList.remove("active");
            });

        this.dom.contentArea.innerHTML = `
            <div class="empty-state">
                <div
                    class="logo"
                    style="
                        font-size: 24px;
                        margin-bottom: 16px;
                        opacity: 0.5;
                    "
                >
                    NOTES
                </div>
                <p>从左侧目录选择一个 Markdown 文件开始阅读</p>
            </div>
        `;
    }

    revealInTree(targetPath) {
        // 1. 清除所有高亮
        document
            .querySelectorAll(".nav-item-content")
            .forEach((el) => el.classList.remove("active"));

        const parts = targetPath.split("/");
        let currentPath = "";

        // 2. 逐层寻找并展开文件夹
        for (let i = 0; i < parts.length; i++) {
            currentPath = currentPath
                ? `${currentPath}/${parts[i]}`
                : parts[i];
            const el = document.querySelector(
                `.nav-item-content[data-path="${currentPath}"]`,
            );

            if (el) {
                if (i < parts.length - 1) {
                    // 是中间文件夹路径
                    const childrenDiv =
                        el.parentElement.querySelector(".nav-children");
                    if (
                        childrenDiv &&
                        !childrenDiv.classList.contains("show")
                    ) {
                        // 仅在未展开时模拟点击（触发 renderTree 和样式切换）
                        el.click();
                    }
                } else {
                    // 已经到达目标文件
                    el.classList.add("active");
                    // 确保在视口可见
                    el.scrollIntoView({
                        block: "nearest",
                        behavior: "smooth",
                    });
                }
            }
        }
    }

    navigateToDirectory(dirPath) {
        // 在树中查找目录节点
        const findDirectory = (nodes, path) => {
            for (const node of nodes) {
                if (node.path === path) return node;
                if (node.children && node.children.length) {
                    const found = findDirectory(node.children, path);
                    if (found) return found;
                }
            }
            return null;
        };

        const tree = this.dataManager.treeData || [];
        const dirNode = findDirectory(tree, dirPath);

        if (dirNode && dirNode.type === "folder") {
            // 展开并高亮该目录
            this.revealInTree(dirPath);

            // 构建面包屑
            const pathParts = dirPath.split("/");
            const breadcrumbHtml = pathParts
                .map((part, index) => {
                    const subPath = pathParts.slice(0, index + 1).join("/");
                    return `<a href="#" class="breadcrumb-link" data-path="${subPath}">${part}</a>`;
                })
                .join(" / ");
            this.dom.toolbarTitle.innerHTML = breadcrumbHtml;

            // 统计文件数量
            const children = dirNode.children || [];
            const fileCount = children.filter(c => c.type === "file").length;
            const folderCount = children.filter(c => c.type === "folder").length;

            // 生成目录列表
            const itemsHtml = children.map(child => {
                const itemCount = child.type === "folder" && child.children
                    ? child.children.filter(c => c.type === "file").length
                    : null;
                const itemCountText = itemCount !== null
                    ? `<span class="dir-item-count">${itemCount} 个文件</span>`
                    : "";

                return `
                    <div class="dir-item" data-path="${child.path}" data-type="${child.type}">
                        <span class="dir-item-icon">${child.type === "folder" ? "▶" : "•"}</span>
                        <span class="dir-item-name">${child.name}</span>
                        ${itemCountText}
                    </div>
                `;
            }).join("");

            // 显示目录内容
            this.dom.contentArea.innerHTML = `
                <div class="directory-view">
                    <div class="dir-header">
                        <h1 class="dir-title">${dirNode.name}</h1>
                        <p class="dir-stats">${folderCount} 个文件夹，${fileCount} 个文件</p>
                    </div>
                    <div class="dir-list">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }
    }

    renderTree(container, items, level = 0) {
        if (level === 0) container.innerHTML = "";

        items.forEach((item) => {
            const div = document.createElement("div");
            div.className = "nav-item";

            const isFolder = item.type === "folder";
            div.innerHTML = `
                <div class="nav-item-content" data-path="${item.path}" style="padding-left: ${16 + level * 12}px">
                    <span class="nav-toggle">${isFolder ? "▶" : "•"}</span>
                    <span class="nav-text" title="${item.name}">${item.name}</span>
                </div>
                ${isFolder ? '<div class="nav-children"></div>' : ""}
            `;

            const content = div.querySelector(".nav-item-content");
            if (isFolder) {
                const childrenDiv = div.querySelector(".nav-children");
                const toggle = div.querySelector(".nav-toggle");

                content.onclick = (e) => {
                    e.stopPropagation();
                    const isExpanded =
                        childrenDiv.classList.contains("show");
                    if (isExpanded) {
                        childrenDiv.classList.remove("show");
                        toggle.classList.remove("expanded");
                    } else {
                        if (
                            childrenDiv.innerHTML === "" &&
                            item.children.length > 0
                        ) {
                            this.renderTree(
                                childrenDiv,
                                item.children,
                                level + 1,
                            );
                        }
                        childrenDiv.classList.add("show");
                        toggle.classList.add("expanded");

                        // 更新 URL Hash 以反映当前选定的文件夹
                        const { username, repo } =
                            this.configManager.config;
                        const newHash = `#/${username}/${repo}/${item.path}`;
                        if (window.location.hash !== newHash) {
                            history.pushState(null, "", newHash);
                        }
                    }
                };
            } else {
                content.onclick = (e) => {
                    e.stopPropagation();
                    this.setActiveFile(item);
                };
            }
            container.appendChild(div);
        });
    }

    async setActiveFile(item, isSilent = false) {
        const { username, repo } = this.configManager.config;

        // 1. 更新 URL Hash
        if (!isSilent) {
            const newHash = `#/${username}/${repo}/${item.path}`;
            if (window.location.hash !== newHash) {
                history.pushState(null, "", newHash);
            }
        }

        // 2. UI 状态更新：面包屑（可点击路径）
        this.revealInTree(item.path);
        const pathParts = item.path.split("/");
        const breadcrumbHtml = pathParts
            .map((part, index) => {
                if (index === pathParts.length - 1) {
                    return `<span>${part.replace(/\.md$/, "")}</span>`;
                }
                const dirPath = pathParts.slice(0, index + 1).join("/");
                return `<a href="#" class="breadcrumb-link" data-path="${dirPath}">${part}</a> / `;
            })
            .join("");
        this.dom.toolbarTitle.innerHTML = breadcrumbHtml;

        if (window.innerWidth <= 1024) {
            this.dom.sidebar.classList.remove("open");
            this.dom.mobileOverlay.classList.remove("active");
        }

        // 3. 平滑加载：显示进度条，不清空内容
        this.dom.loadingBar.classList.remove("no-transition");
        this.dom.loadingBar.style.width = "30%";

        try {
            const raw = await this.dataManager.getRawContent(item);
            this.dom.loadingBar.style.width = "70%";

            // 渲染并替换内容
            this.renderMarkdown(raw, item.path);

            this.dom.contentViewport.scrollTop = 0;
            this.dom.loadingBar.style.width = "100%";
        } catch (e) {
            this.dom.contentArea.innerHTML = `<div class="empty-state"><p style="color:#ef4444">加载内容失败: ${e.message}</p></div>`;
            this.dom.loadingBar.style.width = "0";
        } finally {
            setTimeout(() => {
                this.dom.loadingBar.classList.add("no-transition");
                this.dom.loadingBar.style.width = "0";
                // 强制重绘
                void this.dom.loadingBar.offsetWidth;
                this.dom.loadingBar.classList.remove("no-transition");
            }, 450); // 略长于 transition 时间
        }
    }

    renderMarkdown(md, filePath) {
        // 保存原始 Markdown
        this.currentRawMarkdown = md;

        this.dom.contentArea.innerHTML = `<div class="markdown-body">${marked.parse(md)}</div>`;

        if (window.Prism) {
            this.dom.contentArea
                .querySelectorAll("pre code")
                .forEach((block) => {
                    Prism.highlightElement(block);
                });
        }

        // 添加代码复制按钮
        this.addCodeCopyButtons();

        // 处理图片加载
        if (this.imageCache) {
            this.loadImages(filePath);
        }
    }

    /**
     * 为所有代码块添加复制按钮
     */
    addCodeCopyButtons() {
        const codeBlocks = this.dom.contentArea.querySelectorAll("pre");
        codeBlocks.forEach((pre) => {
            // 跳过已有复制按钮的代码块
            if (pre.querySelector('.code-copy-btn')) {
                return;
            }

            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.type = 'button';
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
            `;

            copyBtn.onclick = async () => {
                const code = pre.querySelector('code');
                const text = code.textContent;

                try {
                    await navigator.clipboard.writeText(text);
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    // 降级方案：使用传统的复制方法
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    } catch (e) {
                        console.error('复制失败:', e);
                    }
                    document.body.removeChild(textarea);
                }
            };

            pre.appendChild(copyBtn);
        });
    }

    /**
     * 处理 Markdown 中的所有图片
     * @param {string} mdContentPath - 当前 Markdown 文件的路径
     */
    async loadImages(mdContentPath) {
        const images = this.dom.contentArea.querySelectorAll('img');

        // 使用 Promise.allSettled 并发加载多张图片
        const promises = Array.from(images).map(img =>
            this.loadSingleImage(img, mdContentPath)
        );

        await Promise.allSettled(promises);
    }

    /**
     * 加载单张图片（带缓存和错误处理）
     * @param {HTMLImageElement} img - img 元素
     * @param {string} mdContentPath - Markdown 文件路径
     */
    async loadSingleImage(img, mdContentPath) {
        const { username, repo, token } = this.configManager.config;
        // 获取原始路径（来自 data-original-src 属性）
        const originalSrc = img.getAttribute('data-original-src') || img.src;
        let imagePath = null;

        // 1. 先判断图片类型，决定是否需要处理

        // Base64 内嵌图片，保持原样，不处理
        if (originalSrc.startsWith('data:')) {
            return;
        }

        // 外部完整 URL
        if (originalSrc.startsWith('http://') || originalSrc.startsWith('https://')) {
            // 检查是否为 GitHub raw 图片
            if (originalSrc.includes('raw.githubusercontent.com')) {
                // 提取图片路径
                const match = originalSrc.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
                if (match) {
                    imagePath = match[1];
                }
            } else {
                // 非 GitHub 外部图片（如 placehold.co），直接使用原始 URL
                img.src = originalSrc;
                img.style.opacity = '1';
                img.alt = text || originalSrc;
                console.log('[ImageLoader] 外部图片:', originalSrc);
                return;
            }
        }

        // 相对路径，转换为完整路径
        if (!imagePath) {
            if (originalSrc.startsWith('http://') || originalSrc.startsWith('https://') || originalSrc.startsWith('data:')) {
                // 已经处理过但没提取到路径，跳过
                return;
            }
            const mdDir = mdContentPath.split('/').slice(0, -1).join('/');
            imagePath = mdDir ? `${mdDir}/${originalSrc}` : originalSrc;
        }

        // 无法解析的路径，保持原样
        if (!imagePath) {
            return;
        }

        // 2. 只处理需要缓存的图片（内部图片、GitHub 图片），显示加载状态
        img.style.opacity = '0.5';
        img.alt = '加载中...';

        try {
            // 3. 先查缓存
            const cacheKey = this._getCacheKey(imagePath);
            const cached = await this.imageCache.get(cacheKey);

            if (cached) {
                // 缓存命中
                const blobUrl = URL.createObjectURL(cached);
                this._trackBlobUrl(blobUrl);
                img.src = blobUrl;
                img.style.opacity = '1';
                img.alt = imagePath.split('/').pop();
                console.log('[ImageLoader] 缓存命中:', imagePath);
                return;
            }

            // 4. 缓存未命中，加载数据
            console.log('[ImageLoader] 加载图片:', imagePath);
            const blob = await this.dataManager.getImageContent(imagePath);

            // 5. 存入缓存
            await this.imageCache.set(cacheKey, blob);

            // 6. 更新图片
            const blobUrl = URL.createObjectURL(blob);
            this._trackBlobUrl(blobUrl);
            img.src = blobUrl;
            img.style.opacity = '1';
            img.alt = imagePath.split('/').pop();

        } catch (error) {
            // 加载失败处理
            img.alt = `图片加载失败\n${imagePath}`;
            img.style.opacity = '0.3';
            img.style.border = '1px dashed var(--border-color)';
            img.style.padding = '8px';
            img.style.minHeight = '100px';
            img.style.background = 'var(--bg-secondary)';
            console.error('[ImageLoader]', imagePath, error.message);
        }
    }

    /**
     * 生成缓存键
     * @private
     * @param {string} imagePath - 图片路径
     * @returns {string} 缓存键
     */
    _getCacheKey(imagePath) {
        const { username, repo } = this.configManager.config;
        return `${username}/${repo}/${imagePath}`;
    }

    /**
     * 跟踪 Blob URL 用于内存管理
     * @private
     * @param {string} blobUrl - Blob URL
     */
    _trackBlobUrl(blobUrl) {
        this.blobUrls.add(blobUrl);

        // 限制内存中的 Blob URL 数量，避免内存泄漏
        if (this.blobUrls.size > 50) {
            const urlsToRevoke = Array.from(this.blobUrls).slice(0, 20);
            urlsToRevoke.forEach(url => {
                URL.revokeObjectURL(url);
                this.blobUrls.delete(url);
            });
        }
    }

    /**
     * 清理所有 Blob URL（页面卸载时调用）
     */
    cleanupBlobUrls() {
        this.blobUrls.forEach(url => URL.revokeObjectURL(url));
        this.blobUrls.clear();
    }

    handleSearch(query) {
        query = query.toLowerCase().trim();
        if (!query) {
            this.searchMode = false;
            if (this.dataManager.treeData) {
                this.renderTree(this.dom.navTree, this.dataManager.treeData);
            }
            return;
        }

        this.searchMode = true;
        const results = [];
        const flatten = (nodes) => {
            nodes.forEach((n) => {
                if (n.type === "file" && n.name.toLowerCase().includes(query)) {
                    results.push(n);
                }
                if (n.children.length) flatten(n.children);
            });
        };
        flatten(this.dataManager.treeData || []);

        this.renderSearchResults(results);
    }

    renderSearchResults(results) {
        this.dom.navTree.innerHTML = results.length
            ? ""
            : '<div class="empty-state"><p>未找到相关笔记</p></div>';
        results.forEach((item) => {
            const div = document.createElement("div");
            div.className = "nav-item";
            const dirPath = item.path.split("/").slice(0, -1).join("/");

            div.innerHTML = `
                <div class="nav-item-content" data-path="${item.path}" style="padding: 10px 16px; flex-direction: column; align-items: flex-start; gap: 2px;">
                    <div class="nav-text" style="color: var(--text-primary); font-weight: 500;">${item.name}</div>
                    <div style="font-size: 11px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">
                        ${dirPath || "/"}
                    </div>
                </div>
            `;
            div.querySelector(".nav-item-content").onclick = () =>
                this.setActiveFile(item);
            this.dom.navTree.appendChild(div);
        });
    }

    // ========== 主题面板相关方法 ==========

    initThemePanelEvents() {
        const themePanel = document.getElementById("themePanel");
        const themeOverlay = document.getElementById("themePanelOverlay");
        const closeBtn = document.getElementById("themeCloseBtn");

        // 关闭面板
        const closePanel = () => {
            themePanel.classList.remove("active");
            themeOverlay.classList.remove("active");
        };

        closeBtn.onclick = closePanel;
        themeOverlay.onclick = closePanel;

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && themePanel.classList.contains('active')) {
                closePanel();
            }
        });

        // 模式切换
        const modeButtons = document.querySelectorAll('.theme-mode-btn');
        modeButtons.forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                this.switchThemeMode(mode);
            };
        });

        // 颜色选择
        const colorButtons = document.querySelectorAll('.theme-color-btn');
        colorButtons.forEach(btn => {
            btn.onclick = () => {
                const color = btn.dataset.color;
                this.switchThemeColor(color);
            };
        });
    }

    toggleThemePanel() {
        const themePanel = document.getElementById("themePanel");
        const themeOverlay = document.getElementById("themePanelOverlay");

        // 首次打开时初始化事件
        if (!this._themePanelInitialized) {
            this.initThemePanelEvents();
            this._themePanelInitialized = true;
        }

        themePanel.classList.toggle("active");
        themeOverlay.classList.toggle("active");

        // 打开时更新按钮状态
        if (themePanel.classList.contains('active')) {
            this.updateThemePanelUI();
        }
    }

    updateThemePanelUI() {
        const config = this.configManager.getThemeConfig();

        // 更新模式按钮状态
        document.querySelectorAll('.theme-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === config.mode);
        });

        // 更新颜色按钮状态
        document.querySelectorAll('.theme-color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === config.color);
        });

        // 更新颜色预览（根据当前模式调整）
        document.querySelectorAll('.theme-color-btn').forEach(btn => {
            const color = btn.dataset.color;
            const accentColor = this.getAccentColor(config.mode, color);
            btn.style.setProperty('--preview', accentColor);
        });
    }

    switchThemeMode(mode) {
        const config = this.configManager.getThemeConfig();
        this.configManager.setTheme(mode, config.color);
        this.updateThemePanelUI();
    }

    switchThemeColor(color) {
        const config = this.configManager.getThemeConfig();
        this.configManager.setTheme(config.mode, color);
        this.updateThemePanelUI();
    }

    getAccentColor(mode, color) {
        const colors = {
            light: {
                blue: '#002fa7',
                green: '#059669',
                purple: '#7c3aed',
                orange: '#ea580c',
                red: '#dc2626',
                pink: '#db2777',
                rose: '#e11d48'
            },
            dark: {
                blue: '#60a5fa',
                green: '#34d399',
                purple: '#a78bfa',
                orange: '#fb923c',
                red: '#f87171',
                pink: '#f472b6',
                rose: '#fb7185'
            }
        };
        return colors[mode][color];
    }

    // ========== FAB 浮动操作按钮相关方法 ==========

    /**
     * 初始化 FAB 浮动操作按钮
     */
    initFab() {
        const fabContainer = document.querySelector('.fab-container');
        const fabMain = document.querySelector('.fab-main');
        const fabItems = document.querySelectorAll('.fab-item');

        // 主按钮点击
        fabMain.addEventListener('click', (e) => {
            e.stopPropagation();
            fabContainer.classList.toggle('open');

            // 切换图标
            const menuIcon = fabMain.querySelector('.fab-icon-menu');
            const closeIcon = fabMain.querySelector('.fab-icon-close');
            if (fabContainer.classList.contains('open')) {
                menuIcon.style.display = 'none';
                closeIcon.style.display = 'block';
            } else {
                menuIcon.style.display = 'block';
                closeIcon.style.display = 'none';
            }
        });

        // 子按钮点击
        fabItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;

                switch (action) {
                    case 'copy-md':
                        this.copyMarkdown(item);
                        break;
                    case 'scroll-top':
                        this.scrollToTop();
                        break;
                    case 'scroll-bottom':
                        this.scrollToBottom();
                        break;
                }

                // 执行后自动收起
                fabContainer.classList.remove('open');
                const menuIcon = fabMain.querySelector('.fab-icon-menu');
                const closeIcon = fabMain.querySelector('.fab-icon-close');
                menuIcon.style.display = 'block';
                closeIcon.style.display = 'none';
            });
        });

        // 点击外部收起
        document.addEventListener('click', (e) => {
            if (!fabContainer.contains(e.target)) {
                fabContainer.classList.remove('open');
                const menuIcon = fabMain.querySelector('.fab-icon-menu');
                const closeIcon = fabMain.querySelector('.fab-icon-close');
                menuIcon.style.display = 'block';
                closeIcon.style.display = 'none';
            }
        });
    }

    /**
     * 复制当前笔记的 Markdown 原文
     */
    async copyMarkdown(buttonElement) {
        if (!this.currentRawMarkdown) {
            console.warn('没有可复制的内容');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.currentRawMarkdown);

            // 显示复制成功状态
            buttonElement.classList.add('copied');
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;

            setTimeout(() => {
                buttonElement.classList.remove('copied');
                buttonElement.innerHTML = originalHTML;
            }, 2000);

        } catch (err) {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = this.currentRawMarkdown;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                document.execCommand('copy');
                buttonElement.classList.add('copied');
                setTimeout(() => {
                    buttonElement.classList.remove('copied');
                }, 2000);
            } catch (e) {
                console.error('复制失败:', e);
            }

            document.body.removeChild(textarea);
        }
    }

    /**
     * 滚动到内容顶部
     */
    scrollToTop() {
        this.dom.contentViewport.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * 滚动到内容底部
     */
    scrollToBottom() {
        this.dom.contentViewport.scrollTo({
            top: this.dom.contentViewport.scrollHeight,
            behavior: 'smooth'
        });
    }
}
