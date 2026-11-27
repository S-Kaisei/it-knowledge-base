import { type ComponentProps, useRef } from 'react';
import { CopyButton } from './copy-button';

/** Display names for the language label in the code block header. Unknown ids are shown as written. */
const LANGUAGE_LABEL: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  console: 'Console',
  html: 'HTML',
  css: 'CSS',
  py: 'Python',
  python: 'Python',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  diff: 'Diff',
  http: 'HTTP',
  dockerfile: 'Dockerfile',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
};

export function languageLabel(lang: string | undefined): string | undefined {
  if (!lang || lang === 'text' || lang === 'txt' || lang === 'plaintext') return undefined;
  return LANGUAGE_LABEL[lang.toLowerCase()] ?? lang;
}

export type CodeBlockProps = ComponentProps<'pre'> & {
  'data-language'?: string;
  'data-title'?: string;
};

/**
 * Wraps Shiki's <pre> (see scripts/lib/mdx-options.mjs) with a header: filename (from `title="..."`),
 * language label and a copy button. The highlighted code itself is static HTML and readable without JS.
 */
export function CodeBlock({ children, 'data-language': lang, 'data-title': title, ...rest }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const label = languageLabel(lang);
  return (
    <div className="code-block" data-language={lang}>
      <div className="code-block-header">
        {title ? <span className="code-block-title">{title}</span> : null}
        {label ? <span className="code-block-lang">{label}</span> : null}
        <CopyButton getText={() => preRef.current?.textContent ?? ''} />
      </div>
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
    </div>
  );
}
