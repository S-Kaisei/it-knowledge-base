import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

// H10（静的部分）: エージェントのツール権限と Skill のメタデータ。実セッションでの編集不可確認は手動。
const readFm = (file: string): Record<string, unknown> => matter(fs.readFileSync(file, 'utf8')).data;

const agentsDir = path.join(REPO_ROOT, '.claude', 'agents');
const agents = fs
  .readdirSync(agentsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ file: f, fm: readFm(path.join(agentsDir, f)) }));
const toolsOf = (name: string): string[] => {
  const a = agents.find((x) => x.fm.name === name);
  expect(a, `agent ${name} exists`).toBeDefined();
  const t = a?.fm.tools;
  return (Array.isArray(t) ? t : String(t).split(',')).map((x) => String(x).trim()).filter(Boolean);
};

describe('H10: エージェントの権限', () => {
  it('全エージェントに name / description / tools があり、name はファイル名と一致する', () => {
    expect(agents.length).toBeGreaterThanOrEqual(6);
    for (const { file, fm } of agents) {
      expect(typeof fm.name, file).toBe('string');
      expect(String(fm.description ?? '').length, file).toBeGreaterThan(10);
      expect(fm.tools, file).toBeTruthy();
      expect(`${fm.name}.md`).toBe(file);
    }
  });

  it.each(['technical-reviewer', 'researcher'])('%s は読み取り専用（Edit / Write / Bash / NotebookEdit なし）', (name) => {
    const tools = toolsOf(name);
    expect(tools.length).toBeGreaterThan(0);
    for (const forbidden of ['Edit', 'Write', 'Bash', 'NotebookEdit', 'MultiEdit']) expect(tools).not.toContain(forbidden);
  });

  it('visual-reviewer は Edit / Write を持たない', () => {
    const tools = toolsOf('visual-reviewer');
    for (const forbidden of ['Edit', 'Write', 'NotebookEdit', 'MultiEdit']) expect(tools).not.toContain(forbidden);
  });
});

describe('Skills', () => {
  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  const skills = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ dir: d.name, fm: readFm(path.join(skillsDir, d.name, 'SKILL.md')) }));

  it('全 Skill に name（ディレクトリ名と一致）と description がある', () => {
    expect(skills.length).toBeGreaterThanOrEqual(7);
    for (const { dir, fm } of skills) {
      expect(fm.name, dir).toBe(dir);
      expect(String(fm.description ?? '').length, dir).toBeGreaterThan(10);
    }
  });

  it.each(['release', 'verify-site'])('%s は disable-model-invocation: true（手動起動のみ）', (name) => {
    expect(skills.find((s) => s.dir === name)?.fm['disable-model-invocation']).toBe(true);
  });
});
