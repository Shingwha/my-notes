---
tags: []
parent: ""
collections:
  - 学习
  - 基本工具使用
$version: 0
$libraryID: 1
---
# Python2串口

```python
https://zhuanlan.zhihu.com/p/1893737549123536589

import serial
import matplotlib.pyplot as plt
try:
    ser = serial.Serial('COM4', 115200, timeout=1)
    print(f"成功连接到串口: {ser.name}")
    # 初始化存储 x 和 y 值的列表
    x_values = []
    y_values = []
    # 初始化图形窗口
    plt.ion()
    fig, ax = plt.subplots()
    while True:
        # 读取一行数据
        data = ser.readline().decode('utf-8').strip()
        if data:
            print(f"接收到的数据: {data}")
            try:
                # 提取 x_value 和 y_value
                x_str = data.split('x_value: ')[1].split(',')[0]
                y_str = data.split('y_value: ')[1]
                x = float(x_str)
                y = float(y_str)
                x_values.append(x)
                y_values.append(y)
                # 绘制波形图
                ax.clear()
                ax.plot(x_values, y_values)
                plt.draw()
                plt.pause(0.1)
            except (IndexError, ValueError):
                print("数据解析出错，请检查数据格式。")
except serial.SerialException as e:
    print(f"串口连接出错: {e}")
except KeyboardInterrupt:
    print("用户手动终止程序。")
finally:
    if 'ser' in locals() and ser.is_open:
        ser.close()
        print("串口已关闭。")
    plt.close()
```
