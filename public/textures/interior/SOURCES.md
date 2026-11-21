# 室内表面来源

七套素材随项目本地提供。前六套由 Poly Haven 以 CC0 发布，洞石来自 ambientCG，同样使用 CC0。[Poly Haven 许可](https://polyhaven.com/license) · [ambientCG 许可](https://docs.ambientcg.com/license/) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

| 原素材 | 作者 | 实物或样本宽 × 高 | 应用 |
| --- | --- | --- | --- |
| [Oak Veneer 01](https://polyhaven.com/a/oak_veneer_01) | Jenelle van Heerden | 1.83 × 1.83 m | 橡木、浅色橡木 |
| [Natural Walnut Veneer](https://polyhaven.com/a/natural_walnut_veneer) | Jenelle van Heerden | 1 × 1 m | 胡桃木饰面 |
| [Rough Linen](https://polyhaven.com/a/rough_linen) | colormass 拍摄，Rico Cilliers 处理 | 0.271 × 0.271 m | 亚麻织物，弱化后用于绒面和台呢 |
| [Wool Boucle](https://polyhaven.com/a/wool_boucle) | colormass 拍摄，Rico Cilliers 处理 | 0.315 × 0.390 m | 圈绒、地毯 |
| [White Plaster 02](https://polyhaven.com/a/white_plaster_02) | Rob Tuytel | 1 × 1 m | 灰泥墙、天花 |
| [Leather Red 02](https://polyhaven.com/a/leather_red_02) | Rob Tuytel | 0.60 × 0.60 m | 调成干邑色的皮革 |
| [Travertine 001](https://ambientcg.com/view?id=Travertine001) | ambientCG | 约 1.2 × 1.2 m | 洞石、降低对比度的浅色石地面 |

洞石为原作者制作的程序材质。室内材质依原设计重新调色。每张 WebP 的红、绿、蓝通道分别储存漫反射亮度变化、粗糙度变化和表面高低变化。贴图按世界坐标以米为单位投影，家具合批后仍保持纹理大小。胡桃木纹理在制作时转了 90°。圈绒用表面高低弱化了原面料的彩色格纹。为减少下载时间，线上版本将贴图限制在 512 像素以内，并使用质量 75 的有损 WebP 压缩。

`scripts/prepare-surfaces.py` 可从上述来源重建贴图。安装 NumPy 与 Pillow 后，从项目根目录运行 `python3 scripts/prepare-surfaces.py --cache /tmp/azur-cc0-materials`。首次运行会联网下载原素材。
