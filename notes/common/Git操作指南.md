---
tags: []
parent: ""
collections:
  - 学习
  - 基本工具使用
$version: 0
$libraryID: 1
---
# Git操作指南

本指南提供了 Git 版本控制系统的核心操作流程，帮助您快速掌握 Git 的基本使用。

## 1. 安装与配置

### 安装 Git

*   Windows: 从 [Git for Windows 官网](https://git-scm.com/download) 下载安装包
*   Linux (Ubuntu/Debian): `sudo apt update && sudo apt install git`
*   Mac: 使用 Homebrew `brew install git`

### 基础配置

```
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global core.editor "code --wait"  # 设置VS Code为默认编辑器
```

## 2. 仓库操作

### 初始化仓库

```
git init  # 在当前目录创建新仓库
git clone <repository-url>  # 克隆远程仓库
```

### 基本工作流

1.  修改文件
2.  `git add <file>` 或 `git add .` 添加更改到暂存区
3.  `git commit -m "提交信息"` 提交更改
4.  `git push origin <branch>` 推送到远程仓库

### 查看状态

```
git status  # 查看当前状态
git log  # 查看提交历史
git log --oneline --graph --all  # 简洁图形化历史
```

## 3. 分支管理

### 基础分支操作

```
git branch  # 列出所有分支
git branch <branch-name>  # 创建新分支
git checkout <branch-name>  # 切换分支
git checkout -b <new-branch>  # 创建并切换到新分支
```

### 合并分支

```
git merge <branch-name>  # 合并指定分支到当前分支
git rebase <branch-name>  # 变基操作
```

## 4. 远程仓库

### 远程操作

```
git remote -v  # 查看远程仓库
git remote add <name> <url>  # 添加远程仓库
git push -u origin <branch>  # 首次推送并设置上游分支
git pull  # 拉取远程更改并合并
```

### 解决冲突

当合并或拉取出现冲突时：

1.  手动编辑冲突文件（Git会用`<<<<<<<`, `=======`, `>>>>>>>`标记冲突）
2.  `git add <file>` 标记为已解决
3.  `git commit` 完成合并

## 5. 高级操作

### 撤销更改

```
git reset --hard HEAD  # 丢弃所有未提交更改
git reset --hard <commit-hash>  # 回退到指定提交
git revert <commit-hash>  # 创建撤销指定提交的新提交
```

### 暂存更改

```
git stash  # 暂存当前更改
git stash pop  # 恢复最近暂存的更改
```

### 忽略文件

创建`.gitignore`文件指定要忽略的文件模式：

```
# 忽略所有.log文件
*.log

# 忽略build目录
build/
```

## 6. 团队协作流程

1.  `git pull` 获取最新代码
2.  创建特性分支：`git checkout -b feature/new-feature`
3.  开发并提交更改
4.  `git push origin feature/new-feature`
5.  创建Pull Request/Merge Request进行代码审查

## 7. 常用别名设置（可选）

```
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
```

这个简明指南涵盖了Git的核心操作，适合日常开发使用。如需更详细的信息，可以参考Git官方文档或相关教程。
