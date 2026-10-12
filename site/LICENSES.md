# Third-party assets and licences

## Home page: "Inside the building" 3D section (LIGHT-477)

The 3D building is built in code (no model file). Everything below is self-hosted under `assets/3d/`; nothing loads from a third-party host.

### Credits (courtesy lines)

- Environment lighting: "Studio Small 09" HDRI by Sergej Majboroda, from Poly Haven (https://polyhaven.com/a/studio_small_09), CC0 1.0.
- Surface textures: Asphalt031, Concrete034, Metal027 and PaintedMetal004 from ambientCG (https://ambientcg.com), CC0 1.0.
- Three.js 0.185.1 (MIT), bundled and minified into `assets/3d/home-building.3d.js`.

### Sources (as passed by Security in LIGHT-476)

| Source file | Licence | SHA-256 |
| --- | --- | --- |
| `studio_small_09_1k.hdr` (Poly Haven) | CC0 1.0 | `e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45` |
| `Asphalt031_1K-JPG.zip` (ambientCG) | CC0 1.0 | `f98114b8fb083fc65925c3b4568b131e37c9a23357d432a16e59676dbc69f964` |
| `Concrete034_1K-JPG.zip` (ambientCG) | CC0 1.0 | `5839d284d94ffb8d2a56df742ec522b13dd311c52dbd42b8fd33f0409ceedb81` |
| `Metal027_1K-JPG.zip` (ambientCG) | CC0 1.0 | `12b2d9996d532cf8a31820d24f2ea83e3217b89da060c4fb29c3c5177535ac72` |
| `PaintedMetal004_1K-JPG.zip` (ambientCG) | CC0 1.0 | `02c243e8e8441f0ee24e68645f5d8c9bd6d8ee0a3b9bfa3d952840902653f978` |

Only the Color, NormalGL, Roughness and Metalness maps were read out of each zip; the `.blend`, `.usdc`, `.mtlx`, `.tres` and preview files were never extracted.

### Shipped derivatives

Made by `build-home3d/scripts/make-assets.py`: maps resized to 256 px (phones) and 512 px (desktop) and saved as WebP; the HDRI box-filtered to 256x128 (phones) and 512x256 (desktop) in linear light and saved as Radiance RGBE.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `assets/3d/home/env/studio_small_09_256x128.hdr` | 131121 | `09c691128879e9a2e83dd8ceadc2b68ffcb5dad6bd59b9b0cd9bd3fa81700691` |
| `assets/3d/home/env/studio_small_09_512x256.hdr` | 524337 | `debcd2f39e287b132ca1400b83d38cad6a43f10c8749e26139701dd216c38a26` |
| `assets/3d/home/texs/Asphalt031_Color.webp` | 10984 | `7009a4d120029b323f38ba52c85842a611cf1e1b34a2940ffb0ad87a019cd3de` |
| `assets/3d/home/texs/Asphalt031_NormalGL.webp` | 1192 | `652f4858e5df176291ce0964fb42279bc55283b0fede47ee0b4211aae312280e` |
| `assets/3d/home/texs/Asphalt031_Roughness.webp` | 4726 | `947130ada042411f79faeccac84c20d6a3a5756af485a9ded5f66572c247ea8a` |
| `assets/3d/home/texs/Concrete034_Color.webp` | 1468 | `223bd728c0fd6a018640f83170d8d7d8bc8f86420bec0c25df55bac318e9afff` |
| `assets/3d/home/texs/Concrete034_NormalGL.webp` | 4594 | `d737f4e394feaeae37dede4fede67150ecf513507e749c2357da1eaf67188245` |
| `assets/3d/home/texs/Concrete034_Roughness.webp` | 2758 | `7b8af90ae3a3f3388099bb1309416eac42cb2393a9fba32ea1993cded8785ff3` |
| `assets/3d/home/texs/Metal027_Color.webp` | 384 | `68861103bb89e992876bca64f8c8697a60d48c73c8155c65d3269ec9322ac81e` |
| `assets/3d/home/texs/Metal027_Metalness.webp` | 178 | `2b25b9eb2f12a1dbf4bebab4dd66efc7612f12f22b55e720971b04b374174195` |
| `assets/3d/home/texs/Metal027_NormalGL.webp` | 264 | `24a7939cfd99186427066ef1648e0fbe4d5a87d0faf7f917d171b85f1f413dd4` |
| `assets/3d/home/texs/Metal027_Roughness.webp` | 218 | `97a6782741b4945543efc40080642c59c5ee975e5342fd23be2571951d819317` |
| `assets/3d/home/texs/PaintedMetal004_Color.webp` | 12784 | `cbb159ee9f73a158dc8fa88a63218909805c9732c1fcc6b4348bc3b861226767` |
| `assets/3d/home/texs/PaintedMetal004_Metalness.webp` | 12600 | `150e4d0a3a85205e50c3693aaae24a25e85c69fafeb6839b228f026a0b363c6b` |
| `assets/3d/home/texs/PaintedMetal004_NormalGL.webp` | 584 | `9ef4d864695da59a90a7ef92040dfb38b3aa81d625b439e13fd8f4def3a2b9c8` |
| `assets/3d/home/texs/PaintedMetal004_Roughness.webp` | 5838 | `8959fbefc3165af93f3f1ac319501a4684fc32362dd0254b6adfb6f3d820c187` |
| `assets/3d/home/texm/Asphalt031_Color.webp` | 62110 | `b46fdd0e20108f94b93dc9d72896aea54e90861eb625c8b1586d7cd72198c55a` |
| `assets/3d/home/texm/Asphalt031_NormalGL.webp` | 32008 | `e123794470582d32e9d972ddfb581a1f094f5d72212dffc5013bd9e7b7118f37` |
| `assets/3d/home/texm/Asphalt031_Roughness.webp` | 58240 | `a9d2d6dce756f6aa36e05444945314e09317e43be9fc0603e065973f32c73bdf` |
| `assets/3d/home/texm/Concrete034_Color.webp` | 6706 | `bd0e08724b66601a520e610ed9ddfd9a011b94827c602ace488ba120c10fa7a0` |
| `assets/3d/home/texm/Concrete034_NormalGL.webp` | 24390 | `4e9279294aa3093e0f92e13cf839dddff5d7fff6c147d60190d624afe5f81c6b` |
| `assets/3d/home/texm/Concrete034_Roughness.webp` | 8616 | `16a73c1534f0f46aa1cec311b9a262af3b034c7138e52ae55998f7228bd631d7` |
| `assets/3d/home/texm/Metal027_Color.webp` | 1574 | `c404927a2dd1ed91705f5fea24d0e5b35cdb5469a7f8724141455e06742ffc61` |
| `assets/3d/home/texm/Metal027_Metalness.webp` | 528 | `87bbc1c483761edad1a3b525666b95f1c2ef59caa4df4b7d818f4cd82c6de912` |
| `assets/3d/home/texm/Metal027_NormalGL.webp` | 788 | `479152ceae4e884f89416d30c1147a650f57fa4ddff461c1b16a1ecffa4308e2` |
| `assets/3d/home/texm/Metal027_Roughness.webp` | 1060 | `cf6537b02137ef3ab7e6b9bc457e6828c51219f0acd8947d9264e5bab9560304` |
| `assets/3d/home/texm/PaintedMetal004_Color.webp` | 46194 | `0b519e10158ce37484075023baad8c289756eb59f4e5612c7307ee9ef76c0fe6` |
| `assets/3d/home/texm/PaintedMetal004_Metalness.webp` | 40252 | `ac7b0da013b80bac0387f3e3bb0893c819359dff61f4fad2b60e8adec60fbe5b` |
| `assets/3d/home/texm/PaintedMetal004_NormalGL.webp` | 5738 | `86eb7ab35d3adc90d2cbd9b4485b5f85ba7edeb4bd2733845f16dac1683f45cb` |
| `assets/3d/home/texm/PaintedMetal004_Roughness.webp` | 19898 | `f0b6337b663a54d1ee139848b274a12793b91a2fb19bba2035a56923e48a8873` |

### Built bundle

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `assets/3d/home-building.3d.js` | 592827 | `09c05ca8f0b590ecacb924ff36dd535bb5252cd985a61570696dba7ec146773f` |

Rebuild: `cd build-home3d && npm ci && npm run assets && npm run build`. esbuild 0.28.2 is a dev-only dependency; the lockfile carries the integrity values Security passed (three 0.185.1, esbuild 0.28.2, @esbuild/linux-x64 0.28.2).

