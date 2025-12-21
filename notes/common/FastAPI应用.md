---
tags: []
parent: ""
collections:
  - 学习
  - 基本工具使用
$version: 0
$libraryID: 1
---
FastAPI应用

```
uvicorn app:app --reload
```

或者Python代码中启动

```
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```
