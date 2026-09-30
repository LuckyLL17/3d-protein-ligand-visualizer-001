import { elementStyle, residueColor, SUPPORTED_ELEMENTS } from './colors';
import type { Bond, LigandAtom, ParseResult, Residue, ResidueRole, Structure } from './types';

const ROLES: ResidueRole[] = ['active', 'support', 'loop'];
const COORD_MIN = -100;
const COORD_MAX = 100;

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function coordError(path: string, value: unknown): string | null {
  if (!isFiniteNumber(value)) return `${path} 必须是数字`;
  if (value < COORD_MIN || value > COORD_MAX) return `${path} 超出合理范围（${COORD_MIN} ~ ${COORD_MAX} Å）`;
  return null;
}

// 解析项目约定的 protein-atlas/structure JSON 格式，返回统一结构或带字段路径的中文错误。
export function parseStructureJson(text: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return { ok: false, errors: [`JSON 解析失败：${cause instanceof Error ? cause.message : '文件不是有效的 JSON'}`] };
  }

  if (!isObject(raw)) {
    return { ok: false, errors: ['结构文件顶层必须是 JSON 对象'] };
  }

  // ---- format / version ----
  if (raw.format !== 'protein-atlas/structure') {
    errors.push('format 字段缺失或值不正确（应为 "protein-atlas/structure"）');
  }
  if (raw.version !== 1) {
    errors.push('version 字段缺失或不支持（当前仅支持 version: 1）');
  }

  // ---- metadata ----
  const meta = isObject(raw.metadata) ? raw.metadata : null;
  if (!meta) {
    errors.push('metadata 字段缺失或不是对象');
  } else {
    if (typeof meta.name !== 'string' || meta.name.trim() === '') {
      errors.push('metadata.name 缺失或不是非空字符串');
    }
    if (meta.pdbId !== undefined && typeof meta.pdbId !== 'string') {
      errors.push('metadata.pdbId 必须是字符串');
    }
    if (meta.description !== undefined && typeof meta.description !== 'string') {
      errors.push('metadata.description 必须是字符串');
    }
    if (meta.pocketVolume !== undefined) {
      if (!isFiniteNumber(meta.pocketVolume) || meta.pocketVolume <= 0) {
        errors.push('metadata.pocketVolume 必须是正数（Å³）');
      }
    }
  }

  // ---- residues ----
  const residues: Residue[] = [];
  if (!Array.isArray(raw.residues)) {
    errors.push('residues 字段缺失或不是数组');
  } else {
    const seenIds = new Set<number>();
    raw.residues.forEach((item, index) => {
      const path = `residues[${index}]`;
      if (!isObject(item)) {
        errors.push(`${path} 必须是对象`);
        return;
      }
      const id = item.id;
      if (!Number.isInteger(id)) {
        errors.push(`${path}.id 必须是整数`);
      } else if (seenIds.has(id as number)) {
        errors.push(`${path}.id（${id}）重复`);
      } else {
        seenIds.add(id as number);
      }
      if (typeof item.code !== 'string' || item.code.trim() === '') errors.push(`${path}.code 缺失或不是非空字符串`);
      if (typeof item.name !== 'string' || item.name.trim() === '') errors.push(`${path}.name 缺失或不是非空字符串`);
      if (typeof item.role !== 'string' || !ROLES.includes(item.role as ResidueRole)) {
        errors.push(`${path}.role 必须是 active / support / loop 之一`);
      }
      (['x', 'y', 'z'] as const).forEach(axis => {
        const err = coordError(`${path}.${axis}`, item[axis]);
        if (err) errors.push(err);
      });
      if (item.color !== undefined && typeof item.color !== 'string') {
        errors.push(`${path}.color 必须是字符串（十六进制颜色）`);
      }
      if (errors.some(e => e.startsWith(path))) return;
      residues.push({
        id: item.id as number,
        code: item.code as string,
        name: item.name as string,
        x: item.x as number,
        y: item.y as number,
        z: item.z as number,
        color: (item.color as string | undefined) ?? residueColor(item.id as number),
        role: item.role as ResidueRole
      });
    });
  }

  // ---- ligand（可选）----
  const ligandAtoms: LigandAtom[] = [];
  const bonds: Bond[] = [];
  const ligandRaw = raw.ligand;
  if (ligandRaw !== undefined && !isObject(ligandRaw)) {
    errors.push('ligand 字段必须是对象');
  }
  const ligand = isObject(ligandRaw) ? ligandRaw : null;
  const ligandName = ligand && typeof ligand.name === 'string' && ligand.name.trim() !== '' ? ligand.name : 'LIG';

  if (ligand) {
    if (typeof ligand.name !== 'string' || ligand.name.trim() === '') {
      errors.push('ligand.name 缺失或不是非空字符串');
    }
    if (!Array.isArray(ligand.atoms)) {
      errors.push('ligand.atoms 缺失或不是数组');
    } else {
      const seenAtomIds = new Set<string>();
      ligand.atoms.forEach((item, index) => {
        const path = `ligand.atoms[${index}]`;
        if (!isObject(item)) {
          errors.push(`${path} 必须是对象`);
          return;
        }
        if (typeof item.id !== 'string' || item.id.trim() === '') {
          errors.push(`${path}.id 缺失或不是非空字符串`);
        } else if (seenAtomIds.has(item.id)) {
          errors.push(`${path}.id（${item.id}）重复`);
        } else {
          seenAtomIds.add(item.id);
        }
        if (typeof item.element !== 'string' || !SUPPORTED_ELEMENTS.includes(item.element as LigandAtom['element'])) {
          errors.push(`${path}.element 必须是支持的元素（${SUPPORTED_ELEMENTS.join(' / ')}）`);
        }
        (['x', 'y', 'z'] as const).forEach(axis => {
          const err = coordError(`${path}.${axis}`, item[axis]);
          if (err) errors.push(err);
        });
        if (item.color !== undefined && typeof item.color !== 'string') {
          errors.push(`${path}.color 必须是字符串（十六进制颜色）`);
        }
        if (errors.some(e => e.startsWith(path))) return;
        const style = elementStyle(item.element as string);
        ligandAtoms.push({
          id: item.id as string,
          element: item.element as LigandAtom['element'],
          x: item.x as number,
          y: item.y as number,
          z: item.z as number,
          color: (item.color as string | undefined) ?? style.color,
          radius: style.radius
        });
      });
    }

    if (ligand.bonds !== undefined) {
      if (!Array.isArray(ligand.bonds)) {
        errors.push('ligand.bonds 必须是数组');
      } else {
        const atomIds = new Set(ligandAtoms.map(a => a.id));
        const seenBonds = new Set<string>();
        ligand.bonds.forEach((item, index) => {
          const path = `ligand.bonds[${index}]`;
          if (!Array.isArray(item) || item.length !== 2 || item.some(ep => typeof ep !== 'string')) {
            errors.push(`${path} 必须是两个原子 id 组成的数组，如 ["C1", "O1"]`);
            return;
          }
          const [from, to] = item as [string, string];
          if (!atomIds.has(from)) errors.push(`${path} 引用了不存在的原子 id "${from}"`);
          if (!atomIds.has(to)) errors.push(`${path} 引用了不存在的原子 id "${to}"`);
          if (from === to) errors.push(`${path} 的两个端点相同（${from}）`);
          const key = [from, to].sort().join('~');
          if (seenBonds.has(key)) errors.push(`${path} 重复定义（${from} - ${to}）`);
          else seenBonds.add(key);
          if (atomIds.has(from) && atomIds.has(to) && from !== to) {
            bonds.push([from, to]);
          }
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (residues.length === 0 && ligandAtoms.length === 0) {
    warnings.push('结构为空：未包含任何残基或配体原子，画布将显示空态。');
  } else if (ligandAtoms.length === 0) {
    warnings.push('结构未包含配体原子，配体面板将显示空态。');
  }

  const structure: Structure = {
    format: 'protein-atlas/structure',
    version: 1,
    metadata: {
      name: (meta?.name as string) ?? '未命名结构',
      pdbId: meta?.pdbId as string | undefined,
      description: meta?.description as string | undefined,
      source: 'json',
      pocketVolume: meta?.pocketVolume as number | undefined
    },
    residues,
    ligand: { name: ligandName, atoms: ligandAtoms, bonds }
  };
  return { ok: true, structure, warnings };
}
