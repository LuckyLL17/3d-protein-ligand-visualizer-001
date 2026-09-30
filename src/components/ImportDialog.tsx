import { useRef, useState } from 'react';
import { parseStructureFile, STRUCTURE_FILE_ACCEPT } from '../structure/parseStructure';
import { STRUCTURE_TEMPLATE } from '../structure/template';
import type { Structure } from '../structure/types';

type Phase = 'idle' | 'parsing' | 'success' | 'error';

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (structure: Structure) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ImportDialog({ open, onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsed, setParsed] = useState<Structure | null>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  const reset = () => {
    setPhase('idle');
    setFileName('');
    setFileSize(0);
    setErrors([]);
    setWarnings([]);
    setParsed(null);
    setDragOver(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.json') && !ext.endsWith('.pdb') && !ext.endsWith('.ent')) {
      setPhase('error');
      setFileName(file.name);
      setErrors([`不支持的文件格式 "${ext.split('.').pop() ?? '未知'}"，请选择 .json（protein-atlas/structure）或 .pdb 文件`]);
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setPhase('parsing');
    setErrors([]);
    setWarnings([]);
    setParsed(null);
    try {
      const text = await file.text();
      // 短暂展示解析状态，避免大文件时状态闪烁。
      await new Promise(resolve => setTimeout(resolve, 350));
      const result = parseStructureFile(file.name, text);
      if (result.ok) {
        setParsed(result.structure);
        setWarnings(result.warnings);
        setPhase('success');
      } else {
        setErrors(result.errors);
        setPhase('error');
      }
    } catch (cause) {
      setErrors([`文件读取失败：${cause instanceof Error ? cause.message : '未知错误'}`]);
      setPhase('error');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    // 允许重复选择同一文件。
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([STRUCTURE_TEMPLATE], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'structure-template.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleApply = () => {
    if (parsed) {
      onImport(parsed);
      reset();
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) handleClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="导入结构">
        <header className="modal-head">
          <div>
            <span className="eyebrow">IMPORT STRUCTURE</span>
            <h3>导入本地结构文件</h3>
          </div>
          <button className="modal-close" onClick={handleClose} aria-label="关闭">×</button>
        </header>

        {phase === 'idle' && (
          <>
            <div
              className={`dropzone${dragOver ? 'dragover' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={event => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="dropzone-icon">⬆</div>
              <p><b>点击选择文件</b> 或将文件拖入此处</p>
              <small>支持 .json（protein-atlas/structure）与 .pdb 格式</small>
            </div>
            <div className="modal-hint">
              <span>首次使用？</span>
              <button className="link-btn" onClick={downloadTemplate}>下载 JSON 结构模板</button>
              <span>，按字段填写后导入。</span>
            </div>
          </>
        )}

        {phase === 'parsing' && (
          <div className="modal-status">
            <div className="spinner" />
            <p>正在解析 <b>{fileName}</b>{fileSize > 0 ? `（${formatSize(fileSize)}）` : ''}…</p>
            <small>读取文件并校验残基、配体原子、键与元数据</small>
          </div>
        )}

        {phase === 'error' && (
          <div className="modal-status">
            <div className="status-icon error">!</div>
            <p className="status-title">文件解析失败{fileName ? ` · ${fileName}` : ''}</p>
            <ul className="error-list">
              {errors.map((error, index) => <li key={index}>{error}</li>)}
            </ul>
            <small className="status-note">请修正文件后重新选择，或取消导入继续使用当前结构。</small>
          </div>
        )}

        {phase === 'success' && parsed && (
          <div className="modal-status">
            <div className="status-icon success">✓</div>
            <p className="status-title">解析成功 · {parsed.metadata.name}</p>
            <div className="parse-summary">
              <div><b>{parsed.residues.length}</b><span>残基</span></div>
              <div><b>{parsed.ligand.atoms.length}</b><span>配体原子</span></div>
              <div><b>{parsed.ligand.bonds.length}</b><span>键</span></div>
              <div><b>{parsed.metadata.pdbId ?? '—'}</b><span>结构编号</span></div>
            </div>
            {warnings.length > 0 && (
              <ul className="warning-list">
                {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            )}
            <small className="status-note">应用后将替换当前示例数据，并同步残基列表、配体面板与指标卡片。</small>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={STRUCTURE_FILE_ACCEPT}
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        <footer className="modal-foot">
          {phase === 'idle' && <button className="btn-ghost" onClick={handleClose}>取消</button>}
          {phase === 'parsing' && <button className="btn-ghost" onClick={handleClose}>取消</button>}
          {phase === 'error' && (
            <>
              <button className="btn-ghost" onClick={handleClose}>取消</button>
              <button className="btn-primary" onClick={() => inputRef.current?.click()}>重新选择文件</button>
            </>
          )}
          {phase === 'success' && (
            <>
              <button className="btn-ghost" onClick={() => { reset(); inputRef.current?.click(); }}>重新选择</button>
              <button className="btn-primary" onClick={handleApply}>应用并替换当前结构</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
