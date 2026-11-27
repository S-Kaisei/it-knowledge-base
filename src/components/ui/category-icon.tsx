import { AppWindow, Binary, Bot, Briefcase, Cloud, Code, Cpu, Database, FileText, GitBranch, Globe, LayoutGrid, type LucideIcon, Shield } from 'lucide-react';

// Explicit map keeps the bundle small (no dynamic icon lookup). Add an entry when categories.json gains an icon.
const ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  binary: Binary,
  globe: Globe,
  shield: Shield,
  database: Database,
  code: Code,
  'app-window': AppWindow,
  cloud: Cloud,
  bot: Bot,
  'layout-grid': LayoutGrid,
  'git-branch': GitBranch,
  briefcase: Briefcase,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? FileText;
  return <Icon aria-hidden="true" className={className} />;
}
