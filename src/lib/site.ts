export const SITE = {
  name: 'IT Knowledge Base',
  tagline: 'ITの仕組みを、基礎から実践まで。',
  description: 'CPUからネットワーク、クラウド、AIまで。図解と具体例で、ITの仕組みを基礎から順を追って理解するための技術資料集です。',
  repoUrl: 'https://github.com/S-Kaisei/it-knowledge-base',
} as const;

export function pageTitle(title?: string): string {
  return title ? `${title} | ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
}
