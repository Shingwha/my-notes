# 图片加载与缓存功能实现计划

## 概述

为 my-notes 项目添加完整的图片支持，包括：
- 公有仓库图片 URL 重写
- 私有仓库图片通过 API 加载
- IndexedDB 缓存已加载的图片

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           加载流程                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Markdown 渲染后                                                     │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────┐                                               │
│  │ 遍历所有 <img>  │                                               │
│  └────────┬────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐    相对路径？                                  │
│  │ 判断 URL 类型   │ ────────► 是 ──► 转换为完整路径                │
│  └────────┬────────┘                                               │
│           │ 否                                                     │
│           ▼                                                         │
│  ┌─────────────────┐    是否为 raw.githubusercontent.com?         │
│  │ 判断图片来源    │ ────────► 否 ──► 保持原样（外部图片）          │
│  └────────┬────────┘                                               │
│           │ 是                                                     │
│           ▼                                                         │
│  ┌─────────────────┐    有 Token?                                  │
│  │ 判断仓库类型    │ ────────► 有 ──► 私有仓库加载（API）           │
│  └────────┬────────┘                                               │
│           │ 无                                                     │
│           ▼                                                         │
│     公有仓库加载（直接使用 raw URL）                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              所有路径最终都经过缓存层                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐    缓存命中?                                  │
│  │ 查询 IndexedDB  │ ────────► 是 ──► 返回缓存的 Blob URL         │
│  └────────┬────────┘                                               │
│           │ 未命中                                                 │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │ 网络加载图片    │                                               │
│  └────────┬────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │ 存入 IndexedDB  │                                               │
│  └────────┬────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │ 返回 Blob URL   │                                               │
│  └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、文件结构

```
js/
├── cache.js       # 新增：ImageCache 类（IndexedDB 管理）
├── data.js        # 修改：添加 getImageContent() 方法
├── ui.js          # 修改：添加 loadImages() 方法
└── main.js        # 修改：初始化 ImageCache
```

---

## 三、核心模块设计

### 3.1 ImageCache 类 (js/cache.js)

#### 职责
- 管理 IndexedDB 数据库
- 提供缓存存取接口
- 自动清理过期缓存

#### 接口设计

```javascript
class ImageCache {
  // 初始化数据库
  async init()

  // 获取缓存的图片（返回 Blob 或 null）
  async get(url): Promise<Blob | null>

  // 存储图片到缓存
  async set(url, blob): Promise<void>

  // 删除单个缓存
  async delete(url): Promise<void>

  // 清空所有缓存
  async clear(): Promise<void>

  // 获取缓存大小（字节）
  async getSize(): Promise<number>

  // 清理过期缓存（超过指定天数未访问）
  async cleanExpired(days = 7): Promise<void>
}
```

#### IndexedDB 结构

```
数据库名: my-notes-image-cache
版本: 1

ObjectStore: images
├── keyPath: url (主键)
├── indices:
│   └── timestamp (用于清理过期数据)
│
数据结构:
{
  url: string,           // 图片 URL（主键）
  data: Blob,            // 图片二进制数据
  timestamp: number,     // 最后访问时间戳
  size: number           // 数据大小（字节）
}
```

---

### 3.2 DataManager 扩展 (js/data.js)

#### 新增方法

```javascript
/**
 * 获取图片内容
 * @param {string} imagePath - 图片相对于仓库根目录的路径
 * @returns {Promise<Blob>} 图片数据
 */
async getImageContent(imagePath): Promise<Blob>
```

#### 实现逻辑

