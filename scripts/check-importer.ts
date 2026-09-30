import { parseStructureJson, StructureFormatError, buildTemplateText } from './src/structure/importer.ts';

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}: ${(err as Error).message}`);
  }
}
function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function expectFail(name: string, text: string, fragment?: string) {
  check(name, () => {
    let caught: StructureFormatError | null = null;
    try { parseStructureJson(text, 'x.json'); } catch (e) { caught = e as StructureFormatError; }
    expect(caught instanceof StructureFormatError, '应当抛出 StructureFormatError');
    if (fragment) expect(caught!.issues.join(' ').includes(fragment), `错误信息应包含 "${fragment}"，实际：${caught!.issues.join(' | ')}`);
  });
}

// 1. 模板必须能成功解析
check('模板解析成功并归一化', () => {
  const result = parseStructureJson(buildTemplateText(), 'template.pas.json');
  expect(result.structure.residues.length === 4, '应有 4 个残基');
  expect(result.structure.ligandAtoms.length === 4, '应有 4 个配体原子');
  expect(result.structure.bonds.length === 3, '应有 3 条键');
  expect(result.structure.bonds[1].order === 2, '第二条键应为双键');
  expect(result.structure.backbone.length === 1, '应有 1 段骨架');
  expect(result.structure.metadata.ligandName === 'LIG-A', '配体名');
  // 缺省颜色/半径按元素回退
  const c1 = result.structure.ligandAtoms.find(a => a.id === 'C1')!;
  expect(c1.color === '#d6e1e4' && c1.radius === 0.17, 'C 元素默认颜色/半径');
});

// 2. 无 backbone 时自动生成；无名称时回退
check('缺省 backbone 按残基生成平滑主链', () => {
  const text = JSON.stringify({
    format: 'protein-atlas-structure', version: 1,
    residues: [
      { id: 1, code: 'A1', role: 'active', x: 0, y: 0, z: 0 },
      { id: 2, code: 'A2', role: 'loop', x: 3, y: 1, z: 0 },
    ],
    ligand: null,
  });
  const result = parseStructureJson(text, 'a.json');
  expect(result.structure.backbone.length === 1, '应自动生成 1 段骨架');
  expect(result.structure.backbone[0].points.length > 2, '曲线应包含多个采样点');
  expect(result.warnings.some(w => w.includes('没有配体')), '应警告无配体');
  expect(result.structure.residues[0].name === 'A1', 'name 缺省回退为 code');
  expect(result.structure.residues[0].color === '#71c9e6', '颜色按 active 角色回退');
});

// 3. 空结构
check('空结构（无残基无配体）合法并警告', () => {
  const text = JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [], ligand: null });
  const result = parseStructureJson(text, 'empty.json');
  expect(result.structure.residues.length === 0, '残基为空');
  expect(result.structure.ligandAtoms.length === 0, '配体为空');
  expect(result.structure.bonds.length === 0, '键为空');
  expect(result.structure.backbone.length === 0, '无骨架');
  expect(result.warnings.some(w => w.includes('空')), '应警告结构为空');
});

// 4. 错误路径
expectFail('非法 JSON', '{ not json', '不是合法 JSON');
expectFail('根节点是数组', '[]', '根节点必须是');
expectFail('format 错误', JSON.stringify({ format: 'pdb', version: 1, residues: [] }), 'format 字段必须');
expectFail('PDB 文本给出专门提示', 'HEADER    TEST\nATOM      1  N   ALA A   1      11.000  22.000  33.000\n', 'PDB');
expectFail('version 不支持', JSON.stringify({ format: 'protein-atlas-structure', version: 2, residues: [] }), 'version 必须');
expectFail('residues 缺失', JSON.stringify({ format: 'protein-atlas-structure', version: 1 }), 'residues 必须是数组');
expectFail('残基 id 非法', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [{ code: 'X', role: 'loop', x: 0, y: 0, z: 0 }] }), 'id 必须是正整数');
expectFail('残基 role 非法', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [{ id: 1, code: 'X', role: 'nope', x: 0, y: 0, z: 0 }] }), 'role 必须');
expectFail('坐标非数值', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [{ id: 1, code: 'X', role: 'loop', x: 0, y: 'a', z: 0 }] }), 'x / y / z');
expectFail('残基 id 重复', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [{ id: 1, code: 'A', role: 'loop', x: 0, y: 0, z: 0 }, { id: 1, code: 'B', role: 'loop', x: 1, y: 0, z: 0 }] }), '重复');
expectFail('原子 id 重复', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [], ligand: { atoms: [{ id: 'C1', element: 'C', x: 0, y: 0, z: 0 }, { id: 'C1', element: 'C', x: 1, y: 0, z: 0 }], bonds: [] } }), '重复');
expectFail('键引用不存在原子', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [], ligand: { atoms: [{ id: 'C1', element: 'C', x: 0, y: 0, z: 0 }], bonds: [{ from: 'C1', to: 'XX' }] } }), '不存在的原子');
expectFail('键缺少 from/to', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [], ligand: { atoms: [], bonds: [{ from: 'C1' }] } }), 'from 与 to');
expectFail('backbone 点不足', JSON.stringify({ format: 'protein-atlas-structure', version: 1, residues: [], ligand: null, backbone: [{ points: [[0, 0, 0]] }] }), '至少需要');

// 5. 非致命问题只产生警告，不阻断导入
check('重复键/未知元素/坏颜色为警告并回退', () => {
  const text = JSON.stringify({
    format: 'protein-atlas-structure',
    version: 1,
    unknownTop: 1,
    residues: [{ id: 1, code: 'A1', role: 'loop', x: 0, y: 0, z: 0, color: 'red' }],
    ligand: {
      atoms: [
        { id: 'X1', element: 'Xe', x: 0, y: 0, z: 0 },
        { id: 'C2', element: 'C', x: 1, y: 0, z: 0 },
      ],
      bonds: [
        { from: 'X1', to: 'C2' },
        { from: 'C2', to: 'X1' },
        { from: 'X1', to: 'X1' },
        { from: 'X1', to: 'C2', order: 5 },
      ],
    },
  });
  const result = parseStructureJson(text, 'warn.json');
  expect(result.structure.bonds.length === 1, `只保留唯一键，实际 ${result.structure.bonds.length}`);
  expect(result.structure.ligandAtoms[0].color === '#9fb4bb', '未知元素回退通用色');
  expect(result.structure.residues[0].color === '#9aabb4', '坏颜色回退角色色');
  expect(result.warnings.length >= 4, `应收集多条警告，实际 ${result.warnings.length}: ${result.warnings.join(' | ')}`);
  expect(result.structure.bonds[0].order === 1, '非法 order 回退单键');
});

// 6. 元数据
check('元数据 pocketVolume 数值转字符串、非法值忽略', () => {
  const result = parseStructureJson(JSON.stringify({
    format: 'protein-atlas-structure', version: 1,
    metadata: { pocketVolume: 320, hydrogenBonds: 3 },
    residues: [], ligand: null,
  }), 'm.json');
  expect(result.structure.metadata.pocketVolume === '320 Å³', '口袋体积数值转换');
  expect(result.structure.metadata.hydrogenBonds === 3, '氢键数');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
