// 结构文件模板：用户可下载后填写，再通过「导入结构」加载。
export const STRUCTURE_TEMPLATE = `{
  "format": "protein-atlas/structure",
  "version": 1,
  "metadata": {
    "name": "我的结构",
    "pdbId": "0XXX",
    "description": "结构描述（可选）",
    "pocketVolume": 420
  },
  "residues": [
    { "id": 10, "code": "ALA10", "name": "丙氨酸", "x": -1.2, "y": 0.3, "z": 0.2, "role": "active" },
    { "id": 11, "code": "GLY11", "name": "甘氨酸", "x": -0.4, "y": 0.9, "z": -0.1, "role": "support" },
    { "id": 12, "code": "VAL12", "name": "缬氨酸", "x": 0.6, "y": 0.4, "z": 0.3, "role": "loop" }
  ],
  "ligand": {
    "name": "LIG-1",
    "atoms": [
      { "id": "C1", "element": "C", "x": 0, "y": 0, "z": 0 },
      { "id": "O1", "element": "O", "x": 0.6, "y": 0.2, "z": 0.1 },
      { "id": "N1", "element": "N", "x": -0.5, "y": -0.3, "z": 0.2 }
    ],
    "bonds": [["C1", "O1"], ["C1", "N1"]]
  }
}
`;
