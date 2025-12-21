# GitHub Pages 快速入门

## 什么是 GitHub Pages？
GitHub Pages 是 GitHub 提供的免费静态网站托管服务，可以直接从你的 GitHub 仓库部署网站。

## 快速开始

### 1. 创建仓库
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. 推送到 GitHub
```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

### 3. 启用 Pages
访问仓库的 Settings → Pages，选择部署分支

## 常用命令

| 命令 | 说明 |
|------|------|
| `git status` | 查看状态 |
| `git add .` | 添加所有文件 |
| `git commit -m "消息"` | 提交更改 |
| `git push` | 推送到远程 |

## 注意事项
- 支持 HTML, CSS, JavaScript, Markdown
- 默认使用 `index.html` 作为首页
- 自动支持 HTTPS
- 每分钟自动构建

---

**最后更新**: 2025-12-21