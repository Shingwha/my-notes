# Pandas2Excel

## 准备工作

在开始前，请确保已安装以下库：

```
pip install pandas openpyxl
```

## 常用操作函数

### 1. 读取 Excel 文件

```
import pandas as pd

# 读取整个 Excel 文件
df = pd.read_excel('data.xlsx')

# 读取指定工作表
df = pd.read_excel('data.xlsx', sheet_name='Sheet1')

# 读取指定范围的行（跳过前2行）
df = pd.read_excel('data.xlsx', skiprows=2)

# 只读取特定列（A列和C列）
df = pd.read_excel('data.xlsx', usecols=['A', 'C'])
```

### 2. 查看数据

```
# 查看前5行
print(df.head())

# 查看后5行
print(df.tail())

# 查看数据概览（列名、非空值数量、数据类型）
print(df.info())

# 查看统计摘要（数值列）
print(df.describe())

# 查看列名
print(df.columns)
```

### 3. 数据选择与过滤

```
# 选择单列
names = df['Name']

# 选择多列
subset = df[['Name', 'Age']]

# 按行选择（第3行）
row = df.iloc[2]

# 按行选择（第2-4行）
rows = df.iloc[1:4]

# 条件过滤（年龄大于30）
filtered = df[df['Age'] > 30]

# 多条件过滤（年龄>30 且 城市=北京）
filtered = df[(df['Age'] > 30) & (df['City'] == '北京')]
```

### 4. 数据处理

```
# 添加新列（基于现有列计算）
df['Birth Year'] = 2023 - df['Age']

# 重命名列
df = df.rename(columns={'OldName': 'NewName'})

# 删除列
df = df.drop(columns=['UnusedColumn'])

# 处理缺失值（删除包含缺失值的行）
df = df.dropna()

# 填充缺失值（用平均值填充年龄列）
df['Age'] = df['Age'].fillna(df['Age'].mean())

# 数据类型转换（转换为字符串）
df['ID'] = df['ID'].astype(str)
```

### 5. 数据排序

```
# 按单列升序排序
df_sorted = df.sort_values('Age')

# 按多列排序（先按城市升序，再按年龄降序）
df_sorted = df.sort_values(['City', 'Age'], ascending=[True, False])
```

### 6. 数据分组与聚合

```
# 按城市分组并计算平均年龄
grouped = df.groupby('City')['Age'].mean()

# 多维度分组聚合
agg_result = df.groupby('City').agg({
    'Age': ['mean', 'min', 'max'],
    'Salary': 'sum'
})
```

### 7. 写入 Excel 文件

```
# 将整个DataFrame写入Excel
df.to_excel('output.xlsx', index=False)

# 写入多个工作表
with pd.ExcelWriter('multi_sheet.xlsx') as writer:
    df1.to_excel(writer, sheet_name='Sheet1', index=False)
    df2.to_excel(writer, sheet_name='Sheet2', index=False)
    
# 追加数据到现有Excel文件（需要openpyxl）
from openpyxl import load_workbook

book = load_workbook('existing.xlsx')
with pd.ExcelWriter('existing.xlsx', engine='openpyxl') as writer:
    writer.book = book
    df_new.to_excel(writer, sheet_name='NewData', index=False)
```

### 8. 实用技巧

```
# 处理大型Excel文件（分块读取）
chunk_size = 1000
chunks = pd.read_excel('large_data.xlsx', chunksize=chunk_size)

for chunk in chunks:
    process(chunk)  # 处理每个数据块

# 读取Excel中的日期并正确解析
df = pd.read_excel('data.xlsx', parse_dates=['DateColumn'])

# 设置日期列为索引
df = df.set_index('DateColumn')

# 合并多个Excel文件
import glob

all_files = glob.glob("data/*.xlsx")
dfs = [pd.read_excel(f) for f in all_files]
combined = pd.concat(dfs, ignore_index=True)
```

## 常见问题解决

### 1. 编码问题

如果遇到编码错误，尝试指定编码：

```
df = pd.read_excel('data.xlsx', encoding='utf-8')
# 或
df = pd.read_excel('data.xlsx', encoding='gbk')
```

### 2. 处理日期格式

```
# 指定日期解析格式
df = pd.read_excel('data.xlsx', parse_dates=['DateColumn'], date_format='%Y-%m-%d')
```

### 3. 读取隐藏工作表

```
# 获取所有工作表名
all_sheets = pd.ExcelFile('data.xlsx').sheet_names

# 然后按名称读取特定工作表
df = pd.read_excel('data.xlsx', sheet_name='HiddenSheet')
```
