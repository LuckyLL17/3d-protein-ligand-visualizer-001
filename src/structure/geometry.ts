import * as THREE from 'three';
import type { LigandAtom, Residue, StructureData } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function centroid(points: Vec3[]): THREE.Vector3 | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => {
    acc.x += p.x;
    acc.y += p.y;
    acc.z += p.z;
    return acc;
  }, { x: 0, y: 0, z: 0 });
  return new THREE.Vector3(sum.x / points.length, sum.y / points.length, sum.z / points.length);
}

export function ligandCenter(structure: StructureData): THREE.Vector3 | null {
  return centroid(structure.ligandAtoms);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export interface ResidueStats {
  active: number;
  support: number;
  loop: number;
}

export function roleStats(residues: Residue[]): ResidueStats {
  return residues.reduce<ResidueStats>((acc, r) => {
    acc[r.role] += 1;
    return acc;
  }, { active: 0, support: 0, loop: 0 });
}

/** active 残基到配体中心的相互作用虚线；无配体或无 active 残基时返回空数组 */
export function interactionLines(structure: StructureData): Array<[THREE.Vector3, THREE.Vector3]> {
  const center = ligandCenter(structure);
  if (!center) return [];
  return structure.residues
    .filter(r => r.role === 'active')
    .map(r => [new THREE.Vector3(r.x, r.y, r.z), center.clone()] as [THREE.Vector3, THREE.Vector3]);
}
