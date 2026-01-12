/**
 * 数据交互模块
 * 负责与 GitHub API 通信，获取仓库内容和文件数据
 */
export class DataManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.cache = new Map();
    this.treeData = null; // 存储转换后的树形结构
    this.isIndexing = false;
  }

  get headers() {
    const h = { Accept: "application/vnd.github.v3+json" };
    if (this.configManager.config.token) {
      h["Authorization"] = `token ${this.configManager.config.token}`;
    }
    return h;
  }

  // 核心改进：一次性获取全库结构并转换为树形
  async getFullTree() {
    if (this.treeData) return this.treeData;

    const { username, repo, path: rootPath } = this.configManager.config;
    // HEAD 代表默认分支
    const url = `https://api.github.com/repos/${username}/${repo}/git/trees/HEAD?recursive=1`;

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      let errorType = "FETCH_ERROR";
      let errorMsg = `请求失败 (代码: ${res.status})`;

      if (res.status === 401) {
        errorType = "AUTH_REQUIRED";
        errorMsg = "Token 无效或已过期";
      } else if (res.status === 404) {
        // 404 对于 GitHub 来说，也可能是私有仓库但没有 Token
        errorType = "NOT_FOUND_OR_PRIVATE";
        errorMsg = "找不到仓库，或该仓库是私有的需设置 Token";
      } else if (res.status === 403) {
        errorType = "RATE_LIMIT_OR_FORBIDDEN";
        errorMsg = "访问受限：权限不足或触发 API 限流";
      }

      const err = new Error(errorMsg);
      err.type = errorType;
      err.status = res.status;
      throw err;
    }

    const data = await res.json();

    // 1. 过滤出目标路径下的 .md 文件和文件夹
    let rawItems = data.tree.filter((item) => {
      // 如果设置了根路径，则只处理该路径下的文件
      if (rootPath && !item.path.startsWith(rootPath)) return false;
      // 只要文件夹和 .md 文件
      return item.type === "tree" || item.path.toLowerCase().endsWith(".md");
    });

    // 2. 将扁平路径转换为嵌套树结构
    this.treeData = this.buildTree(rawItems, rootPath);
    return this.treeData;
  }

  buildTree(items, rootPath) {
    const result = [];
    const map = { "": { children: result } };

    // 排序确保父级在子级之前
    items.sort((a, b) => a.path.length - b.path.length);

    // 先收集所有包含 md 文件的路径
    const mdFilePaths = new Set();
    items.forEach((item) => {
      if (item.type === "blob" && item.path.toLowerCase().endsWith(".md")) {
        mdFilePaths.add(item.path);
      }
    });

    // 判断文件夹是否包含 md 文件（直接或间接）
    const hasMdFile = (folderPath) => {
      for (const mdPath of mdFilePaths) {
        if (mdPath.startsWith(folderPath + "/")) {
          return true;
        }
      }
      return false;
    };

    items.forEach((item) => {
      const path = item.path;
      // 如果有 rootPath，计算相对路径
      const relativePath = rootPath
        ? path.replace(new RegExp(`^${rootPath}/?`), "")
        : path;
      if (!relativePath) return;

      // 跳过不包含任何 md 文件的文件夹
      if (item.type === "tree" && !hasMdFile(path)) {
        return;
      }

      const parts = relativePath.split("/");
      const name = parts.pop();
      const parentPath = parts.join("/");

      const node = {
        name: name.replace(/\.md$/, ""),
        path: path,
        type: item.type === "tree" ? "folder" : "file",
        children: [],
        download_url:
          item.type === "blob"
            ? `https://raw.githubusercontent.com/${this.configManager.config.username}/${this.configManager.config.repo}/HEAD/${path}`
            : null,
      };

      if (map[parentPath]) {
        map[parentPath].children.push(node);
      } else {
        // 兜底：如果找不到父级（可能父级被过滤了），放根部
        result.push(node);
      }

      if (item.type === "tree") {
        map[relativePath] = node;
      }
    });

    // 排序：文件夹在前，文件名在后
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((n) => {
        if (n.children.length) sortNodes(n.children);
      });
    };
    sortNodes(result);

    return result;
  }

  async getRawContent(item) {
    const { username, repo } = this.configManager.config;
    const hasToken = !!this.configManager.config.token;

    // 如果有 Token (私有仓库)，必须通过 API 域名获取，否则会触发 CORS 错误
    if (hasToken) {
      const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${item.path}`;
      const res = await fetch(apiUrl, {
        headers: {
          ...this.headers,
          Accept: "application/vnd.github.v3.raw", // 关键：要求返回原始文本而非 JSON
        },
      });
      if (!res.ok) throw new Error(`API 错误: ${res.status}`);
      return await res.text();
    } else {
      // 公有仓库直接走 raw 域名，不带任何 Headers 避免跨域问题
      const res = await fetch(item.download_url);
      if (!res.ok) throw new Error(`文件获取失败: ${res.status}`);
      return await res.text();
    }
  }

  /**
   * 获取图片内容（返回 Blob）
   * @param {string} imagePath - 图片相对于仓库根目录的路径
   * @returns {Promise<Blob>} 图片数据
   */
  async getImageContent(imagePath) {
    const { username, repo } = this.configManager.config;
    const hasToken = !!this.configManager.config.token;

    // 获取默认分支名（首次调用时缓存）
    if (!this.defaultBranch) {
      await this._fetchDefaultBranch();
    }
    const branch = this.defaultBranch || 'main';

    if (hasToken) {
      // 私有仓库：通过 GitHub API 获取
      const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${imagePath}?ref=${branch}`;
      const res = await fetch(apiUrl, {
        headers: {
          ...this.headers,
          Accept: "application/vnd.github.v3.raw", // 返回原始二进制
        },
      });

      if (!res.ok) {
        throw new Error(`图片加载失败 (${res.status}): ${imagePath}`);
      }

      return await res.blob();
    } else {
      // 公有仓库：从 raw.githubusercontent.com 获取
      const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${imagePath}`;
      const res = await fetch(rawUrl);

      if (!res.ok) {
        throw new Error(`图片加载失败 (${res.status}): ${imagePath}`);
      }

      return await res.blob();
    }
  }

  /**
   * 获取仓库的默认分支名
   * @private
   */
  async _fetchDefaultBranch() {
    const { username, repo } = this.configManager.config;
    try {
      const res = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
        headers: this.headers
      });
      if (res.ok) {
        const data = await res.json();
        this.defaultBranch = data.default_branch;
        console.log('[DataManager] 默认分支:', this.defaultBranch);
      }
    } catch (e) {
      console.warn('[DataManager] 获取默认分支失败，使用 main:', e.message);
      this.defaultBranch = 'main';
    }
  }
}
