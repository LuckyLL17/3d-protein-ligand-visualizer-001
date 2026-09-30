import * as THREE from 'three';
import type { StructureData } from './types';

const residues: StructureData['residues'] = [
  { id: 41, code: 'GLU41', name: '谷氨酸', x: -1.6, y: .4, z: .5, color: '#ef8e77', role: 'active' },
  { id: 78, code: 'TYR78', name: '酪氨酸', x: -.7, y: 1.15, z: -.25, color: '#f0c76e', role: 'support' },
  { id: 102, code: 'HIS102', name: '组氨酸', x: .4, y: .75, z: .2, color: '#71c9e6', role: 'active' },
  { id: 146, code: 'ASP146', name: '天冬氨酸', x: 1.2, y: .15, z: -.45, color: '#e88389', role: 'active' },
  { id: 183, code: 'PHE183', name: '苯丙氨酸', x: 1.8, y: .7, z: .35, color: '#c28ce8', role: 'support' },
  { id: 219, code: 'SER219', name: '丝氨酸', x: .55, y: -.3, z: -.65, color: '#8fd6a2', role: 'loop' },
  { id: 244, code: 'GLY244', name: '甘氨酸', x: -1.05, y: -.55, z: -.3, color: '#9aabb4', role: 'loop' },
];

const ligandAtoms: StructureData['ligandAtoms'] = [
  { id: 'C1', element: 'C', x: 0, y: 0, z: 0, color: '#d6e1e4', radius: .17 },
  { id: 'C2', element: 'C', x: .55, y: .26, z: .08, color: '#d6e1e4', radius: .17 },
  { id: 'N1', element: 'N', x: .98, y: -.18, z: .18, color: '#54b9e3', radius: .2 },
  { id: 'O1', element: 'O', x: -.48, y: .35, z: .05, color: '#ec7474', radius: .18 },
  { id: 'O2', element: 'O', x: -.15, y: -.5, z: -.1, color: '#ec7474', radius: .18 },
  { id: 'S1', element: 'S', x: .42, y: .05, z: -.62, color: '#e7c35f', radius: .24 },
];

export const SAMPLE_STRUCTURE: StructureData = {
  metadata: {
    name: '1MOL · 示例激酶结合口袋',
    pdbId: 'PDB-LITE / 1MOL',
    ligandName: 'LIG-17',
    description: '当前模型显示 7 个关键残基和一个小分子配体。通过选择残基查看空间关系与作用类型。',
    pocketVolume: '486 Å³',
    hydrogenBonds: 4,
  },
  residues,
  ligandAtoms,
  bonds: [
    { from: 'C1', to: 'C2', order: 1 },
    { from: 'C1', to: 'O1', order: 1 },
    { from: 'C1', to: 'O2', order: 2 },
    { from: 'C2', to: 'N1', order: 1 },
    { from: 'C2', to: 'S1', order: 1 },
  ],
  backbone: [
    {
      color: '#6b9fe9',
      width: 5,
      surfaceWidth: 12,
      points: Array.from({ length: 46 }, (_, index) => {
        const t = index / 45;
        return [-3.2 + t * 6.4, Math.sin(t * Math.PI * 4) * .72 + Math.cos(t * Math.PI * 2) * .18, Math.cos(t * Math.PI * 3) * .74] as [number, number, number];
      }),
    },
    {
      color: '#d58acb',
      width: 6,
      surfaceWidth: 13,
      points: Array.from({ length: 22 }, (_, index) =>
        [-3.5 + index * .33, 1.4 + Math.sin(index * .55) * .16, -.9 + Math.sin(index * .55) * .25] as [number, number, number]),
    },
  ],
};

// 内置示例专用：相互作用虚线终点（口袋中心方向）
export const sampleInteractionTargets = (): Array<[THREE.Vector3, THREE.Vector3]> =>
  residues
    .filter(item => item.role === 'active')
    .map(item => [
      new THREE.Vector3(item.x, item.y, item.z),
      new THREE.Vector3(item.x * .38, item.y * .34 + .4, item.z * .38),
    ]);
