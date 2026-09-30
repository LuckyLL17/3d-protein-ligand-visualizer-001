import { useMemo, useState } from 'react';
import * as THREE from 'three';
import Viewer, { type DisplayMode } from './components/Viewer';
import ImportDialog from './components/ImportDialog';
import { SAMPLE_STRUCTURE, sampleInteractionTargets } from './structure/sample';
import type { ImportedStructure, StructureData } from './structure/types';
import { distance, interactionLines, ligandCenter, roleStats } from './structure/geometry';
import { atomRoleTag, elementLabel } from './structure/elements';

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export default function App() {
  const [structure, setStructure] = useState<StructureData>(SAMPLE_STRUCTURE);
  const [source, setSource] = useState<'sample' | 'imported'>('sample');
  const [sourceFile, setSourceFile] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [mode, setMode] = useState<DisplayMode>('cartoon');
  const [selectedResidue, setSelectedResidue] = useState<number | null>(102);
  const [selectedAtom, setSelectedAtom] = useState<string | null>('N1');
  const [ligandRotation, setLigandRotation] = useState(0.2);
  const [showInteractions, setShowInteractions] = useState(true);

  const handleImport = (result: ImportedStructure) => {
    const { structure: next, warnings, fileName } = result;
    setStructure(next);
    setSource('imported');
    setSourceFile(fileName);
    setSelectedResidue(next.residues[0]?.id ?? null);
    setSelectedAtom(next.ligandAtoms[0]?.id ?? null);
    setLigandRotation(0);
    setShowInteractions(true);
    const summary = `已从 ${fileName} 导入：${next.residues.length} 个残基、${next.ligandAtoms.length} 个配体原子、${next.bonds.length} 条键，示例数据已替换。`;
    setNotices([summary, ...warnings]);
    setDialogOpen(false);
  };

  const restoreSample = () => {
    setStructure(SAMPLE_STRUCTURE);
    setSource('sample');
    setSourceFile('');
    setNotices([]);
    setSelectedResidue(102);
    setSelectedAtom('N1');
    setLigandRotation(0.2);
  };

  const stats = useMemo(() => roleStats(structure.residues), [structure]);
  const center = useMemo(() => ligandCenter(structure), [structure]);
  const residue = structure.residues.find(item => item.id === selectedResidue) ?? null;
  const atom = structure.ligandAtoms.find(item => item.id === selectedAtom) ?? null;

  // 内置示例沿用原始口袋方向；导入结构的坐标以口袋中心为原点，无需平移。
  const ligandOffset: [number, number, number] = source === 'sample' ? [0.1, 0.45, 0.15] : [0, 0, 0];
  const interactions = useMemo<Array<[THREE.Vector3, THREE.Vector3]>>(() => {
    if (structure.ligandAtoms.length === 0) return [];
    return source === 'sample' ? sampleInteractionTargets() : interactionLines(structure);
  }, [structure, source]);

  const pocketVolume = structure.metadata.pocketVolume;
  const hydrogenBonds = structure.metadata.hydrogenBonds;
  const bindingCount = stats.active + stats.support;
  const hasLigand = structure.ligandAtoms.length > 0;

  const introText = structure.metadata.description
    ?? (structure.residues.length === 0 && !hasLigand
      ? '当前结构为空，不包含任何残基或配体原子。可重新选择文件或恢复内置示例。'
      : hasLigand
        ? `当前结构包含 ${structure.residues.length} 个关键残基和 ${structure.ligandAtoms.length} 个配体原子${structure.metadata.ligandName ? `（${structure.metadata.ligandName}）` : ''}。选择残基查看空间关系与作用类型。`
        : `当前结构包含 ${structure.residues.length} 个关键残基，文件未提供配体。`);

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
          <span className="dataset" title={source === 'imported' ? `来源文件：${sourceFile}` : '内置示例结构'}>
            {structure.metadata.pdbId}
            {source === 'imported' && <i className="source-tag">导入</i>}
          </span>
          <button onClick={() => setShowInteractions(value => !value)} disabled={!hasLigand}>
            {showInteractions ? '隐藏相互作用' : '显示相互作用'}
          </button>
          <button onClick={() => setLigandRotation(value => value + 0.35)} disabled={!hasLigand}>旋转配体 ↻</button>
          {source === 'imported' && <button onClick={restoreSample}>恢复示例</button>}
          <button className="btn-import" onClick={() => setDialogOpen(true)}>导入结构</button>
        </div>
      </header>

      {notices.length > 0 && (
        <div className="notice-bar">
          <div className="notice-list">
            {notices.map((notice, index) => (
              <span key={index} className={index === 0 ? 'notice success' : 'notice warning'}>
                {index === 0 ? '✓ ' : '⚠ '}{notice}
              </span>
            ))}
          </div>
          <button className="notice-close" onClick={() => setNotices([])} aria-label="关闭提示">×</button>
        </div>
      )}

      <main className="layout">
        <section className="model-card">
          <div className="model-head">
            <div>
              <span className="eyebrow">MOLECULAR VIEWER</span>
              <h2>{structure.metadata.name || '蛋白质结合口袋'}{structure.metadata.ligandName ? ` · ${structure.metadata.ligandName}` : ''}</h2>
            </div>
            <div className="mode-switch">
              {(['cartoon', 'surface', 'atoms'] as DisplayMode[]).map(item => (
                <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
                  {item === 'cartoon' ? '卡通带状' : item === 'surface' ? '表面模型' : '原子视图'}
                </button>
              ))}
            </div>
          </div>
          <Viewer
            structure={structure}
            displayMode={mode}
            selectedResidue={selectedResidue}
            selectedAtom={selectedAtom}
            ligandOffset={ligandOffset}
            ligandRotation={ligandRotation}
            showInteractions={showInteractions}
            interactions={interactions}
            onSelectResidue={setSelectedResidue}
            onSelectAtom={setSelectedAtom}
          />
        </section>

        <aside className="sidebar">
          <section className="panel intro-panel">
            <span className="eyebrow">ACTIVE SITE</span>
            <h3>结合口袋分析</h3>
            <p>{introText}</p>
            <div className="metrics">
              <Metric
                label="口袋体积"
                value={pocketVolume ?? '—'}
                note={pocketVolume ? (source === 'sample' ? '预测区域' : '元数据提供') : '元数据未提供'}
              />
              <Metric
                label="结合残基"
                value={String(bindingCount)}
                note={`${stats.active} active / ${stats.support} support`}
              />
              <Metric
                label="配体原子"
                value={String(structure.ligandAtoms.length)}
                note={`${structure.bonds.length} 键 / ${hydrogenBonds ?? '—'} 氢键`}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div><span className="eyebrow">RESIDUES</span><h3>关键残基</h3></div>
              <span className="count">{structure.residues.length}</span>
            </div>
            {structure.residues.length === 0 ? (
              <p className="panel-empty">导入的结构不包含残基数据。</p>
            ) : (
              <div className="residue-list">
                {structure.residues.map(item => (
                  <button
                    key={item.id}
                    className={selectedResidue === item.id ? 'residue selected' : 'residue'}
                    onClick={() => setSelectedResidue(item.id)}
                  >
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
            {residue ? (
              <>
                <div className="detail-title"><h3>{residue.code}</h3><span>{residue.name}</span></div>
                <div className="detail-grid">
                  <div><span>空间坐标</span><b>{residue.x.toFixed(2)} / {residue.y.toFixed(2)} / {residue.z.toFixed(2)} Å</b></div>
                  <div><span>残基角色</span><b>{residue.role === 'active' ? '结合活性位点' : residue.role === 'support' ? '口袋支撑' : '柔性环区'}</b></div>
                  <div>
                    <span>{hasLigand ? '配体中心距离' : '配体距离'}</span>
                    <b>{center ? `${distance(residue, center).toFixed(2)} Å` : '无配体'}</b>
                  </div>
                  <div><span>相互作用</span><b>{residue.role === 'active' ? '氢键 / 极性' : '范德华力'}</b></div>
                </div>
              </>
            ) : (
              <div className="detail-empty">
                <b>未选择残基</b>
                <small>{structure.residues.length === 0 ? '当前结构没有可查看的残基。' : '从上方列表或 3D 视图中选择一个残基。'}</small>
              </div>
            )}
          </section>

          <section className="panel atom-panel">
            <div className="panel-title">
              <div><span className="eyebrow">LIGAND ATOMS</span><h3>配体原子</h3></div>
              <span className="count">{structure.ligandAtoms.length}</span>
            </div>
            {!hasLigand ? (
              <p className="panel-empty">{structure.residues.length === 0 ? '空结构：没有残基或配体。' : '导入的结构不包含配体（ligand 为空）。'}</p>
            ) : (
              <>
                <div className="atom-list">
                  {structure.ligandAtoms.map(item => (
                    <button
                      key={item.id}
                      className={selectedAtom === item.id ? 'atom-item selected' : 'atom-item'}
                      onClick={() => setSelectedAtom(item.id)}
                      title={`${item.id} · ${item.element} (${item.x.toFixed(2)}, ${item.y.toFixed(2)}, ${item.z.toFixed(2)})`}
                    >
                      <span className="atom-dot" style={{ background: item.color }} />
                      <b>{item.id}</b>
                      <small>{item.element}</small>
                    </button>
                  ))}
                </div>
                {atom ? (
                  <div className="atom-row">
                    <span className="atom-badge">{atom.element}</span>
                    <div>
                      <b>{atom.id} · {elementLabel(atom.element)}</b>
                      <small>{atom.x.toFixed(2)} / {atom.y.toFixed(2)} / {atom.z.toFixed(2)} Å</small>
                    </div>
                    <span className="atom-value">{atomRoleTag(atom.element, atom.id)}</span>
                  </div>
                ) : (
                  <div className="detail-empty"><b>未选择原子</b><small>从上方列表或 3D 视图中选择一个配体原子。</small></div>
                )}
              </>
            )}
          </section>
        </aside>
      </main>

      {dialogOpen && <ImportDialog onImport={handleImport} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
