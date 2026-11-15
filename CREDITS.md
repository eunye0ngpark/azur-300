# 来源与复用记录

## Blender → Web 工作流

- 项目：`czlonkowski/blender-web-3d-skill`
- 来源：https://github.com/czlonkowski/blender-web-3d-skill
- 应用：米制 Blender 建模、raw GLB 导出、gltf-transform / Meshopt 运行时优化、静态空间合批、AgX 与后处理检查。
- 许可：MIT License，Copyright (c) 2026 Romuald Członkowski / AiAdvisors。

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 现代弧形落地灯

- 来源：Kimi 可复用设计资产库，资产 ID `27fcb90a-b0f3-486c-9b50-3aeebacfae02`。
- 文件：`lamp_on.blend`，保留原有层级，在公寓中重新定位并旋转；资产包未另附许可文本。

## 其余内容

- 公寓建筑、房间、除落地灯外的家具、露台、海岸、海面与天空均为本项目的程序化生成内容。
- Three.js 及其附加模块按各自 MIT 许可使用；运行时依赖详见 `package.json` / `package-lock.json`。
- 模型使用常数 Principled 材质与运行时程序化表面细节，没有使用低清照片贴图或 GPU 块压缩纹理。
