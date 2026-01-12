/**
 * 应用入口
 * 初始化并启动应用
 */

import { ConfigManager } from "./config.js";
import { DataManager } from "./data.js";
import { UIManager } from "./ui.js";
import { ImageCache } from "./cache.js";

// 初始化图片缓存
const imageCache = new ImageCache();

// 初始化缓存并清理过期数据
(async () => {
  const initialized = await imageCache.init();
  if (initialized) {
    // 清理 7 天未访问的缓存
    await imageCache.cleanExpired(7);
    // 挂载到 window 用于调试
    window.imageCache = imageCache;
  } else {
    console.warn('[Main] 图片缓存初始化失败，图片功能将被禁用');
  }
})();

// 启动应用
const config = new ConfigManager();
const data = new DataManager(config);
const ui = new UIManager(config, data, imageCache);

// 全局挂载以便调试
window.ui = ui;
window.config = config;
window.data = data;

// 页面卸载时清理 Blob URL
window.addEventListener('beforeunload', () => {
  ui.cleanupBlobUrls();
});
