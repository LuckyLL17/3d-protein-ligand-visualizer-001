import { useEffect, useRef, useState } from 'react';
import { readStructureFile, buildTemplateText, StructureFormatError } from '../structure/importer';
import type { ImportedStructure } from '../structure/types';

type Phase = 'idle' | 'parsing' | 'error';

interface ImportDialogProps {
  onImport: (result: ImportedStructure) => void;
  onClose: () => void;
}

export default function ImportDialog({ onImport, onClose }: ImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const chooseFile = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFileName(file.name);
    setIssues([]);
    setPhase('parsing');
    try {
      const result = await readStructureFile(file, controller.signal);
      if (controller.signal.aborted) return;
      onImport(result); // 成功后由父组件关闭对话框并替换数据
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      if (error instanceof StructureFormatError) setIssues(error.issues);
      else setIssues([error instanceof Error ? error.message : '读取文件时发生未知错误。']);
      setPhase('error');
    }
  };

  const cancelParsing = () => {
    abortRef.current?.abort();
    setPhase('idle');
    setFileName('');
    setIssues([]);
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateText()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'protein-atlas-template.pas.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">IMPORT STRUCTURE</span>
            <h3 id="import-title">导入本地结构文件</h3>
          </div>
          <button className="dialog-close" onClick={onClose} aria-label="关闭">×</button>
        </div>

        {phase === 'idle' && (
          <>
            <div
              className={dragging ? 'dropzone dragging' : 'dropzone'}
              onClick={chooseFile}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => {
                event.preventDefault();
                setDragging(false);
                void handleFile(event.dataTransfer.files?.[0]);
              }}
            >
              <div className="dropzone-icon">⤓</div>
              <b>点击选择文件，或将 .json 结构文件拖拽到此处</b>
              <small>格式 protein-atlas-structure · 版本 1 · 上限 8 MB</small>
            </div>
            <p className="dialog-note">导入成功后将替换当前示例数据，残基列表、选中详情、配体面板、指标卡片与 3D 视图会同步刷新。空结构或缺少配体的文件也可以正常导入。</p>
            <div className="dialog-help">
              <div className="dialog-help-head">
                <span>必需字段</span>
                <code>format · version · residues[]</code>
              </div>
              <div className="dialog-help-head">
                <span>残基字段</span>
                <code>id · code · role(active/support/loop) · x/y/z</code>
              </div>
              <div className="dialog-help-head">
                <span>配体字段</span>
                <code>ligand.atoms[id,element,x/y/z] · bonds[from,to,order?]</code>
              </div>
              <div className="dialog-help-head">
                <span>空结构</span>
                <code>residues: []，ligand: null</code>
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={downloadTemplate}>下载模板</button>
              <button className="btn-primary" onClick={chooseFile}>选择文件</button>
            </div>
          </>
        )}

        {phase === 'parsing' && (
          <div className="dialog-state">
            <div className="spinner" aria-label="解析中" />
            <b>正在解析结构文件</b>
            <p className="dialog-filename" title={fileName}>{fileName}</p>
            <small>正在校验残基、配体原子、键与元数据…</small>
            <div className="dialog-actions centered">
              <button className="btn-ghost" onClick={cancelParsing}>取消解析</button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="dialog-state">
            <div className="error-badge">!</div>
            <b>无法导入该文件</b>
            <p className="dialog-filename" title={fileName}>{fileName}</p>
            <ul className="issue-list">
              {issues.map((issue, index) => <li key={index}>{issue}</li>)}
            </ul>
            <div className="dialog-actions centered">
              <button className="btn-ghost" onClick={onClose}>取消</button>
              <button className="btn-primary" onClick={chooseFile}>重新选择文件</button>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={event => {
            void handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
