// 统一结构数据模型：内置示例与外部导入文件最终都会被归一化成该结构，
// 3D 画布与侧边栏面板只消费这里的类型。

export type ResidueRole = 'active' | 'support' | 'loop';

export interface Residue {
  id: number;
  code: string;
  name: string;
  role: ResidueRole;
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface LigandAtom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  color: string;
  radius: number;
}

export interface Bond {
  from: string;
  to: string;
  order: 1 | 2 | 3;
}

export interface BackboneSegment {
  color: string;
  points: Array<[number, number, number]>;
  /** 卡通带状模式下的线宽 */
  width?: number;
  /** 表面模式下的线宽 */
  surfaceWidth?: number;
}

export interface StructureMetadata {
  name: string;
  pdbId: string;
  ligandName: string;
  description?: string;
  pocketVolume?: string;
  hydrogenBonds?: number;
}

export interface StructureData {
  metadata: StructureMetadata;
  residues: Residue[];
  ligandAtoms: LigandAtom[];
  bonds: Bond[];
  backbone: BackboneSegment[];
}

export interface ImportedStructure {
  structure: StructureData;
  /** 非致命问题（未知元素、重复键、字段回退等），导入成功后提示给用户 */
  warnings: string[];
  fileName: string;
}
