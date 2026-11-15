# 尼斯 17 层海景大平层 · 最终源码

这是最终验收版 3D 海景大平层项目的完整前端与模型源码。场景包含 300㎡ 室内、82.5㎡ 露台、大客厅、两间卧室、酒廊餐厅、厨房、台球室、电竞房、金色沙滩、海滨道路与 20 层住宅塔楼环境。

## 包含内容

- `src/model.py`：Blender 模型生成源码
- `azur-300-v002.blend`：最终 Blender 工作文件
- `public/models/azur-300-v002.glb`：最终网页运行时模型
- `src/scene.js`：Three.js 场景、材质、光影、镜头与交互
- `src/environment.js`：海面、沙滩、道路、塔楼与环境
- `scripts/`：GLB 优化、内容检查、逐帧渲染脚本
- `index.html`：网页入口
- `package.json` / `vite.config.js`：前端构建配置

不包含调试日志、审计截图、渲染帧缓存、`node_modules` 和 `dist`。

## 本地运行

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 重新生成模型

需要 Blender 5.2.1 或兼容版本。使用 Blender Python 运行：

```bash
blender --background --python src/model.py
```

模型脚本会生成 Blender 文件和未压缩 GLB。随后可重新优化网页运行时模型：

```bash
node scripts/optimize-glb.mjs public/models/azur-300-raw-v002.glb public/models/azur-300-v002.glb
```

当前仓库已经包含优化后的 `azur-300-v002.glb`，正常开发和部署不需要重新运行 Blender。

## 视频渲染

先构建并启动本地预览，再用确定性镜头接口逐帧渲染：

```bash
npm run build
npm run preview -- --port 4174
python3 scripts/render_promo.py --fps 60 --start 0 --end 1919 --width 1280 --height 720 --format png
```

渲染输出默认写入 `renders/frames30`；可通过 `--out` 指定目录。
