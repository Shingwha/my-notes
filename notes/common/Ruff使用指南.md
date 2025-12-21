---
tags: []
parent: ""
collections:
  - 学习
  - 基本工具使用
$version: 0
$libraryID: 1
---
# Ruff使用指南

Ruff是一个用Rust编写的超快Python代码检查(linter)和格式化工具，比传统工具快10-100倍，集成了flake8、isort、pydocstyle等功能于一体。本指南将介绍Ruff的安装、基本使用和配置方法。

## 安装Ruff

通过pip安装：

```
pip install ruff
```

IDE插件安装（以VSCode为例）：

1.  打开VSCode扩展市场
2.  搜索"Ruff"并安装
3.  安装后可直接使用快捷键(如Shift+Alt+F)格式化代码

## 基本使用命令

### 代码检查

```
# 检查当前目录所有Python文件
ruff check .

# 检查特定文件
ruff check path/to/file.py

# 检查并自动修复可修复的问题
ruff check --fix .

# 检查特定规则(如E501行长度,F401未使用导入)
ruff check --select E501,F401 .
```

### 代码格式化

```
# 格式化当前目录所有Python文件
ruff format .

# 格式化特定文件
ruff format path/to/file.py
```

## 配置文件

Ruff支持`pyproject.toml`或`ruff.toml`配置文件，优先级从高到低为：`.ruff.toml` > `ruff.toml` > `pyproject.toml`

### 示例配置

```
[tool.ruff]
# 选择检查规则(E:pycodestyle, F:Pyflakes等)
select = ["E", "F", "D"]

# 忽略的规则
ignore = ["E501"]  # 忽略行长度限制

# 每行最大字符数
line-length = 88

# 目标Python版本
target-version = "py311"

# 格式化选项
[format]
# 使用单引号
quote-style = "single"
# 缩进使用空格(默认4个)
indent-width = 4
# 格式化docstring中的代码
docstring-code-format = true
```

## 忽略规则

在代码中临时忽略特定规则：

```
x = 1  # noqa: F841  # 忽略未使用变量警告

# 忽略文件所有警告
# ruff: noqa
```

## 高级功能

1.  **监视模式**：文件更改时自动检查

    ```
    ruff check . --watch
    ```

2.  **继承配置**：可以继承其他配置文件

    ```
    extend = "../pyproject.toml"
    ```

3.  **文件特定规则**：为特定文件设置特殊规则

    ```
    [tool.ruff.per-file-ignores]
    "__init__.py" = ["E402"]  # 忽略__init__.py中的E402错误
    ```

## 常见问题解决

1.  **错误太多**：通过`select`和`ignore`调整规则严格程度
2.  **格式化不符合预期**：检查`format`配置项或使用`--diff`预览更改
3.  **类型检查**：Ruff不包含类型检查，建议配合mypy使用

Ruff将代码检查、格式化和质量分析集成在一个高效工具中，大幅提升了Python开发的工作流程效率。
