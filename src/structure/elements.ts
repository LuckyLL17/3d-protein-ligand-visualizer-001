// 元素物理属性表：导入文件缺省颜色/半径时按元素回退。

const ELEMENT_INFO: Record<string, { color: string; radius: number; label: string }> = {
  C: { color: '#d6e1e4', radius: 0.17, label: '碳' },
  N: { color: '#54b9e3', radius: 0.2, label: '氮' },
  O: { color: '#ec7474', radius: 0.18, label: '氧' },
  S: { color: '#e7c35f', radius: 0.24, label: '硫' },
  H: { color: '#f4f7f8', radius: 0.12, label: '氢' },
  P: { color: '#d68ff0', radius: 0.22, label: '磷' },
  F: { color: '#8fe3a4', radius: 0.15, label: '氟' },
  Cl: { color: '#6fd96f', radius: 0.19, label: '氯' },
  Br: { color: '#c76b3f', radius: 0.22, label: '溴' },
  I: { color: '#b06ae0', radius: 0.24, label: '碘' },
};

export const FALLBACK_ELEMENT = { color: '#9fb4bb', radius: 0.17, label: '未知元素' };

export function normalizeElement(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  return raw[0].toUpperCase() + raw.slice(1).toLowerCase();
}

export function isKnownElement(element: string): boolean {
  return element in ELEMENT_INFO;
}

export function elementColor(element: string): string {
  return ELEMENT_INFO[element]?.color ?? FALLBACK_ELEMENT.color;
}

export function elementRadius(element: string): number {
  return ELEMENT_INFO[element]?.radius ?? FALLBACK_ELEMENT.radius;
}

export function elementLabel(element: string): string {
  return ELEMENT_INFO[element]?.label ?? FALLBACK_ELEMENT.label;
}

/** 配体原子在原子面板中的功能角色（供体/受体/骨架） */
export function atomRoleTag(element: string, id: string): string {
  if (element === 'N') return '供体';
  if (element === 'O') return '受体';
  if (id.startsWith('H')) return '氢';
  return '骨架';
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}
