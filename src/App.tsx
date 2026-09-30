import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import ImportDialog from './components/ImportDialog';
import { EXAMPLE_STRUCTURE } from './structure/example';
import { ROLE_LABEL } from './structure/colors';
import type { Bond, LigandAtom, Residue, Structure } from './structure/types';

type DisplayMode = 'cartoon' | 'surface' | 'atoms';

const helixPoints = Array.from({ length: 46 }, (_, index) => { const t = index / 45; return new THREE.Vector3(-3.2 + t * 6.4, Math.sin(t * Math.PI * 4) * .72 + Math.cos(t * Math.PI * 2) * .18, Math.cos(t * Math.PI * 3) * .74); });
const sheetPoints = Array.from({ length: 22 }, (_, index) => new THREE.Vector3(-3.5 + index * .33, 1.4 + Math.sin(index * .55) * .16, -.9 + Math.sin(index * .55) * .25));
const makeBond = (a: THREE.Vector3, b: THREE.Vector3) => [a, b];

function Ligand({ atoms, bonds, rotation, selectedAtom, onSelect }: { atoms: LigandAtom[]; bonds: Bond[]; rotation: number; selectedAtom: string | null; onSelect: (id: string) => void }) {
  const positions = useMemo(() => Object.fromEntries(atoms.map(atom => [atom.id, new THREE.Vector3(atom.x, atom.y, atom.z)])), [atoms]);
  if (atoms.length === 0) {
    return <Text position={[.1, .45, .15]} fontSize={.16} color="#72939c" anchorX="center">无配体原子</Text>;
  }
  return (
    <group position={[.1, .45, .15]} rotation={[0, rotation, 0]}>
      {bonds.map(([from, to]) => {
        const a = positions[from];
        const b = positions[to];
        if (!a || !b) return null;
        return <Line key={`${from}-${to}`} points={makeBond(a, b)} color="#cbd9dc" lineWidth={3} />;
      })}
      {atoms.map(atom => (
        <mesh key={atom.id} position={[atom.x, atom.y, atom.z]} onClick={(event) => { event.stopPropagation(); onSelect(atom.id); }}>
          <sphereGeometry args={[atom.radius * (selectedAtom === atom.id ? 1.35 : 1), 16, 12]} />
          <meshStandardMaterial color={atom.color} emissive={selectedAtom === atom.id ? atom.color : '#000000'} emissiveIntensity={selectedAtom === atom.id ? .7 : 0} />
        </mesh>
      ))}
    </group>
  );
}

function EmptyScene() {
  return (
    <group>
      <gridHelper args={[12, 12, '#2a5360', '#16323d']} />
      <Text position={[0, .7, 0]} fontSize={.3} color="#8fb4bd" anchorX="center">暂无结构数据</Text>
      <Text position={[0, .15, 0]} fontSize={.15} color="#5d7f88" anchorX="center">通过右上角「导入结构」加载文件后在此显示</Text>
    </group>
  );
}

