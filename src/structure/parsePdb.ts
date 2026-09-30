import { elementStyle, residueColor, residueCnName, SUPPORTED_ELEMENTS } from './colors';
import type { Bond, LigandAtom, ParseResult, Residue, ResidueRole, Structure } from './types';

// 简化的 PDB 解析器：支持 ATOM（蛋白残基）、HETATM（配体原子，跳过水）、CONECT（键）。
// 字段位置按 PDB 固定列宽规范解析。
type RawAtom = {
  serial: number;
  name: string;
  resName: string;
  chain: string;
  resSeq: number;
  x: number;
  y: number;
  z: number;
  element: string;
  isHet: boolean;
};

function inferElement(name: string, column: string): string {
  const fromColumn = column.trim();
  if (fromColumn) return fromColumn.toUpperCase();
  // 元素列缺失时，从原子名推断：去掉数字后的第一个字母（如 CA -> C, OXT -> O）。
  const letters = name.replace(/[0-9']/g, '');
  return (letters[0] ?? 'C').toUpperCase();
}

function parseAtomLine(line: string, isHet: boolean): RawAtom | null {
  const serial = Number(line.slice(6, 11).trim());
  const name = line.slice(12, 16).trim();
  const altLoc = line.slice(16, 17).trim();
  const resName = line.slice(17, 20).trim();
  const chain = line.slice(21, 22).trim();
  const resSeq = Number(line.slice(22, 26).trim());
  const x = Number(line.slice(30, 38).trim());
  const y = Number(line.slice(38, 46).trim());
  const z = Number(line.slice(46, 54).trim());
  if (!Number.isFinite(serial) || !name || !resName || !Number.isFinite(resSeq)) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  // 只保留标准构象与第一交替构象，避免重复原子。
  if (altLoc && altLoc !== 'A') return null;
  return {
    serial,
    name,
    resName,
    chain: chain || ' ',
    resSeq,
    x,
    y,
    z,
    element: inferElement(name, line.slice(76, 78)),
    isHet
  };
}

export function parsePdb(text: string): ParseResult {
  const warnings: string[] = [];
  const atoms: RawAtom[] = [];
  let skipped = 0;
  let pdbId = '';

  for (const line of text.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
    if (record === 'HEADER') {
      pdbId = line.slice(62, 66).trim();
      continue;
    }
    if (record === 'ATOM' || record === 'HETATM') {
      const atom = parseAtomLine(line, record === 'HETATM');
      if (atom) atoms.push(atom);
      else skipped += 1;
    }
  }

  if (atoms.length === 0) {
    return { ok: false, errors: ['未在 PDB 文件中解析到任何 ATOM 或 HETATM 记录，请确认文件内容'] };
  }
  if (skipped > 0) warnings.push(`${skipped} 条记录因字段不完整或构象交替被跳过。`);

  // ---- 蛋白残基：按 链 + 残基序号 分组，位置取 CA 原子，否则取质心 ----
  const proteinAtoms = atoms.filter(a => !a.isHet);
  const residueMap = new Map<string, { resName: string; chain: string; resSeq: number; atoms: RawAtom[] }>();
  for (const atom of proteinAtoms) {
    const key = `${atom.chain}:${atom.resSeq}:${atom.resName}`;
    const group = residueMap.get(key);
    if (group) group.atoms.push(atom);
    else residueMap.set(key, { resName: atom.resName, chain: atom.chain, resSeq: atom.resSeq, atoms: [atom] });
  }

  const residues: Residue[] = [];
  for (const group of residueMap.values()) {
    const ca = group.atoms.find(a => a.name === 'CA');
    const center = ca ?? {
      x: group.atoms.reduce((s, a) => s + a.x, 0) / group.atoms.length,
      y: group.atoms.reduce((s, a) => s + a.y, 0) / group.atoms.length,
      z: group.atoms.reduce((s, a) => s + a.z, 0) / group.atoms.length
    };
    residues.push({
      id: group.resSeq,
      code: `${group.resName}${group.resSeq}`,
      name: residueCnName(group.resName),
      x: center.x,
      y: center.y,
      z: center.z,
      color: residueColor(group.resSeq),
      role: 'support'
    });
  }
  residues.sort((a, b) => a.id - b.id);

  // ---- 配体：非水 HETATM ----
  const hetAtoms = atoms.filter(a => a.isHet && !['HOH', 'WAT', 'DOD', 'H2O'].includes(a.resName.toUpperCase()));
  const ligandAtoms: LigandAtom[] = [];
  const serialToId = new Map<number, string>();
  const usedIds = new Set<string>();
  for (const atom of hetAtoms) {
    let id = atom.name;
    if (usedIds.has(id)) id = `${atom.name}_${atom.serial}`;
    usedIds.add(id);
    const style = elementStyle(atom.element);
    ligandAtoms.push({
      id,
      element: (SUPPORTED_ELEMENTS.includes(atom.element as LigandAtom['element']) ? atom.element : 'C') as LigandAtom['element'],
      x: atom.x,
      y: atom.y,
      z: atom.z,
      color: style.color,
      radius: style.radius
    });
    serialToId.set(atom.serial, id);
  }

  // ---- CONECT 键 ----
  const bonds: Bond[] = [];
  const seenBonds = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    if (line.slice(0, 6).trim() !== 'CONECT') continue;
    const serials = [6, 11, 16, 21, 26].map(start => Number(line.slice(start, start + 5).trim()));
    const from = serialToId.get(serials[0]);
    if (!from) continue;
    for (const partnerSerial of serials.slice(1)) {
      if (!Number.isFinite(partnerSerial) || partnerSerial === 0) continue;
      const to = serialToId.get(partnerSerial);
      if (!to || to === from) continue;
      const key = [from, to].sort().join('~');
      if (seenBonds.has(key)) continue;
      seenBonds.add(key);
      bonds.push([from, to]);
    }
  }

  if (ligandAtoms.length === 0) {
    warnings.push('未解析到配体 HETATM 记录（已跳过水分子），配体面板将显示空态。');
  }

  // ---- 残基角色启发式：距配体 4.5Å 内为活性位点，7Å 内为支撑残基 ----
  if (ligandAtoms.length > 0) {
    for (const residue of residues) {
      let minDist = Infinity;
      for (const atom of ligandAtoms) {
        const d = Math.hypot(residue.x - atom.x, residue.y - atom.y, residue.z - atom.z);
        if (d < minDist) minDist = d;
      }
      residue.role = minDist < 4.5 ? 'active' : minDist < 7 ? 'support' : 'loop';
    }
  } else {
    warnings.push('无配体参考，残基角色默认标记为 support。');
  }

  const ligandName = hetAtoms.length > 0 ? `${hetAtoms[0].resName}${hetAtoms[0].resSeq}` : 'LIG';

  const structure: Structure = {
    format: 'protein-atlas/structure',
    version: 1,
    metadata: {
      name: pdbId ? `PDB 结构 ${pdbId}` : 'PDB 导入结构',
      pdbId: pdbId || undefined,
      source: 'pdb'
    },
    residues,
    ligand: { name: ligandName, atoms: ligandAtoms, bonds }
  };
  return { ok: true, structure, warnings };
}
