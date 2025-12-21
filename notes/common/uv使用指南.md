---
tags: []
parent: ""
collections:
  - 学习
  - 基本工具使用
$version: 0
$libraryID: 1
---
# uv使用指南

uv是一个基于Rust编写的高性能Python包管理工具，由Astral公司开发，旨在成为"Python的Cargo"。它提供了快速、可靠且易用的包管理体验，可以替代pip、pip-tools和virtualenv等工具。本文将详细介绍uv的安装、基本使用、项目管理、依赖管理以及高级功能。

## 1. uv简介与安装

### 1.1 uv的特点

uv具有以下显著优势：

*   **极快的速度**：得益于Rust实现，uv比传统Python工具快8-100倍
*   **一体化管理**：可管理Python版本、虚拟环境、包依赖和项目配置
*   **现代化工作流**：类似Cargo(Rust)和npm(Node.js)的现代化项目管理体验
*   **跨平台支持**：支持Linux、Windows和macOS

### 1.2 安装uv

uv可以通过多种方式安装：

**在macOS和Linux上**：

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**在Windows上**：

```
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**使用pip安装**：

```
pip install uv
```

安装完成后，可以通过以下命令验证安装：

```
uv --version
```

如果需要配置国内镜像加速，可以编辑`~/.config/uv/uv.toml`文件，添加以下内容：

```
[[index]]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
default = true
```

## 2. 项目初始化与管理

### 2.1 创建新项目

使用uv初始化一个新项目非常简单：

```
uv init myproject
cd myproject
```

这会创建一个包含以下文件的目录结构：

*   `.gitignore` - Git忽略规则
*   `.python-version` - Python版本信息
*   `pyproject.toml` - 项目配置和依赖声明
*   `README.md` - 项目说明文件
*   `hello.py` - 示例代码文件

`pyproject.toml`文件内容示例：

```
[project]
name = "myproject"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.12"
dependencies = []
```

### 2.2 项目同步

初始化项目后，需要同步项目依赖：

```
uv sync
```

这个命令会：

1.  查找或下载合适的Python版本
2.  创建并设置项目的虚拟环境(默认在`.venv`目录)
3.  构建完整的依赖列表并写入`uv.lock`文件
4.  将依赖同步到虚拟环境中

### 2.3 运行项目代码

uv提供了专门的命令来运行Python脚本：

```
uv run hello.py
```

这比直接使用`python hello.py`更好，因为它会确保在正确的项目环境下运行。

## 3. 依赖管理

### 3.1 添加依赖

添加依赖使用`uv add`命令：

```
uv add pandas
```

这会自动处理依赖关系，安装pandas及其所有依赖包，并更新`pyproject.toml`和`uv.lock`文件。

### 3.2 删除依赖

删除依赖使用`uv remove`命令：

```
uv remove pandas
```

这会删除指定包及其不再需要的依赖。

### 3.3 区分开发和生产环境

uv支持像Node.js和Rust那样区分不同环境的依赖：

```
# 添加开发环境依赖
uv add --group dev pytest

# 添加生产环境依赖
uv add --group production requests
```

这会在`pyproject.toml`中分别记录不同环境的依赖。

### 3.4 更新依赖

更新单个依赖包：

```
uv pip install --upgrade package_name
```

全量更新所有依赖：

```
uv pip compile --upgrade -o requirements.txt requirements.in
```

只更新部分依赖：

```
uv pip compile --upgrade-package flask -o requirements.txt requirements.in
```

## 4. 虚拟环境管理

### 4.1 创建虚拟环境

uv可以快速创建虚拟环境：

```
uv venv myenv
```

指定Python版本：

```
uv venv --python /path/to/python myenv
```

### 4.2 激活虚拟环境

在Linux/macOS上：

```
source myenv/bin/activate
```

在Windows上：

```
.\myenv\Scripts\activate
```

### 4.3 退出虚拟环境

```
deactivate
```

uv的虚拟环境创建速度比`python -m venv`快约80倍，比virtualenv快7倍。

## 5. 高级功能

### 5.1 依赖锁定

uv自动生成`uv.lock`文件，确保依赖的一致性。这个文件不应该手动编辑，而是由uv管理。

查看依赖树：

```
uv tree
```

### 5.2 使用不同解析策略

uv支持多种解析策略：

```
# 默认策略(最新兼容版本)
uv pip compile requirements.in

