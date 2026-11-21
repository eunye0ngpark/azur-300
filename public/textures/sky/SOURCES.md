# 白天实拍天空

`pizzo_pernice_puresky_2k.hdr` 是 Pizzo Pernice 的天空全景。Andreas Mischok 拍摄，Jarod Guest 处理成纯天空。它提供晴空光色和太阳盘，不代表公寓位置的实测天气或窗景。[原素材](https://polyhaven.com/a/pizzo_pernice_puresky) · [2K HDR 原图](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/pizzo_pernice_puresky_2k.hdr) · [CC0 许可](https://polyhaven.com/license)

原图为 2048 × 1024 像素，SHA-256 为 `55c199a301943e3c0f8222e7be70b6356408f747ac3442206c7e6d2fe5aa02a5`。

为缩短网页加载时间，线上运行文件使用同一来源色调映射 JPG 缩至 1024 × 512，并内联到 JavaScript。[色调映射原图](https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/pizzo_pernice_puresky.jpg)。直接日光与阴影仍由独立方向光提供。

## 太阳与阴影对齐

用 Three.js 的 `HDRLoader` 以 Float32 读取线性 RGB，按 Rec.709 亮度计算上半球太阳盘中亮度大于峰值 25% 的 13 个像素的加权中心。以左上角为原点，结果是 `(1230.35, 209.76)`。可复现的纹理坐标为 `u = 0.600758, v = 0.795152`，v 从图像底部起算。

- **Three.js 原图**。Y 向上，水平角从 +X 转向 +Z 为正。太阳水平角 `36.273°`，仰角 `53.127°`，单位方向 `(+0.483756, +0.799972, +0.355001)`。
- **项目日光对齐**。将天空绕世界 Y 轴转 `−89.5305°`，即 `−1.56260227 rad`，保留地平线。太阳单位方向变为 `(-0.351025, +0.799972, +0.486649)`。自写天空着色器采样贴图时，对世界视线使用逆旋转 `+89.5305°`。此角度沿用项目原设的水平方位，同时采用实拍图的太阳高度。
- **Blender 对齐**。场景采用 Blender Z 向上，导出的 Three.js 坐标为 `(x, z, -y)`。同一目标太阳的 Blender 世界方向为 `(-0.351025, -0.486649, +0.799972)`。World 环境纹理前串接默认 Point 类型的 Mapping 节点，Z 旋转设 `+89.5305°`，将采样方向作逆旋转。太阳灯应沿上述单位向量的反方向照射。[Blender 等距柱状投影定义](https://github.com/blender/blender/blob/main/intern/cycles/kernel/camera/projection.h)
