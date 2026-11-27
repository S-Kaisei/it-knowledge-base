import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkFile } from '../../.claude/hooks/post-edit.mjs';
import { runHook } from './helpers';

// H15（初期構築中でも止まらない）の一部: 不正な入力でもブロックしない。

const fm = (over: Record<string, string | null> = {}) => {
  const base: Record<string, string> = {
    title: 'テスト',
    description: '説明',
    slug: 'sample',
    category: 'fundamentals',
    difficulty: 'beginner',
    draft: 'false',
    lastUpdated: '2026-11-28',
    lastVerified: '2026-11-28',
  };
  const lines = Object.entries({ ...base, ...over })
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n`;
};
const REL = 'src/content/fundamentals/sample.mdx';
const body = '\n## 見出し\n\n本文です。\n\n### 小見出し\n\n本文。\n';

describe('post-edit checkFile: 記事', () => {
  it('正しい記事はエラーも警告もない', () => {
    expect(checkFile(REL, fm() + body)).toEqual({ errors: [], warnings: [] });
  });

  it('必須キー欠落を報告する', () => {
    const { errors } = checkFile(REL, fm({ description: null, difficulty: null }) + body);
    expect(errors.join('\n')).toMatch(/必須項目が不足.*description.*difficulty/);
  });

  it('フロントマターなし・未終端を報告する', () => {
    expect(checkFile(REL, body).errors.join('\n')).toContain('フロントマター（--- で囲まれたメタデータ）がありません');
    expect(checkFile(REL, '---\ntitle: x\n\n## a\n').errors.join('\n')).toContain('終端');
  });

  it('slug とファイル名、category とディレクトリの不一致を報告する', () => {
    const { errors } = checkFile(REL, fm({ slug: 'other', category: 'network' }) + body);
    expect(errors.some((e) => e.includes('slug（other）'))).toBe(true);
    expect(errors.some((e) => e.includes('category（network）'))).toBe(true);
  });

  it('不正な日付形式を報告する', () => {
    const { errors } = checkFile(REL, fm({ lastUpdated: '2026/11/28', lastVerified: '昨日' }) + body);
    expect(errors.filter((e) => e.includes('YYYY-MM-DD'))).toHaveLength(2);
  });

  it('閉じられていないコードフェンスを報告する', () => {
    const { errors } = checkFile(REL, `${fm()}${body}\n\`\`\`ts\nconst a = 1;\n`);
    expect(errors.join('\n')).toContain('コードフェンス');
  });

  it('コードフェンス内の # は見出しとして扱わない', () => {
    const { errors } = checkFile(REL, `${fm()}${body}\n\`\`\`bash\n# comment\n#### x\n\`\`\`\n`);
    expect(errors).toEqual([]);
  });

  it('見出しレベルの飛び（h2 → h4）を報告する', () => {
    const { errors } = checkFile(REL, `${fm()}\n## a\n\n#### b\n`);
    expect(errors.join('\n')).toMatch(/h2 から h4/);
  });

  it('記事本文の h1 を報告する', () => {
    const { errors } = checkFile(REL, `${fm()}\n# タイトル\n\n## a\n`);
    expect(errors.join('\n')).toContain('h1');
  });

  it('公開記事のプレースホルダーはエラー、draft では警告のみ', () => {
    const text = `${body}\nTODO: あとで書く\n`;
    const pub = checkFile(REL, fm({ draft: 'false' }) + text);
    expect(pub.errors.join('\n')).toContain('プレースホルダー');
    const draft = checkFile(REL, fm({ draft: 'true' }) + text);
    expect(draft.errors).toEqual([]);
    expect(draft.warnings.join('\n')).toContain('プレースホルダー');
  });

  it('コードフェンス内の TODO はプレースホルダー扱いしない', () => {
    const { errors } = checkFile(REL, `${fm()}${body}\n\`\`\`ts\n// TODO\n\`\`\`\n`);
    expect(errors).toEqual([]);
  });
});

describe('post-edit checkFile: 設定ファイル', () => {
  it('不正な JSON を報告し、正しい JSON は通す', () => {
    expect(checkFile('package.json', '{ "a": 1, }').errors.join('\n')).toContain('JSON');
    expect(checkFile('package.json', '{ "a": 1 }').errors).toEqual([]);
  });

  it('tsconfig はコメント・末尾カンマ付き（JSONC）を許容する', () => {
    const jsonc = '{\n  // comment\n  "compilerOptions": { "strict": true, /* c */ "types": ["a",], },\n}\n';
    expect(checkFile('tsconfig.json', jsonc).errors).toEqual([]);
    expect(checkFile('package.json', jsonc).errors.length).toBeGreaterThan(0);
  });

  it('YAML のタブインデントを行番号つきで報告する', () => {
    const { errors } = checkFile('.github/workflows/ci.yml', 'a:\n\tb: 1\n');
    expect(errors).toEqual(['YAML の 2 行目でインデントにタブが使われています']);
    expect(checkFile('x.yaml', 'a:\n  b: 1\n').errors).toEqual([]);
  });

  it('記事以外の md は見出し飛びを警告にとどめる', () => {
    const { errors, warnings } = checkFile('docs/a.md', '# a\n\n### c\n');
    expect(errors).toEqual([]);
    expect(warnings.length).toBe(1);
  });
});

describe('post-edit: サブプロセス（不正入力でもブロックしない）', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikb-postedit-'));
    fs.mkdirSync(path.join(dir, 'src/content/fundamentals'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/content/fundamentals/sample.mdx'), '本文のみ\n');
    fs.writeFileSync(path.join(dir, 'bad.json'), '{oops');
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = () => ({ CLAUDE_PROJECT_DIR: dir, IKB_POST_EDIT_PRETTIER: 'off' });

  it.each([['garbage'], ['null'], ['[]'], ['']])('不正な stdin %j → 終了コード 0・出力なし', (stdin) => {
    const r = runHook('post-edit.mjs', stdin, { env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('file_path が無い / 存在しない / プロジェクト外 → ブロックしない', () => {
    for (const tool_input of [{}, { file_path: 'nope.mdx' }, { file_path: '/etc/hosts' }, { file_path: path.join(dir, '..', 'x.json') }, { file_path: 5 }]) {
      const r = runHook('post-edit.mjs', { tool_name: 'Write', tool_input }, { env: env() });
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('');
    }
  });

  it('問題のある実ファイルは decision: block を返す（終了コードは 0）', () => {
    const r = runHook('post-edit.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(dir, 'bad.json') } }, { env: env() });
    expect(r.status).toBe(0);
    expect(r.json?.decision).toBe('block');
    expect(r.json?.reason).toContain('bad.json');
    const a = runHook('post-edit.mjs', { tool_name: 'Edit', tool_input: { file_path: 'src/content/fundamentals/sample.mdx' } }, { env: env() });
    expect(a.json?.decision).toBe('block');
    expect(a.json?.reason).toContain('フロントマター');
  });
});
