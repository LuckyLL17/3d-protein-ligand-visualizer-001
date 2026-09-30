import type { ElementSymbol, ResidueRole } from './types';

// CPK 元素配色与原子半径（Å），用于把元素符号转换为 3D 渲染属性。
export const ELEMENT_STYLE: Record<ElementSymbol, { color: string; radius: number }> = {
  C: { color: '#d6e1e4', radius: 0.17 },
  N: { color: '#54b9e3', radius: 0.2 },
  O: { color: '#ec7474', radius: 0.18 },
  S: { color: '#e7c35f', radius: 0.24 },
  P: { color: '#e8a05c', radius: 0.22 },
  F: { color: '#7fd6a2', radius: 0.16 },
  Cl: { color: '#5fd07a', radius: 0.22 },
  Br: { color: '#b5653a', radius: 0.24 },
  I: { color: '#a06ed0', radius: 0.26 },
  B: { color: '#e8c56d', radius: 0.18 },
  Si: { color: '#6b9fe9', radius: 0.22 }
};

export const DEFAULT_ATOM_STYLE = { color: '#9aabb4', radius: 0.18 };

export function elementStyle(element: string): { color: string; radius: number } {
  return (ELEMENT_STYLE as Record<string, { color: string; radius: number }>)[element] ?? DEFAULT_ATOM_STYLE;
}

export const SUPPORTED_ELEMENTS = Object.keys(ELEMENT_STYLE) as ElementSymbol[];

// 残基配色板：按残基编号哈希取色，保证同一结构中颜色稳定且可区分。
const RESIDUE_PALETTE = ['#ef8e77', '#f0c76e', '#71c9e6', '#e88389', '#c28ce8', '#8fd6a2', '#9aabb4', '#e8a05c', '#7fd1b9', '#d98cb3', '#8ea4e8', '#c9d171'];

export function residueColor(id: number): string {
  return RESIDUE_PALETTE[((id % RESIDUE_PALETTE.length) + RESIDUE_PALETTE.length) % RESIDUE_PALETTE.length];
}

export const ROLE_LABEL: Record<ResidueRole, string> = {
  active: '结合活性位点',
  support: '口袋支撑',
  loop: '柔性环区'
};

// 三字母残基名 -> 中文名（PDB 导入时使用）。
export const RESIDUE_CN: Record<string, string> = {
  ALA: '丙氨酸', ARG: '精氨酸', ASN: '天冬酰胺', ASP: '天冬氨酸', CYS: '半胱氨酸',
  GLN: '谷氨酰胺', GLU: '谷氨酸', GLY: '甘氨酸', HIS: '组氨酸', ILE: '异亮氨酸',
  LEU: '亮氨酸', LYS: '赖氨酸', MET: '甲硫氨酸', PHE: '苯丙氨酸', PRO: '脯氨酸',
  SER: '丝氨酸', THR: '苏氨酸', TRP: '色氨酸', TYR: '酪氨酸', VAL: '缬氨酸',
  HOH: '水', WAT: '水'
};

export function residueCnName(resName: string): string {
  return RESIDUE_CN[resName.toUpperCase()] ?? resName;
}
