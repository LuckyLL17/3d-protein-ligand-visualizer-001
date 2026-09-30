import { parsePdb } from './parsePdb';
import { parseStructureJson } from './parseJson';
import type { ParseResult } from './types';

export const STRUCTURE_FILE_ACCEPT = '.json,.pdb,.ent';

// 按文件扩展名分发到对应解析器，统一输出可消费的结构或中文错误。
export function parseStructureFile(fileName: string, text: string): ParseResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) {
    return parseStructureJson(text);
  }
  if (lower.endsWith('.pdb') || lower.endsWith('.ent')) {
    return parsePdb(text);
  }
  return {
    ok: false,
    errors: [`不支持的文件格式 "${fileName.split('.').pop() ?? '未知'}"，请选择 .json（protein-atlas/structure）或 .pdb 文件`]
  };
}
