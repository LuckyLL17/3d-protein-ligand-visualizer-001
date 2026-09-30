// 统一结构模型：所有外部格式（内置示例、JSON、PDB）都转换为该结构，
// 供 3D 场景与各面板消费。

export type ElementSymbol = 'C' | 'N' | 'O' | 'S' | 'P' | 'F' | 'Cl' | 'Br' | 'I' | 'B' | 'Si';

export type ResidueRole = 'active' | 'support' | 'loop';

export type Residue = {
  id: number;
  code: string; // 残基编号，如 GLU41
  name: string; // 中文名称，如 谷氨酸
  x: number;
  y: number;
  z: number;
  color: string;
  role: ResidueRole;
};

export type LigandAtom = {
  id: string;
  element: ElementSymbol;
  x: number;
  y: number;
  z: number;
  color: string;
  radius: number;
};

export type Bond = [string, string];

export type StructureMetadata = {
  name: string;
  pdbId?: string;
  description?: string;
  source?: string; // 数据来源，如 builtin / json / pdb
  pocketVolume?: number; // 结合口袋体积（Å³），可选
};

export type Structure = {
  format: 'protein-atlas/structure';
  version: 1;
  metadata: StructureMetadata;
  residues: Residue[];
  ligand: {
    name: string;
    atoms: LigandAtom[];
    bonds: Bond[];
  };
};

export type ParseResult =
  | { ok: true; structure: Structure; warnings: string[] }
  | { ok: false; errors: string[] };
