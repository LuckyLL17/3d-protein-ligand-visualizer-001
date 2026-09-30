import type { Structure } from './types';

// 内置示例结构：与原硬编码数据保持一致，作为默认展示与导入对照。
export const EXAMPLE_STRUCTURE: Structure = {
  format: 'protein-atlas/structure',
  version: 1,
  metadata: {
    name: '示例结构 · 结合口袋',
    pdbId: '1MOL',
    description: '内置示例：7 个关键残基与一个小分子配体。',
    source: 'builtin',
    pocketVolume: 486
  },
  residues: [
    { id: 41, code: 'GLU41', name: '谷氨酸', x: -1.6, y: 0.4, z: 0.5, color: '#ef8e77', role: 'active' },
    { id: 78, code: 'TYR78', name: '酪氨酸', x: -0.7, y: 1.15, z: -0.25, color: '#f0c76e', role: 'support' },
    { id: 102, code: 'HIS102', name: '组氨酸', x: 0.4, y: 0.75, z: 0.2, color: '#71c9e6', role: 'active' },
    { id: 146, code: 'ASP146', name: '天冬氨酸', x: 1.2, y: 0.15, z: -0.45, color: '#e88389', role: 'active' },
    { id: 183, code: 'PHE183', name: '苯丙氨酸', x: 1.8, y: 0.7, z: 0.35, color: '#c28ce8', role: 'support' },
    { id: 219, code: 'SER219', name: '丝氨酸', x: 0.55, y: -0.3, z: -0.65, color: '#8fd6a2', role: 'loop' },
    { id: 244, code: 'GLY244', name: '甘氨酸', x: -1.05, y: -0.55, z: -0.3, color: '#9aabb4', role: 'loop' }
  ],
  ligand: {
    name: 'LIG-17',
    atoms: [
      { id: 'C1', element: 'C', x: 0, y: 0, z: 0, color: '#d6e1e4', radius: 0.17 },
      { id: 'C2', element: 'C', x: 0.55, y: 0.26, z: 0.08, color: '#d6e1e4', radius: 0.17 },
      { id: 'N1', element: 'N', x: 0.98, y: -0.18, z: 0.18, color: '#54b9e3', radius: 0.2 },
      { id: 'O1', element: 'O', x: -0.48, y: 0.35, z: 0.05, color: '#ec7474', radius: 0.18 },
      { id: 'O2', element: 'O', x: -0.15, y: -0.5, z: -0.1, color: '#ec7474', radius: 0.18 },
      { id: 'S1', element: 'S', x: 0.42, y: 0.05, z: -0.62, color: '#e7c35f', radius: 0.24 }
    ],
    bonds: [['C1', 'C2'], ['C1', 'O1'], ['C1', 'O2'], ['C2', 'N1'], ['C2', 'S1']]
  }
};
