import * as THREE from 'three';
import type { BackboneSegment, Bond, ImportedStructure, LigandAtom, Residue, ResidueRole, StructureData } from './types';
import { elementColor, elementRadius, isValidColor, normalizeElement } from './elements';

/**
 * 项目约定的导入格式：Protein Atlas Structure JSON（.pas.json / .json）
 *
 * {
 *   "format": "protein-atlas-structure",
 *   "version": 1,
 *   "metadata": { "name", "pdbId", "ligandName", "description", "pocketVolume", "hydrogenBonds" },
 *   "residues": [ { "id", "code", "name?", "role", "x","y","z", "color?" } ],
 *   "ligand":  { "name?", "atoms": [ { "id", "element", "x","y","z", "color?", "radius?" } ],
 *                         "bonds": [ { "from", "to", "order?" } ] } | null,
 *   "backbone?": [ { "color", "points": [[x,y,z], ...], "width?", "surfaceWidth?" } ]
 * }
 */

export const STRUCTURE_FORMAT = 'protein-atlas-structure';
export const SUPPORTED_VERSION = 1;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** 致命解析错误：携带全部可展示的问题描述（支持中文定位） */
export class StructureFormatError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues[0] ?? '结构文件格式不正确');
    this.name = 'StructureFormatError';
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value);

const ROLE_COLORS: Record<ResidueRole, string> = {
  active: '#71c9e6',
  support: '#f0c76e',
  loop: '#9aabb4',
};
const ROLES: ResidueRole[] = ['active', 'support', 'loop'];

const KNOWN_ROOT_KEYS = new Set(['format', 'version', 'metadata', 'residues', 'ligand', 'backbone']);
const KNOWN_METADATA_KEYS = new Set(['name', 'pdbId', 'ligandName', 'description', 'pocketVolume', 'hydrogenBonds']);
const KNOWN_RESIDUE_KEYS = new Set(['id', 'code', 'name', 'role', 'x', 'y', 'z', 'color']);
const KNOWN_ATOM_KEYS = new Set(['id', 'element', 'x', 'y', 'z', 'color', 'radius']);
const KNOWN_BOND_KEYS = new Set(['from', 'to', 'order']);
const KNOWN_LIGAND_KEYS = new Set(['name', 'atoms', 'bonds']);
const KNOWN_SEGMENT_KEYS = new Set(['color', 'points', 'width', 'surfaceWidth']);

function clipText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function parseResidues(raw: unknown, errors: string[], warnings: string[]): Residue[] {
  if (!Array.isArray(raw)) {
    errors.push('residues 必须是数组（没有残基时使用空数组 []）。');
    return [];
  }
  const seen = new Set<number>();
  const result: Residue[] = [];
  raw.forEach((item, index) => {
    const path = `residues[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} 必须是残基对象。`);
      return;
    }
    for (const key of Object.keys(item)) {
      if (!KNOWN_RESIDUE_KEYS.has(key)) warnings.push(`${path}.${key} 为未识别字段，已忽略。`);
    }
    const id = item.id;
    if (!isInteger(id) || id <= 0) {
      errors.push(`${path}.id 必须是正整数（当前值：${JSON.stringify(id)}）。`);
      return;
    }
    if (seen.has(id)) {
      errors.push(`${path}.id = ${id} 与其它残基重复。`);
      return;
    }
    const code = typeof item.code === 'string' ? item.code.trim() : '';
    if (!code) {
      errors.push(`${path}.code 为必填的非空字符串，例如 "HIS102"。`);
      return;
    }
    const role = item.role;
    if (!ROLES.includes(role as ResidueRole)) {
      errors.push(`${path}.role 必须是 active / support / loop 之一（当前值：${JSON.stringify(role)}）。`);
      return;
    }
    const coords = ['x', 'y', 'z'] as const;
    if (coords.some(axis => !isFiniteNumber(item[axis]))) {
      errors.push(`${path} 的 x / y / z 坐标必须全部为有限数值（单位 Å）。`);
      return;
    }
    let color = ROLE_COLORS[role as ResidueRole];
    if (item.color !== undefined) {
      if (isValidColor(item.color)) color = item.color.trim();
      else warnings.push(`${path}.color 不是合法的 #RRGGBB 颜色，已按角色回退。`);
    }
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : code;
    seen.add(id);
    result.push({
      id,
      code: clipText(code, 16),
      name: clipText(name, 24),
      role: role as ResidueRole,
      x: item.x as number,
      y: item.y as number,
      z: item.z as number,
      color,
    });
  });
  return result;
}

