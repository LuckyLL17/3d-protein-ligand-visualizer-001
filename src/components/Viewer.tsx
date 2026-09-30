import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { StructureData } from '../structure/types';

export type DisplayMode = 'cartoon' | 'surface' | 'atoms';

interface ViewerProps {
  structure: StructureData;
  displayMode: DisplayMode;
  selectedResidue: number | null;
  selectedAtom: string | null;
  ligandOffset: [number, number, number];
  ligandRotation: number;
  showInteractions: boolean;
  interactions: Array<[THREE.Vector3, THREE.Vector3]>;
  onSelectResidue: (id: number) => void;
  onSelectAtom: (id: string) => void;
}

interface LigandProps {
  structure: StructureData;
  offset: [number, number, number];
  rotation: number;
  selectedAtom: string | null;
  onSelect: (id: string) => void;
}

function Ligand({ structure, offset, rotation, selectedAtom, onSelect }: LigandProps) {
  const { atomPositions, bondSegments } = useMemo(() => {
    const atomPositions = new Map(structure.ligandAtoms.map(atom => [atom.id, new THREE.Vector3(atom.x, atom.y, atom.z)]));
    const up = new THREE.Vector3(0, 1, 0);
    const bondSegments = structure.bonds.flatMap(bond => {
      const a = atomPositions.get(bond.from);
      const b = atomPositions.get(bond.to);
      if (!a || !b) return [];
      // order=2/3 时在垂直方向上错开绘制多条线，近似双键/三键
      const direction = new THREE.Vector3().subVectors(b, a);
      let perpendicular = new THREE.Vector3().crossVectors(direction, up);
      if (perpendicular.lengthSq() < 1e-6) perpendicular.set(1, 0, 0);
      perpendicular.normalize().multiplyScalar(0.045);
      if (bond.order === 3) {
        return [
          [a, b] as [THREE.Vector3, THREE.Vector3],
          [a.clone().add(perpendicular), b.clone().add(perpendicular)] as [THREE.Vector3, THREE.Vector3],
          [a.clone().sub(perpendicular), b.clone().sub(perpendicular)] as [THREE.Vector3, THREE.Vector3],
        ];
      }
      if (bond.order === 2) {
        return [
          [a.clone().add(perpendicular), b.clone().add(perpendicular)] as [THREE.Vector3, THREE.Vector3],
          [a.clone().sub(perpendicular), b.clone().sub(perpendicular)] as [THREE.Vector3, THREE.Vector3],
        ];
      }
      return [[a, b] as [THREE.Vector3, THREE.Vector3]];
    });
    return { atomPositions, bondSegments };
  }, [structure]);

  return (
    <group position={offset} rotation={[0, rotation, 0]}>
      {bondSegments.map(([a, b], index) => (
        <Line key={`bond-${index}`} points={[a, b]} color="#cbd9dc" lineWidth={3} />
      ))}
      {structure.ligandAtoms.map(atom => (
        <mesh
          key={atom.id}
          position={[atom.x, atom.y, atom.z]}
          onClick={event => {
            event.stopPropagation();
            onSelect(atom.id);
          }}
        >
          <sphereGeometry args={[atom.radius * (selectedAtom === atom.id ? 1.35 : 1), 16, 12]} />
          <meshStandardMaterial
            color={atom.color}
            emissive={selectedAtom === atom.id ? atom.color : '#000000'}
            emissiveIntensity={selectedAtom === atom.id ? 0.7 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Viewer(props: ViewerProps) {
  const {
    structure,
    displayMode,
    selectedResidue,
    selectedAtom,
    ligandOffset,
    ligandRotation,
    showInteractions,
    interactions,
    onSelectResidue,
    onSelectAtom,
  } = props;

  const showAtoms = displayMode === 'atoms';
  const surface = displayMode === 'surface';
  const isEmpty = structure.residues.length === 0 && structure.ligandAtoms.length === 0;
  const hasLigand = structure.ligandAtoms.length > 0;

  return (
    <div className="canvas-wrap">
      <Canvas shadows camera={{ position: [8, 5.5, 9], fov: 40 }}>
        <color attach="background" args={['#09151d']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 5]} intensity={2.4} castShadow />
        <pointLight position={[-4, 3, 3]} color="#7fe0ff" intensity={18} distance={11} />

        <group rotation={[0.08, -0.25, 0]}>
          {!showAtoms &&
            structure.backbone.map((segment, index) => (
              <Line
                key={`backbone-${index}`}
                points={segment.points}
                color={segment.color}
                lineWidth={surface ? segment.surfaceWidth ?? 12 : segment.width ?? 5}
              />
            ))}

          {showAtoms &&
            structure.residues.map(residue => (
              <mesh key={`ca-${residue.id}`} position={[residue.x, residue.y, residue.z]}>
                <sphereGeometry args={[0.22, 12, 10]} />
                <meshStandardMaterial color={residue.color} />
              </mesh>
            ))}

          {structure.residues.map(residue => (
            <group key={`res-${residue.id}`} position={[residue.x, residue.y, residue.z]}>
              <mesh
                onClick={event => {
                  event.stopPropagation();
                  onSelectResidue(residue.id);
                }}
              >
                <sphereGeometry args={[selectedResidue === residue.id ? 0.28 : 0.18, 16, 12]} />
                <meshStandardMaterial
                  color={residue.color}
                  emissive={selectedResidue === residue.id ? residue.color : '#000'}
                  emissiveIntensity={selectedResidue === residue.id ? 0.8 : 0}
                  transparent
                  opacity={surface ? 0.9 : 1}
                />
              </mesh>
              <Text position={[0, 0.43, 0]} fontSize={0.14} color={selectedResidue === residue.id ? '#ffe9a2' : '#8baeb9'} anchorX="center">
                {residue.code}
              </Text>
            </group>
          ))}

          {showInteractions &&
            interactions.map(([from, to], index) => (
              <Line
                key={`interaction-${index}`}
                points={[from, to]}
                color="#eac66c"
                lineWidth={1.5}
                dashed
                dashSize={0.12}
                gapSize={0.08}
                transparent
                opacity={0.85}
              />
            ))}

          {hasLigand && (
            <Ligand
              structure={structure}
              offset={ligandOffset}
              rotation={ligandRotation}
              selectedAtom={selectedAtom}
              onSelect={onSelectAtom}
            />
          )}
        </group>

        <ContactShadows position={[0, -1.5, 0]} opacity={0.32} scale={10} blur={2.5} />
        <OrbitControls makeDefault minDistance={5} maxDistance={16} />
      </Canvas>

      {isEmpty && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">∅</div>
          <b>当前结构为空</b>
          <span>该文件不包含残基或配体原子，可重新选择文件或恢复内置示例。</span>
        </div>
      )}

      <div className="viewer-legend">
        <span><i className="dot protein" />蛋白骨架</span>
        <span><i className="dot ligand" />配体原子</span>
        <span><i className="dot interaction" />相互作用</span>
      </div>
      <div className="viewer-hint">左键旋转 · 滚轮缩放 · 点击残基或原子</div>
    </div>
  );
}