function ProteinModel({ structure, displayMode, selectedResidue, setSelectedResidue, ligandRotation, selectedAtom, setSelectedAtom }: {
  structure: Structure;
  displayMode: DisplayMode;
  selectedResidue: number | null;
  setSelectedResidue: (id: number) => void;
  ligandRotation: number;
  selectedAtom: string | null;
  setSelectedAtom: (id: string) => void;
}) {
  const showAtoms = displayMode === 'atoms';
  const surface = displayMode === 'surface';
  const { residues, ligand } = structure;
  const isEmpty = residues.length === 0 && ligand.atoms.length === 0;

  return (
    <Canvas shadows camera={{ position: [8, 5.5, 9], fov: 40 }}>
      <color attach="background" args={['#09151d']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 8, 5]} intensity={2.4} castShadow />
      <pointLight position={[-4, 3, 3]} color="#7fe0ff" intensity={18} distance={11} />
      {isEmpty ? <EmptyScene /> : (
        <group rotation={[.08, -.25, 0]}>
          {!showAtoms && <><Line points={helixPoints} color="#6b9fe9" lineWidth={surface ? 12 : 5} /> <Line points={sheetPoints} color="#d58acb" lineWidth={surface ? 13 : 6} /></>}
          {showAtoms && residues.map(residue => <mesh key={residue.id} position={[residue.x, residue.y, residue.z]}><sphereGeometry args={[.22, 12, 10]} /><meshStandardMaterial color={residue.color} /></mesh>)}
          {residues.map(residue => (
            <group key={`res-${residue.id}`} position={[residue.x, residue.y, residue.z]}>
              <mesh onClick={(event) => { event.stopPropagation(); setSelectedResidue(residue.id); }}>
                <sphereGeometry args={[selectedResidue === residue.id ? .28 : .18, 16, 12]} />
                <meshStandardMaterial color={residue.color} emissive={selectedResidue === residue.id ? residue.color : '#000'} emissiveIntensity={selectedResidue === residue.id ? .8 : 0} transparent opacity={surface ? .9 : 1} />
              </mesh>
              <Text position={[0, .43, 0]} fontSize={.14} color={selectedResidue === residue.id ? '#ffe9a2' : '#8baeb9'} anchorX="center">{residue.code}</Text>
            </group>
          ))}
          <Ligand atoms={ligand.atoms} bonds={ligand.bonds} rotation={ligandRotation} selectedAtom={selectedAtom} onSelect={setSelectedAtom} />
        </group>
      )}
      <ContactShadows position={[0, -1.5, 0]} opacity={.32} scale={10} blur={2.5} />
      <OrbitControls makeDefault minDistance={5} maxDistance={16} />
    </Canvas>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function EmptyPanel({ children }: { children: string }) {
  return <p className="panel-empty">{children}</p>;
}

export default function App() {
  const [structure, setStructure] = useState<Structure>(EXAMPLE_STRUCTURE);
  const [mode, setMode] = useState<DisplayMode>('cartoon');
  const [selectedResidue, setSelectedResidue] = useState<number | null>(102);
  const [selectedAtom, setSelectedAtom] = useState<string | null>('N1');
  const [ligandRotation, setLigandRotation] = useState(0.2);
  const [showInteractions, setShowInteractions] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const { residues, ligand } = structure;
  const residue = residues.find(item => item.id === selectedResidue) ?? null;
  const atom = ligand.atoms.find(item => item.id === selectedAtom) ?? null;

  const interactionLines = useMemo(
    () => residues.filter(item => item.role === 'active').map(item =>
      [new THREE.Vector3(item.x, item.y, item.z), new THREE.Vector3(item.x * .38, item.y * .34 + .4, item.z * .38)] as [THREE.Vector3, THREE.Vector3]),
    [structure]
  );

  // 指标卡片：全部从当前结构实时计算。
  const metrics = useMemo(() => {
    const active = residues.filter(item => item.role === 'active').length;
    const support = residues.filter(item => item.role === 'support').length;
    let hbonds = 0;
    if (ligand.atoms.length > 0) {
      for (const r of residues.filter(item => item.role === 'active')) {
        const near = ligand.atoms.some(a => Math.hypot(r.x - a.x, r.y - a.y, r.z - a.z) < 4.2);
        if (near) hbonds += 1;
      }
    }
    let volume = '—';
    let volumeNote = '暂无结构';
    if (structure.metadata.pocketVolume) {
      volume = `${structure.metadata.pocketVolume}`;
      volumeNote = '元数据提供';
    } else if (residues.length >= 2) {
      const xs = residues.map(r => r.x), ys = residues.map(r => r.y), zs = residues.map(r => r.z);
      const span = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
      volume = `${Math.max(0, Math.round(span(xs) * span(ys) * span(zs) * .55))}`;
      volumeNote = '坐标估算';
    }
    return { binding: active + support, active, support, hbonds, volume, volumeNote };
  }, [residues, ligand.atoms, structure.metadata.pocketVolume]);

  const nearestLigandDistance = useMemo(() => {
    if (!residue || ligand.atoms.length === 0) return null;
    let min = Infinity;
    for (const a of ligand.atoms) {
      const d = Math.hypot(residue.x - a.x, residue.y - a.y, residue.z - a.z);
      if (d < min) min = d;
    }
    return min;
  }, [residue, ligand.atoms]);

  const handleImport = (next: Structure) => {
    setStructure(next);
    setSelectedResidue(next.residues.length > 0 ? next.residues[0].id : null);
    setSelectedAtom(next.ligand.atoms.length > 0 ? next.ligand.atoms[0].id : null);
  };

  const datasetLabel = structure.metadata.pdbId ?? structure.metadata.name;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <span className="eyebrow">STRUCTURAL BIOLOGY / ANALYSIS WORKSPACE</span>
            <h1>Protein Atlas <span>·</span> 配体结合可视化</h1>
          </div>
        </div>
        <div className="header-meta">
          <span className="dataset">{structure.metadata.source === 'builtin' ? 'PDB-LITE / ' : ''}{datasetLabel}</span>
          <button onClick={() => setImportOpen(true)}>导入结构</button>
          <button onClick={() => setShowInteractions(value => !value)}>{showInteractions ? '隐藏相互作用' : '显示相互作用'}</button>
          <button onClick={() => setLigandRotation(value => value + .35)}>旋转配体 ↻</button>
        </div>
      </header>
      <main className="layout">
        <section className="model-card">
          <div className="model-head">
            <div>
              <span className="eyebrow">MOLECULAR VIEWER</span>
              <h2>蛋白质结合口袋 · {ligand.name}</h2>
            </div>
            <div className="mode-switch">
              {(['cartoon', 'surface', 'atoms'] as DisplayMode[]).map(item => (
                <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
                  {item === 'cartoon' ? '卡通带状' : item === 'surface' ? '表面模型' : '原子视图'}
                </button>
              ))}
            </div>
          </div>
          <div className="canvas-wrap">
            <ProteinModel structure={structure} displayMode={mode} selectedResidue={selectedResidue} setSelectedResidue={setSelectedResidue} ligandRotation={ligandRotation} selectedAtom={selectedAtom} setSelectedAtom={setSelectedAtom} />
            {showInteractions && interactionLines.map((points, index) => <div key={index} />)}
            <div className="viewer-legend">
              <span><i className="dot protein" />蛋白骨架</span>
              <span><i className="dot ligand" />配体原子</span>
              <span><i className="dot interaction" />相互作用</span>
            </div>
            <div className="viewer-hint">左键旋转 · 滚轮缩放 · 点击残基或原子</div>
          </div>
        </section>
        <aside className="sidebar">
          <section className="panel intro-panel">
            <span className="eyebrow">ACTIVE SITE</span>
            <h3>结合口袋分析</h3>
            <p>
              {structure.metadata.description ?? `当前结构包含 ${residues.length} 个残基与 ${ligand.atoms.length} 个配体原子。`}
              {residues.length > 0 ? '通过选择残基查看空间关系与作用类型。' : '导入含残基的结构后可在此查看分析。'}
            </p>
            <div className="metrics">
              <Metric label="口袋体积" value={residues.length > 0 ? `${metrics.volume} Å³` : '—'} note={metrics.volumeNote} />
              <Metric label="结合残基" value={`${metrics.binding}`} note={`${metrics.active} active / ${metrics.support} support`} />
              <Metric label="氢键" value={`${metrics.hbonds}`} note={ligand.atoms.length > 0 ? '几何筛选（4.2 Å）' : '无配体'} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-title">
              <div><span className="eyebrow">RESIDUES</span><h3>关键残基</h3></div>
              <span className="count">{residues.length}</span>
            </div>
            {residues.length === 0 ? <EmptyPanel>当前结构没有残基数据。导入结构文件后，残基将出现在这里。</EmptyPanel> : (
              <div className="residue-list">
                {residues.map(item => (
                  <button key={item.id} className={selectedResidue === item.id ? 'residue selected' : 'residue'} onClick={() => setSelectedResidue(item.id)}>
                    <span className="residue-color" style={{ background: item.color }} />
                    <span><b>{item.code}</b><small>{item.name}</small></span>
                    <em>{item.role === 'active' ? 'ACTIVE' : item.role === 'support' ? 'SUPPORT' : 'LOOP'}</em>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="panel detail-panel">
            <span className="eyebrow">SELECTED RESIDUE</span>
            {residue === null ? <EmptyPanel>尚未选择残基。点击模型或残基列表中的残基查看坐标、角色与配体距离。</EmptyPanel> : (
              <>
                <div className="detail-title"><h3>{residue.code}</h3><span>{residue.name}</span></div>
                <div className="detail-grid">
                  <div><span>空间坐标</span><b>{residue.x.toFixed(2)} / {residue.y.toFixed(2)} / {residue.z.toFixed(2)} Å</b></div>
                  <div><span>残基角色</span><b>{ROLE_LABEL[residue.role]}</b></div>
                  <div><span>配体距离</span><b>{nearestLigandDistance !== null ? `${nearestLigandDistance.toFixed(2)} Å` : '无配体'}</b></div>
                  <div><span>相互作用</span><b>{residue.role === 'active' ? '氢键 / 极性' : residue.role === 'support' ? '范德华力' : '—'}</b></div>
                </div>
              </>
            )}
          </section>
          <section className="panel atom-panel">
            <span className="eyebrow">LIGAND ATOM</span>
            {atom === null ? <EmptyPanel>{ligand.atoms.length === 0 ? '当前结构不含配体原子。' : '尚未选择配体原子。'}</EmptyPanel> : (
              <div className="atom-row">
                <span className="atom-badge">{atom.id.slice(0, 1)}</span>
                <div><b>{atom.id}</b><small>{atom.element} 元素 · 点击模型中的原子切换</small></div>
                <span className="atom-value">{atom.element === 'N' ? '供体' : atom.element === 'O' ? '受体' : '骨架'}</span>
              </div>
            )}
          </section>
        </aside>
      </main>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  );
}