function parseLigand(raw: unknown, errors: string[], warnings: string[]): { atoms: LigandAtom[]; bonds: Bond[]; ligandName?: string } {
  if (raw === undefined || raw === null) return { atoms: [], bonds: [] };
  if (!isRecord(raw)) {
    errors.push('ligand 必须是对象；没有配体时请使用 null 或省略该字段。');
    return { atoms: [], bonds: [] };
  }
  for (const key of Object.keys(raw)) {
    if (!KNOWN_LIGAND_KEYS.has(key)) warnings.push(`ligand.${key} 为未识别字段，已忽略。`);
  }
  const ligandName = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined;

  if (!Array.isArray(raw.atoms)) {
    errors.push('ligand.atoms 必须是数组（没有配体原子时请将 ligand 设为 null）。');
    return { atoms: [], bonds: [] };
  }
  const atoms: LigandAtom[] = [];
  const atomIds = new Set<string>();
  raw.atoms.forEach((item, index) => {
    const path = `ligand.atoms[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} 必须是原子对象。`);
      return;
    }
    for (const key of Object.keys(item)) {
      if (!KNOWN_ATOM_KEYS.has(key)) warnings.push(`${path}.${key} 为未识别字段，已忽略。`);
    }
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id) {
      errors.push(`${path}.id 为必填的非空字符串，例如 "C1"。`);
      return;
    }
    if (atomIds.has(id)) {
      errors.push(`${path}.id = "${id}" 与其它配体原子重复。`);
      return;
    }
    const element = normalizeElement(item.element);
    if (!element) {
      errors.push(`${path}.element 为必填的元素符号，例如 C / N / O / S。`);
      return;
    }
    if (!['C', 'N', 'O', 'S', 'H', 'P', 'F', 'Cl', 'Br', 'I'].includes(element)) {
      warnings.push(`${path} 的元素 "${element}" 不在内置元素表中，已使用通用配色与半径。`);
    }
    if (['x', 'y', 'z'].some(axis => !isFiniteNumber(item[axis]))) {
      errors.push(`${path} 的 x / y / z 坐标必须全部为有限数值。`);
      return;
    }
    let color = elementColor(element);
    if (item.color !== undefined) {
      if (isValidColor(item.color)) color = item.color.trim();
      else warnings.push(`${path}.color 不是合法的 #RRGGBB 颜色，已按元素回退。`);
    }
    let radius = elementRadius(element);
    if (item.radius !== undefined) {
      if (isFiniteNumber(item.radius) && item.radius > 0 && item.radius < 5) radius = item.radius;
      else warnings.push(`${path}.radius 必须是 0–5 之间的正数，已按元素回退。`);
    }
    atomIds.add(id);
    atoms.push({ id, element, x: item.x as number, y: item.y as number, z: item.z as number, color, radius });
  });

  const bonds: Bond[] = [];
  if (raw.bonds !== undefined) {
    if (!Array.isArray(raw.bonds)) {
      errors.push('ligand.bonds 必须是数组。');
    } else {
      const seen = new Set<string>();
      raw.bonds.forEach((item, index) => {
        const path = `ligand.bonds[${index}]`;
        if (!isRecord(item)) {
          errors.push(`${path} 必须是键对象 { "from", "to" }。`);
          return;
        }
        for (const key of Object.keys(item)) {
          if (!KNOWN_BOND_KEYS.has(key)) warnings.push(`${path}.${key} 为未识别字段，已忽略。`);
        }
        const from = typeof item.from === 'string' ? item.from.trim() : '';
        const to = typeof item.to === 'string' ? item.to.trim() : '';
        if (!from || !to) {
          errors.push(`${path} 必须同时包含 from 与 to 原子 id。`);
          return;
        }
        if (!atomIds.has(from) || !atomIds.has(to)) {
          errors.push(`${path} 引用了不存在的原子（from: "${from}", to: "${to}"）。`);
          return;
        }
        if (from === to) {
          warnings.push(`${path} 的 from 与 to 相同（${from}），已忽略该自键。`);
          return;
        }
        const dedupeKey = [from, to].sort().join('–');
        if (seen.has(dedupeKey)) {
          warnings.push(`${path}（${from}–${to}）为重复键，已忽略。`);
          return;
        }
        let order: Bond['order'] = 1;
        if (item.order !== undefined) {
          if (item.order === 1 || item.order === 2 || item.order === 3) order = item.order;
          else warnings.push(`${path}.order 仅支持 1 / 2 / 3，已按单键处理。`);
        }
        seen.add(dedupeKey);
        bonds.push({ from, to, order });
      });
    }
  }
  return { atoms, bonds, ligandName };
}

