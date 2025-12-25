/**
 * 应用入口
 * 初始化并启动应用
 */

import { ConfigManager } from "./config.js";
import { DataManager } from "./data.js";
import { UIManager } from "./ui.js";

// 启动应用
const config = new ConfigManager();
const data = new DataManager(config);
const ui = new UIManager(config, data);

// 全局挂载以便调试
window.ui = ui;
window.config = config;
window.data = data;
