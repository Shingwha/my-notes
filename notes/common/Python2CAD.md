# Python2CAD

```
# -*- coding: utf-8 -*-
import inspect
import numpy as np
import win32com.client

# 连接AutoCAD
acad = win32com.client.Dispatch("AutoCAD.Application")
acad.Visible = True

# 获取活动文档
doc = acad.ActiveDocument

# 准备二次函数参数
x = np.linspace(0, 100, 200)
y = 0.02 * x * (x - 100)

a_cmd = "_.SPLINE "
for point in zip(x, y):
    a_cmd += f"{point[0]},{point[1]} "
doc.SendCommand(a_cmd + "\n")
```
