import { readStructureFile, StructureFormatError, buildTemplateText } from '../src/structure/importer.ts';

let passed = 0, failed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}: ${(e as Error).message}`); }
}
const expect = (c: unknown, m: string) => { if (!c) throw new Error(m); };

await check('读取合法 File 对象', async () => {
  const file = new File([buildTemplateText()], 'demo.pas.json', { type: 'application/json' });
  const result = await readStructureFile(file);
  expect(result.fileName === 'demo.pas.json', '文件名透传');
  expect(result.structure.residues.length === 4, '4 残基');
});

await check('非 .json 扩展名直接拒绝', async () => {
  const file = new File(['HEADER TEST\nATOM'], '1m0l.pdb');
  let caught: unknown = null;
  try { await readStructureFile(file); } catch (e) { caught = e; }
  expect(caught instanceof StructureFormatError, '应为格式错误');
  expect((caught as StructureFormatError).issues.join(' ').includes('.json'), '提示扩展名');
});

await check('空文件拒绝', async () => {
  const file = new File([], 'empty.json');
  let caught: unknown = null;
  try { await readStructureFile(file); } catch (e) { caught = e; }
  expect(caught instanceof StructureFormatError, '应为格式错误');
  expect((caught as StructureFormatError).issues[0].includes('为空'), '空文件提示');
});

await check('已取消的 signal 抛出 AbortError 且不产出结果', async () => {
  const file = new File([buildTemplateText()], 'demo.json');
  const controller = new AbortController();
  const promise = readStructureFile(file, controller.signal);
  controller.abort();
  let caught: unknown = null;
  try { await promise; } catch (e) { caught = e; }
  expect(caught instanceof DOMException && (caught as DOMException).name === 'AbortError', '应为 AbortError');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