function parseBackbone(raw: unknown, residues: Residue[], errors: string[], warnings: string[]): BackboneSegment[] {
  if (raw === undefined) {
    // 未提供骨架时，按残基编号顺序生成一条平滑主链轨迹，保证卡通/表面视图不为空。
    if (residues.length < 2) return [];
    const ordered = [...residues].sort((a, b) => a.id - b.id);
    const curve = new THREE.CatmullRomCurve3(ordered.map(r => new THREE.Vector3(r.x, r.y, r.z)), false, 'catmullrom', 0.5);
    return [{
      color: '#6b9fe9',
      width: 5,
      surfaceWidth: 12,
      points: curve.getPoints(90).map(p => [p.x, p.y, p.z] as [number, number, number]),
    }];
  }
  if (!Array.isArray(raw)) {
    errors.push('backbone 必须是数组，或省略该字段由残基自动生成。');
    return [];
  }
  const segments: BackboneSegment[] = [];
  raw.forEach((item, index) => {
    const path = `backbone[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} 必须是骨架段对象。`);
      return;
    }
    for (const key of Object.keys(item)) {
      if (!KNOWN_SEGMENT_KEYS.has(key)) warnings.push(`${path}.${key} 为未识别字段，已忽略。`);
    }
    if (!Array.isArray(item.points) || item.points.length < 2) {
      errors.push(`${path}.points 至少需要包含 2 个 [x, y, z] 坐标点。`);
      return;
    }
    const points: Array<[number, number, number]> = [];
    let badPoint = false;
    item.points.forEach((point: unknown, pointIndex: number) => {
      if (!Array.isArray(point) || point.length !== 3 || !point.every(isFiniteNumber)) {
        errors.push(`${path}.points[${pointIndex}] 必须是包含 3 个有限数值的数组。`);
        badPoint = true;
      } else {
        points.push([point[0], point[1], point[2]]);
      }
    });
    if (badPoint) return;
    let color = '#6b9fe9';
    if (item.color !== undefined) {
      if (isValidColor(item.color)) color = item.color.trim();
      else warnings.push(`${path}.color 不是合法的 #RRGGBB 颜色，已使用默认骨架色。`);
    }
    const segment: BackboneSegment = { color, points };
    if (item.width !== undefined) {
      if (isFiniteNumber(item.width) && item.width > 0 && item.width <= 30) segment.width = item.width;
      else warnings.push(`${path}.width 必须是 0–30 之间的正数，已忽略。`);
    }
    if (item.surfaceWidth !== undefined) {
      if (isFiniteNumber(item.surfaceWidth) && item.surfaceWidth > 0 && item.surfaceWidth <= 40) segment.surfaceWidth = item.surfaceWidth;
      else warnings.push(`${path}.surfaceWidth 必须是 0–40 之间的正数，已忽略。`);
    }
    segments.push(segment);
  });
  return segments;
}

