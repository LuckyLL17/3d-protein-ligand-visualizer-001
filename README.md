# 3D 蛋白质结构与配体结合可视化平台

React + Vite + TypeScript + React Three Fiber 的结构生物学可视化基础项目，用于展示蛋白质骨架、关键残基、配体原子和结合口袋关系。

## 当前能力

- 卡通带状、表面模型、原子视图切换
- 关键残基选择与空间定位
- 配体原子点击选择
- 配体旋转
- 关键残基、配体原子和相互作用图例
- 结合口袋指标卡片
- 残基角色、空间坐标、距离和作用类型展示
- **从页面导入本地结构文件（Protein Atlas Structure JSON），导入后替换内置示例并同步全部面板与 3D 视图**

## 本地结构导入

点击顶栏「导入结构」，选择 `.json` 文件或直接拖拽到对话框；对话框内可「下载模板」。

文件格式（`.pas.json` / `.json`，上限 8 MB）：

```json
{
  "format": "protein-atlas-structure",
  "version": 1,
  "metadata": {
    "name": "结构名称",
    "pdbId": "DEMO-01",
    "ligandName": "LIG-A",
    "description": "可选说明",
    "pocketVolume": "486 Å³",
    "hydrogenBonds": 2
  },
  "residues": [
    { "id": 1, "code": "HIS57", "name": "组氨酸", "role": "active", "x": -1.2, "y": 0.6, "z": 0.0 }
  ],
  "ligand": {
    "name": "LIG-A",
    "atoms": [
      { "id": "C1", "element": "C", "x": 0.0, "y": 0.0, "z": 0.0 }
    ],
    "bonds": [
      { "from": "C1", "to": "C2", "order": 1 }
    ]
  },
  "backbone": [
    { "color": "#6b9fe9", "width": 5, "surfaceWidth": 12, "points": [[0,0,0], [1,1,0]] }
  ]
}
```

约定：

- `role` 仅允许 `active` / `support` / `loop`；残基 `color` 与配体原子的 `color` / `radius` 可省略，按角色或元素表（C/N/O/S/H/P/F/Cl/Br/I）回退。
- `backbone` 可省略，会按残基编号生成平滑主链；没有配体时使用 `"ligand": null`；完全空结构使用 `"residues": []` 且 `"ligand": null`，界面与画布进入空态而不会崩溃。
- 解析中可取消；格式或字段错误会列出具体字段位置，可直接重新选择；重复键、未知元素等非致命问题以警告形式提示但仍会导入。
- 导入成功后可通过顶栏「恢复示例」回到内置数据。PDB/mmCIF 纯文本暂不支持，会给出明确提示。

## 启动

```bash
npm install
npm run dev
```

## 校验脚本

```bash
npm test   # 结构解析（19 项）与文件读取/取消（4 项）
```

当前使用内置示例结构数据，后续可接入 PDB/mmCIF 文件解析、真实原子键推断、分子对接结果、氢键几何筛选和结构比对。
