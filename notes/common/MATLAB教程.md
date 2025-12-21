# MATLAB教程

## 一、基础操作

### 1. 界面与命令

*   **命令窗口**：直接执行指令（如 `3+5`）

*   **工作区**：显示当前变量（`whos`查看）

*   **脚本文件**：`.m`后缀，按`F5`运行

### 2. 变量与数据类型

```
a = 5;                  % 标量
str = 'Hello';          % 字符串
vec = 1:3;              % 行向量 [1,2,3]
mat = [1,2; 3,4];       % 2x2矩阵
```

### 3. 常用运算符

| 运算符  | 说明   |
| ---- | ---- |
| `.*` | 元素乘  |
| `./` | 元素除  |
| `'`  | 转置   |
| `==` | 逻辑相等 |


***

## 二、流程控制

### 1. 条件语句

```
if x > 0
    disp('正数');
elseif x == 0
    disp('零');
else
    disp('负数');
end
```

### 2. 循环结构

#### for循环

```
for i = 1:2:10  % 步长=2
    disp(i);
end
```

#### while循环

```
while n < 5
    n = n + 1;
end
```

### 3. 向量化编程

```
% 低效循环
for i = 1:100
    y(i) = sin(i);
end

% 高效向量化
y = sin(1:100);
```

***

## 三、函数与文件

### 1. 自定义函数

```
function y = myFunc(x)
    y = x^2 + 1;
end
% 调用：result = myFunc(3);
```

### 2. 文件操作

| 命令              | 功能       |
| --------------- | -------- |
| `save data.mat` | 保存工作区    |
| `load data.mat` | 加载变量     |
| `readmatrix()`  | 读取文本/CSV |


***

## 四、进阶特性

### 1. 面向对象编程

```
classdef Circle
    properties
        Radius
    end
    methods
        function area = getArea(obj)
            area = pi*obj.Radius^2;
        end
    end
end
```

### 2. 高级索引技巧

```
A = [1,2;3,4];
B = A(A > 2);  % 逻辑索引 → [3;4]
```

### 3. 性能优化

*   **预分配内存**：

<!---->

```
data = zeros(1,1000);  % 提前分配
for i = 1:1000
    data(i) = i^2;
end
```

***

## 五、可视化

### 1. 基础绘图

```
plot(x, y, 'r--', 'LineWidth', 2);
xlabel('X轴'); 
title('示例图');
grid on;
```

### 2. 多子图

```
subplot(2,1,1); plot(x,sin(x));
subplot(2,1,2); plot(x,cos(x));
```

***

## 六、调试与帮助

| 命令                | 功能     |
| ----------------- | ------ |
| `dbstop if error` | 错误时暂停  |
| `help plot`       | 查看函数文档 |
| `tic; toc;`       | 代码计时   |


> **提示**：优先使用向量化操作，避免不必要的循环！