# 最低版本策略
uv pip compile --resolution=lowest requirements.in
```

### 5.3 针对特定Python版本解析

uv允许针对不同于当前Python版本的版本进行解析：

```
uv pip compile --python-version=3.7 requirements.in
```

### 5.4 依赖覆盖

uv支持依赖覆盖，可以解决依赖声明不正确的问题：

```
uv pip compile -o overrides.txt requirements.in
```

### 5.5 工作区支持

uv支持类似Cargo的workspace功能，可以管理多个相关项目。

## 6. 与传统工具的对比

uv可以替代多个传统Python工具：

*   `pip` → `uv pip install`
*   `pip-tools` → `uv pip compile`
*   `virtualenv` → `uv venv`
*   `pipx` → `uv tool`
*   `pyenv` → `uv python`

## 7. 实际工作流示例

### 7.1 初始化新项目

```
uv init myapp
cd myapp
uv sync
```

### 7.2 添加依赖

```
uv add fastapi
uv add --group dev pytest
```

### 7.3 开发过程中

```
uv run main.py
```

### 7.4 准备生产环境

```
uv pip compile --python-version=3.9 pyproject.toml -o requirements.txt
uv pip sync requirements.txt
```

### 7.5 发布项目

```
uv build
uv publish
```

## 8. 常见问题

### 8.1 uv与pip的区别

虽然uv支持大部分pip功能，但它不是完全的替代品。uv专注于现代Python打包需求，不支持一些传统特性如.egg分发。

### 8.2 uv与Poetry/PDM的区别

uv目前不生成平台无关的锁定文件，这使得它更适合围绕pip和pip-tools工作流构建的项目。

### 8.3 性能优化

uv利用全局模块缓存避免重复下载，并在支持的文件系统上使用Copy-on-Write和硬链接来最小化磁盘空间使用。

## 9. 总结

uv作为新一代Python包管理工具，通过其出色的性能和现代化的设计，显著提升了Python项目管理的体验。它特别适合：

*   需要快速依赖解析和安装的项目
*   希望统一工具链的开发者
*   需要跨平台一致性的团队
*   追求现代化开发工作流的项目

随着uv的不断发展，它有望成为Python生态系统中不可或缺的工具，为开发者提供高效、可靠的开发体验。

更多详细信息和最新特性，可以参考uv的官方文档和GitHub仓库。

# 使用uv运行他人项目的完整流程

当你从GitHub或其他地方clone一个使用uv管理的Python项目时，可以按照以下步骤一键配置和运行项目：

## 1. 克隆项目

首先克隆项目到本地：

```
git clone <项目仓库地址>
cd <项目目录>
```

## 2. 一键初始化项目环境

uv项目通常会包含以下文件：

*   `pyproject.toml` - 项目配置和依赖声明
*   `uv.lock` - 依赖锁定文件(可选)
*   `.python-version` - Python版本信息(可选)

运行以下命令一键初始化：

```
uv sync
```

这个命令会自动完成以下操作：

1.  检查并安装所需的Python版本(如果系统中没有)
2.  创建虚拟环境(默认在`.venv`目录)
3.  安装所有项目依赖
4.  生成/更新锁定文件(uv.lock)

## 3. 激活虚拟环境(可选)

虽然uv可以直接运行项目，但如果你想手动激活虚拟环境：

```
# Linux/macOS
source .venv/bin/activate

# Windows
.\.venv\Scripts\activate
```

## 4. 运行项目

根据项目类型不同，有几种运行方式：

### 4.1 直接运行Python脚本

```
uv run main.py
```

### 4.2 运行项目入口点(如果项目配置了scripts)

```
uv run <入口命令>
```

### 4.3 运行测试

```
uv run pytest
```

## 5. 开发工作流

如果需要进行开发：

### 5.1 添加新依赖

```
uv add <包名>
```

### 5.2 添加开发依赖

```
uv add --group dev <包名>
```

### 5.3 更新依赖

```
uv sync --upgrade
```

## 6. 项目结构建议

为了让别人更容易使用你的uv项目，建议包含以下文件：

1.  `pyproject.toml` - 必须，包含项目元数据和依赖
2.  `uv.lock` - 可选但推荐，确保依赖一致性
3.  `.python-version` - 可选，指定Python版本
4.  `README.md` - 应该包含项目简介和基本使用说明

示例README内容：

```
# 项目名称

项目简介...

## 快速开始

1. 确保已安装[uv](https://github.com/astral-sh/uv)
2. 克隆项目：
   ```bash
   git clone <仓库地址>
   cd <项目目录>
   ```
3. 初始化环境：
   ```bash
   uv sync
   ```
4. 运行项目：
   ```bash
   uv run main.py
   ```

## 开发

添加依赖：
```bash
uv add <包名>
```

添加开发依赖：
```bash
uv add --group dev <包名>
```
```

## 7. 注意事项

1.  **Python版本兼容性**：如果项目指定了特定Python版本，确保你的系统上有该版本或允许uv自动安装

2.  **平台差异**：某些依赖可能有平台特定版本，uv会自动处理

3.  **私有仓库**：如果项目使用私有PyPI源，需要提前配置：

    ```
    uv config set index-url <私有仓库URL>
    ```

4.  **离线模式**：如果需要离线工作，可以使用缓存：

    ```
    uv sync --offline
    ```

通过以上步骤，你可以轻松地clone并运行任何使用uv管理的Python项目，享受uv带来的快速、一致的开发体验。