```javascript
async getImageContent(imagePath) {
  const { username, repo, token } = this.configManager.config;
  const hasToken = !!token;

  if (hasToken) {
    // 私有仓库：通过 GitHub API 获取
    const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${imagePath}`;
    const res = await fetch(apiUrl, {
      headers: {
        ...this.headers,
        Accept: 'application/vnd.github.v3.raw'  // 返回原始二进制
      }
    });

    if (!res.ok) {
      throw new Error(`图片加载失败 (${res.status}): ${imagePath}`);
    }

    return await res.blob();
  } else {
    // 公有仓库：从 raw.githubusercontent.com 获取
    const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/HEAD/${imagePath}`;
    const res = await fetch(rawUrl);

    if (!res.ok) {
      throw new Error(`图片加载失败 (${res.status}): ${imagePath}`);
    }

    return await res.blob();
  }
}
```

---

### 3.3 UIManager 扩展 (js/ui.js)

#### 新增方法

```javascript
/**
 * 处理 Markdown 中的所有图片
 * @param {string} mdContentPath - 当前 Markdown 文件的路径
 */
async loadImages(mdContentPath): Promise<void>

/**
 * 加载单张图片（带缓存和错误处理）
 * @param {HTMLImageElement} img - img 元素
 * @param {string} mdContentPath - Markdown 文件路径
 */
async loadSingleImage(img, mdContentPath): Promise<void>
```

#### 实现逻辑

```javascript
async loadImages(mdContentPath) {
  const { username, repo } = this.configManager.config;
  const images = this.dom.contentArea.querySelectorAll('img');

  for (const img of images) {
    await this.loadSingleImage(img, mdContentPath);
  }
}

async loadSingleImage(img, mdContentPath) {
  const { username, repo, token } = this.configManager.config;
  const originalSrc = img.src;
  let imagePath = null;

  // 1. 判断 URL 类型
  if (originalSrc.startsWith('http://') || originalSrc.startsWith('https://')) {
    // 外部完整 URL，检查是否为 GitHub 图片
    if (originalSrc.includes('raw.githubusercontent.com')) {
      // 提取图片路径
      const match = originalSrc.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
      if (match) {
        imagePath = match[1];
      }
    } else {
      // 非 GitHub 图片，保持原样
      return;
    }
  } else if (originalSrc.startsWith('data:')) {
    // Base64 内嵌图片，保持原样
    return;
  } else {
    // 相对路径，转换为完整路径
    const mdDir = mdContentPath.split('/').slice(0, -1).join('/');
    imagePath = mdDir ? `${mdDir}/${originalSrc}` : originalSrc;
  }

  if (!imagePath) {
    // 无法解析的路径，保持原样
    return;
  }

  // 2. 显示加载状态
  img.style.opacity = '0.5';
  img.alt = '加载中...';

  try {
    // 3. 先查缓存
    const cached = await this.imageCache.get(this._getCacheKey(imagePath));

    if (cached) {
      // 缓存命中
      img.src = URL.createObjectURL(cached);
      img.style.opacity = '1';
      return;
    }

    // 4. 缓存未命中，加载数据
    const blob = await this.dataManager.getImageContent(imagePath);

    // 5. 存入缓存
    await this.imageCache.set(this._getCacheKey(imagePath), blob);

    // 6. 更新图片
    img.src = URL.createObjectURL(blob);
    img.style.opacity = '1';

  } catch (error) {
    // 加载失败处理
    img.alt = `图片加载失败: ${imagePath}`;
    img.style.opacity = '0.3';
    img.style.border = '1px dashed var(--border-color)';
    console.error('图片加载失败:', imagePath, error);
  }
}

// 辅助方法：生成缓存键
_getCacheKey(imagePath) {
  const { username, repo } = this.configManager.config;
  return `${username}/${repo}/${imagePath}`;
}
```

#### 修改 renderMarkdown 方法

```javascript
renderMarkdown(md, filePath) {
  // 原有的 Markdown 渲染
  this.dom.contentArea.innerHTML = `<div class="markdown-body">${marked.parse(md)}</div>`;

  // 原有的代码高亮
  if (window.Prism) {
    this.dom.contentArea
      .querySelectorAll("pre code")
      .forEach((block) => {
        Prism.highlightElement(block);
      });
  }

  // 新增：处理图片加载
  this.loadImages(filePath);
}
```

---

## 四、私有仓库 vs 公有仓库 处理对比

| 场景 | URL 格式 | 加载方式 | Token 需求 | 缓存策略 |
|------|----------|----------|------------|----------|
| **公有仓库** | `https://raw.githubusercontent.com/user/repo/HEAD/path/img.png` | 直接 fetch raw URL | 不需要 | 缓存 Blob |
| **公有仓库（相对路径）** | `./images/img.png` | 转换为完整 raw URL 后 fetch | 不需要 | 缓存 Blob |
| **私有仓库** | 同上 | 通过 API: `api.github.com/repos/.../contents/...` | 需要 | 缓存 Blob |
| **外部图片** | `https://example.com/img.png` | 浏览器直接加载 | 不需要 | 不缓存 |

---

## 五、缓存策略详解

### 5.1 缓存键设计

```
格式: {username}/{repo}/{imagePath}

示例:
- shingwha/my-notes/assets/screenshot.png
- user/docs/images/diagram.svg
```

### 5.2 缓存过期机制

```javascript
// 存储时更新时间戳
async set(url, blob) {
  await db.put('images', {
    url: url,
    data: blob,
    timestamp: Date.now(),  // 每次访问都更新
    size: blob.size
  });
}

// 清理过期缓存（7天未访问）
async cleanExpired(days = 7) {
  const expireTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  const tx = this.db.transaction('images', 'readwrite');
  const store = tx.objectStore('images');
  const index = store.index('timestamp');

  const range = IDBKeyRange.upperBound(expireTime);
  const request = index.openCursor(range);

  request.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      cursor.delete();  // 删除过期记录
      cursor.continue();
    }
  };
}
```

### 5.3 启动时自动清理

```javascript
// 在 main.js 初始化时执行
(async () => {
  await imageCache.init();
  await imageCache.cleanExpired(7);  // 清理7天未访问的缓存
})();
```

---

## 六、错误处理

### 6.1 图片加载失败

```javascript
// UI 反馈
img.style.cssText = `
  opacity: 0.3;
  border: 1px dashed var(--border-color);
  padding: 8px;
  min-height: 100px;
  background: var(--bg-secondary);
`;
img.alt = `图片加载失败\n${imagePath}`;

// 控制台日志
console.error('[ImageLoader]', imagePath, error.message);
```

### 6.2 IndexedDB 失败

```javascript
// 降级处理：禁用缓存，直接加载
if (!await imageCache.init()) {
  console.warn('[ImageCache] 初始化失败，禁用缓存功能');
  imageCache = null;  // 禁用后续缓存操作
}
```

---

## 七、性能优化

### 7.1 并发加载

```javascript
// 使用 Promise.allSettled 并发加载多张图片
async loadImages(mdContentPath) {
  const images = this.dom.contentArea.querySelectorAll('img');

  const promises = Array.from(images).map(img =>
    this.loadSingleImage(img, mdContentPath)
  );

  await Promise.allSettled(promises);
}
```

### 7.2 内存管理

```javascript
// 图片元素销毁时释放 Blob URL
const blobUrls = new Set();

img.src = URL.createObjectURL(blob);
blobUrls.add(img.src);

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  blobUrls.forEach(url => URL.revokeObjectURL(url));
});
```

---

## 八、CSS 样式调整

为加载状态和错误状态添加样式：

```css
/* 图片加载中 */
.markdown-body img[alt*="加载中"] {
  filter: blur(2px);
  transition: filter 0.3s, opacity 0.3s;
}

/* 图片加载完成 */
.markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  transition: filter 0.3s, opacity 0.3s;
}

/* 图片加载失败 */
.markdown-body img[alt*="加载失败"] {
  display: inline-block;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  min-width: 200px;
  min-height: 100px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}
```

---

## 九、测试用例

### 9.1 公有仓库测试

```markdown
# 测试图片

## 相对路径
![相对路径图片](./assets/demo.png)

## 绝对路径
![绝对路径图片](https://raw.githubusercontent.com/user/repo/main/docs/image.jpg)

## 外部图片
![外部图片](https://example.com/image.png)
```

**预期结果**：
- 相对路径和绝对路径正常显示
- 外部图片正常显示
- 相对路径图片被缓存

### 9.2 私有仓库测试

```markdown
# 私有仓库图片

![私有图片](./private/image.png)
```

**预期结果**：
- 带 Token 时正常显示
- 不带 Token 时显示加载失败
- 加载成功的图片被缓存

### 9.3 缓存验证

1. 首次访问图片 → 检查 IndexedDB 有数据
2. 刷新页面 → 从缓存加载（控制台无网络请求）
3. 等待 7 天后 → 缓存自动清除

---

## 十、实现步骤

### Step 1: 创建 ImageCache 类
- [ ] 创建 `js/cache.js`
- [ ] 实现 IndexedDB 初始化
- [ ] 实现 get/set/delete/clear 方法
- [ ] 实现 cleanExpired 方法

### Step 2: 扩展 DataManager
- [ ] 添加 `getImageContent()` 方法
- [ ] 处理公有仓库（raw URL）
- [ ] 处理私有仓库（API with token）

### Step 3: 扩展 UIManager
- [ ] 添加 `loadImages()` 方法
- [ ] 添加 `loadSingleImage()` 方法
- [ ] 添加 URL 解析逻辑（相对路径转绝对路径）
- [ ] 修改 `renderMarkdown()` 调用图片加载

### Step 4: 集成到主程序
- [ ] 修改 `js/main.js` 初始化 ImageCache
- [ ] 修改 `index.html` 引入 cache.js
- [ ] 启动时执行 `cleanExpired()`

### Step 5: 样式与优化
- [ ] 添加加载状态样式
- [ ] 添加错误状态样式
- [ ] 实现并发加载
- [ ] 添加 Blob URL 内存管理

---

## 十一、注意事项

1. **Blob URL 内存泄漏**
   - 必须在适当时机调用 `URL.revokeObjectURL()`
   - 页面卸载时统一清理

2. **IndexedDB 配额**
   - 浏览器可能提示用户授权更多存储空间
   - 建议在存储超过 50MB 时提示用户

3. **GitHub API 限流**
   - 认证用户: 5000 次/小时
   - 未认证: 60 次/小时
   - 私有仓库大量图片需考虑限流

4. **CORS 问题**
   - raw.githubusercontent.com 支持 CORS
   - API 需要 token 才能避免 CORS

---

## 十二、后续扩展（可选）

- [ ] 图片懒加载（Intersection Observer）
- [ ] 图片压缩后存储（节省空间）
- [ ] 图片预加载（提前加载下一张）
- [ ] 图片查看器（点击放大、旋转）
- [ ] WebP 格式转换（节省带宽）
