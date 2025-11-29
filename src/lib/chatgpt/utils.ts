export function jsonlStringify(value: unknown): string {
  if (!Array.isArray(value)) return JSON.stringify(value);
  return value.map((item) => JSON.stringify(item)).join('\n');
}

export function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function dateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function timestamp(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
}

export function unixTimestampToISOString(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toISOString();
}

export function standardizeLineBreaks(input: string): string {
  return input.replace(/\r\n?/g, '\n');
}
