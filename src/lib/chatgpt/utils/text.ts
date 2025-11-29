// src/lib/chatgpt/utils/text.ts

export function standardizeLineBreaks(str: string): string {
    return str.replace(/\r\n/g, '\n');
}