/** 将 JSON 文本解析为统一结构；致命问题抛出 StructureFormatError，非致命问题写入 warnings。 */
export function parseStructureJson(text: string, fileName: string): ImportedStructure {
  const errors: string[] = [];
  const warnings: string[] = [];

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    const looksLikePdb = /^(HEADER|ATOM|HETATM|REMARK)\b/m.test(text.slice(0, 2000));
    throw new StructureFormatError(looksLikePdb ? [
      `文件 ${fileName} 不是合法的结构 JSON，内容看起来是 PDB / mmCIF 纯文本。`,
      '本工作流目前只支持 protein-atlas-structure JSON，请先转换或使用模板。',
    ] : [
      `文件 ${fileName} 不是合法 JSON：${reason}`,
      '请检查是否缺少逗号、括号，或使用了 JSON 不支持的注释。',
    ]);
  }

  if (!isRecord(root)) {
    throw new StructureFormatError(['根节点必须是 JSON 对象，不能是数组或纯数值。']);
  }
  for (const key of Object.keys(root)) {
    if (!KNOWN_ROOT_KEYS.has(key)) warnings.push(`根字段 "${key}" 未在格式规范中定义，已忽略。`);
  }

  const format = root.format;
  if (format !== STRUCTURE_FORMAT) {
    throw new StructureFormatError([
      `format 字段必须为 "${STRUCTURE_FORMAT}"（当前值：${JSON.stringify(format)}）。`,
      '请参考导入对话框中的格式说明，或点击“下载模板”获取可编辑示例。',
    ]);
  }
  if (root.version !== SUPPORTED_VERSION) {
    throw new StructureFormatError([`version 必须为 ${SUPPORTED_VERSION}（当前值：${JSON.stringify(root.version)}）。`]);
  }

  // metadata（全部字段可选，缺失时使用占位信息）
  const metadata: StructureData['metadata'] = {
    name: '导入的结构',
    pdbId: 'IMPORTED',
    ligandName: '',
  };
  if (root.metadata !== undefined) {
    if (!isRecord(root.metadata)) {
      warnings.push('metadata 必须是对象，已使用默认元数据。');
    } else {
      for (const key of Object.keys(root.metadata)) {
        if (!KNOWN_METADATA_KEYS.has(key)) warnings.push(`metadata.${key} 为未识别字段，已忽略。`);
      }
      if (typeof root.metadata.name === 'string' && root.metadata.name.trim()) {
        metadata.name = clipText(root.metadata.name.trim(), 80);
      }
      if (typeof root.metadata.pdbId === 'string' && root.metadata.pdbId.trim()) {
        metadata.pdbId = clipText(root.metadata.pdbId.trim(), 24);
      }
      if (typeof root.metadata.ligandName === 'string' && root.metadata.ligandName.trim()) {
        metadata.ligandName = clipText(root.metadata.ligandName.trim(), 24);
      }
      if (typeof root.metadata.description === 'string' && root.metadata.description.trim()) {
        metadata.description = clipText(root.metadata.description.trim(), 400);
      }
      if (root.metadata.pocketVolume !== undefined) {
        if (typeof root.metadata.pocketVolume === 'string' && root.metadata.pocketVolume.trim()) {
          metadata.pocketVolume = root.metadata.pocketVolume.trim();
        } else if (isFiniteNumber(root.metadata.pocketVolume) && root.metadata.pocketVolume > 0) {
          metadata.pocketVolume = `${root.metadata.pocketVolume} Å³`;
        } else {
          warnings.push('metadata.pocketVolume 必须是正数或字符串（如 "486 Å³"），已忽略。');
        }
      }
      if (root.metadata.hydrogenBonds !== undefined) {
        if (isInteger(root.metadata.hydrogenBonds) && root.metadata.hydrogenBonds >= 0) {
          metadata.hydrogenBonds = root.metadata.hydrogenBonds;
        } else {
          warnings.push('metadata.hydrogenBonds 必须是非负整数，已忽略。');
        }
      }
    }
  }

  const residues = parseResidues(root.residues, errors, warnings);
  const { atoms, bonds, ligandName } = parseLigand(root.ligand, errors, warnings);
  if (ligandName && !metadata.ligandName) metadata.ligandName = ligandName;
  const backbone = parseBackbone(root.backbone, residues, errors, warnings);

  if (errors.length > 0) {
    throw new StructureFormatError(errors);
  }

  if (residues.length === 0 && atoms.length === 0) {
    warnings.push('该结构不包含任何残基或配体原子，3D 视图将显示为空态。');
  }
  if (residues.length > 0 && atoms.length === 0) {
    warnings.push('该结构没有配体（ligand 为空），配体原子面板与相互作用将进入空态。');
  }

  return {
    structure: { metadata, residues, ligandAtoms: atoms, bonds, backbone },
    warnings,
    fileName,
  };
}

