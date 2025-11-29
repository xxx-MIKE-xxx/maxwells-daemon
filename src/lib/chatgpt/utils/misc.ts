// src/lib/chatgpt/utils/misc.ts

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function timestamp() {
    // Returns current time in format: 2024-11-29_14-00-00
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`
}

export function dateStr() {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
}

export function unixTimestampToISOString(timestamp: number) {
    return new Date(timestamp * 1000).toISOString()
}

export function jsonlStringify(list: any[]) {
    return list.map(item => JSON.stringify(item)).join('\n')
}

export function nonNullable<T>(value: T): value is NonNullable<T> {
    return value !== null && value !== undefined
}