export type ClassValue = string | false | null | undefined | 0;
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