/** 读取并解析本地文件，支持通过 AbortSignal 取消（取消时抛出 DOMException AbortError）。 */
export async function readStructureFile(file: File, signal?: AbortSignal): Promise<ImportedStructure> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.json')) {
    throw new StructureFormatError([
      `不支持的文件类型：${file.name}`,
      '本工作流仅支持 .json 结构文件（PDB / mmCIF 解析不在当前版本范围内）。',
    ]);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new StructureFormatError([
      `文件过大：${(file.size / 1024 / 1024).toFixed(1)} MB，单文件上限为 ${MAX_FILE_BYTES / 1024 / 1024} MB。`,
    ]);
  }
  if (file.size === 0) {
    throw new StructureFormatError(['文件为空（0 字节），请重新选择有效的结构文件。']);
  }
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');

  const text = await file.text();
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  // 让 UI 有机会在长文本解析前渲染“解析中”状态。
  await new Promise<void>(resolve => setTimeout(resolve, 30));
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  return parseStructureJson(text, file.name);
}

export function buildTemplateText(): string {
  return JSON.stringify({
    format: STRUCTURE_FORMAT,
    version: SUPPORTED_VERSION,
    metadata: {
      name: '示例导入结构',
      pdbId: 'DEMO-01',
      ligandName: 'LIG-A',
      description: '可删除或修改任意条目；没有配体时把 ligand 设为 null，空结构把 residues 设为 []。',
      pocketVolume: '486 Å³',
      hydrogenBonds: 2,
    },
    residues: [
      { id: 1, code: 'HIS57', name: '组氨酸', role: 'active', x: -1.2, y: 0.6, z: 0.0 },
      { id: 2, code: 'ASP102', name: '天冬氨酸', role: 'active', x: 1.1, y: 0.2, z: -0.4 },
      { id: 3, code: 'PHE195', name: '苯丙氨酸', role: 'support', x: 0.4, y: 1.1, z: 0.8 },
      { id: 4, code: 'GLY216', name: '甘氨酸', role: 'loop', x: -0.6, y: -0.8, z: 0.3 },
    ],
    ligand: {
      name: 'LIG-A',
      atoms: [
        { id: 'C1', element: 'C', x: 0.0, y: 0.0, z: 0.0 },
        { id: 'C2', element: 'C', x: 0.55, y: 0.26, z: 0.08 },
        { id: 'N1', element: 'N', x: 0.98, y: -0.18, z: 0.18 },
        { id: 'O1', element: 'O', x: -0.48, y: 0.35, z: 0.05 },
      ],
      bonds: [
        { from: 'C1', to: 'C2' },
        { from: 'C1', to: 'O1', order: 2 },
        { from: 'C2', to: 'N1' },
      ],
    },
    backbone: [
      {
        color: '#6b9fe9',
        width: 5,
        surfaceWidth: 12,
        points: [
          [-2.4, 0.2, -0.8], [-1.6, 0.4, 0.5], [-0.6, -0.8, 0.3],
          [0.4, 1.1, 0.8], [1.1, 0.2, -0.4], [2.2, 0.5, -0.1],
        ],
      },
    ],
  }, null, 2);
}
