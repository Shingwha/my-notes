/**
 * 图片缓存模块
 * 使用 IndexedDB 存储已加载的图片数据
 */
export class ImageCache {
  constructor() {
    this.dbName = 'my-notes-image-cache';
    this.dbVersion = 1;
    this.db = null;
    this.isReady = false;
  }

  /**
   * 初始化 IndexedDB 数据库
   */
  async init() {
    if (this.isReady) return true;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[ImageCache] IndexedDB 打开失败:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('[ImageCache] IndexedDB 初始化成功');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建 images 对象存储
        if (!db.objectStoreNames.contains('images')) {
          const objectStore = db.createObjectStore('images', { keyPath: 'url' });

          // 创建 timestamp 索引用于清理过期数据
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });

          console.log('[ImageCache] 对象存储创建成功');
        }
      };
    });
  }

  /**
   * 获取缓存的图片
   * @param {string} url - 图片 URL
   * @returns {Promise<Blob|null>} 图片 Blob 数据
   */
  async get(url) {
    if (!this.isReady) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['images'], 'readonly');
      const objectStore = transaction.objectStore('images');
      const request = objectStore.get(url);

      request.onsuccess = () => {
        if (request.result) {
          // 更新访问时间戳
          this._updateTimestamp(url);
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[ImageCache] 获取缓存失败:', request.error);
        resolve(null);
      };
    });
  }

  /**
   * 存储图片到缓存
   * @param {string} url - 图片 URL
   * @param {Blob} blob - 图片 Blob 数据
   */
  async set(url, blob) {
    if (!this.isReady) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['images'], 'readwrite');
      const objectStore = transaction.objectStore('images');

      const data = {
        url: url,
        data: blob,
        timestamp: Date.now(),
        size: blob.size
      };

      const request = objectStore.put(data);

      request.onsuccess = () => {
        console.log(`[ImageCache] 缓存已保存: ${url} (${this._formatSize(blob.size)})`);
        resolve();
      };

      request.onerror = () => {
        console.error('[ImageCache] 保存缓存失败:', request.error);
        resolve();
      };
    });
  }

  /**
   * 删除单个缓存
   * @param {string} url - 图片 URL
   */
  async delete(url) {
    if (!this.isReady) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['images'], 'readwrite');
      const objectStore = transaction.objectStore('images');
      const request = objectStore.delete(url);

      request.onsuccess = () => {
        console.log(`[ImageCache] 缓存已删除: ${url}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[ImageCache] 删除缓存失败:', request.error);
        resolve();
      };
    });
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    if (!this.isReady) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['images'], 'readwrite');
      const objectStore = transaction.objectStore('images');
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('[ImageCache] 所有缓存已清空');
        resolve();
      };

      request.onerror = () => {
        console.error('[ImageCache] 清空缓存失败:', request.error);
        resolve();
      };
    });
  }

  /**
   * 获取缓存总大小（字节）
   * @returns {Promise<number>} 缓存大小
   */
  async getSize() {
    if (!this.isReady) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['images'], 'readonly');
      const objectStore = transaction.objectStore('images');
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const totalSize = request.result.reduce((sum, item) => sum + item.size, 0);
        resolve(totalSize);
      };

      request.onerror = () => {
        console.error('[ImageCache] 获取缓存大小失败:', request.error);
        resolve(0);
      };
    });
  }

  /**
   * 清理过期缓存
   * @param {number} days - 过期天数（默认 7 天）
   */
  async cleanExpired(days = 7) {
    if (!this.isReady) await this.init();

    const expireTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['images'], 'readwrite');
      const objectStore = transaction.objectStore('images');
      const index = objectStore.index('timestamp');

      const range = IDBKeyRange.upperBound(expireTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            console.log(`[ImageCache] 已清理 ${deletedCount} 个过期缓存（${days} 天未访问）`);
          }
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[ImageCache] 清理过期缓存失败:', request.error);
        resolve(0);
      };
    });
  }

  /**
   * 更新访问时间戳
   * @private
   * @param {string} url - 图片 URL
   */
  _updateTimestamp(url) {
    const transaction = this.db.transaction(['images'], 'readwrite');
    const objectStore = transaction.objectStore('images');
    const getRequest = objectStore.get(url);

    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const data = getRequest.result;
        data.timestamp = Date.now();
        objectStore.put(data);
      }
    };
  }

  /**
   * 格式化文件大小
   * @private
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
