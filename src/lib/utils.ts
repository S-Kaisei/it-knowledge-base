import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Prefix a root-relative asset path ("/images/x.png") with Vite's base URL. */
export function withBase(href: string, base: string = import.meta.env.BASE_URL): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  return `${base.replace(/\/$/, '')}${href}`;
}
