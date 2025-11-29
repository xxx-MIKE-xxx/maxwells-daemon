// src/lib/chatgpt/text.ts
import { fetchConversation, getCurrentChatId, processConversation } from './api'
import { checkIfConversationStarted } from './page'
// Ensure this path is correct relative to this file
import { copyToClipboard } from './utils/clipboard' 
import { flatMap, fromMarkdown, toMarkdown } from './utils/markdown'
// This now imports from the NEW file we created in Step 3
import { standardizeLineBreaks } from './utils/text' 

import type { ConversationNodeMessage, Citation } from './api'
import type { Emphasis, Strong, Text } from 'mdast'
import type { Node } from 'unist'

export async function fetchChatContent(): Promise<string | null> {
    if (!checkIfConversationStarted()) {
        console.warn('Maxwell: No conversation started')
        return null
    }

    const chatId = await getCurrentChatId()
    
    // Fetch full conversation via API
    const rawConversation = await fetchConversation(chatId, false)

    const { conversationNodes } = processConversation(rawConversation)
    
    const text = conversationNodes
        .map(({ message }) => transformMessage(message))
        .filter(Boolean)
        .join('\n\n')

    return standardizeLineBreaks(text)
}

const LatexRegex = /(\s\$\$.+\$\$\s|\s\$.+\$\s|\\\[.+\\\]|\\\(.+\\\))|(^\$$[\S\s]+^\$$)|(^\$\$[\S\s]+^\$\$$)/gm

function transformMessage(message?: ConversationNodeMessage) {
    if (!message || !message.content) return null

    if (message.recipient !== 'all') return null

    if (message.author.role === 'tool') {
        if (
            message.content.content_type !== 'multimodal_text'
            && !(
                message.content.content_type === 'execution_output'
                && message.metadata?.aggregate_result?.messages?.some((msg: any) => msg.message_type === 'image')
            )
        ) {
            return null
        }
    }

    const author = transformAuthor(message.author)
    let content = transformContent(message.content, message.metadata)

    const matches = content.match(LatexRegex)
    if (matches) {
        let index = 0
        content = content.replace(LatexRegex, () => {
            return `╬${index++}╬`
        })
    }

    if (message.author.role === 'assistant') {
        content = transformFootNotes(content, message.metadata)
    }

    if (message.author.role === 'assistant' && content) {
        content = reformatContent(content)
    }

    if (matches) {
        content = content.replace(/╬(\d+)╬/g, (_, index: string) => {
            return matches[+index]
        })
    }

    return `${author}:\n${content}`
}

function transformContent(
    content: ConversationNodeMessage['content'],
    metadata: ConversationNodeMessage['metadata'],
) {
    switch (content.content_type) {
        case 'text':
            return content.parts?.join('\n') || ''
        case 'code':
            return content.text || ''
        case 'execution_output':
            if (metadata?.aggregate_result?.messages) {
                return metadata.aggregate_result.messages
                    .filter((msg: any) => msg.message_type === 'image')
                    .map(() => '[image]')
                    .join('\n')
            }
            return content.text || ''
        case 'tether_quote':
            return `> ${content.title || content.text || ''}`
        case 'tether_browsing_code':
            return ''
        case 'tether_browsing_display': {
            const metadataList = metadata?._cite_metadata?.metadata_list
            if (Array.isArray(metadataList) && metadataList.length > 0) {
                return metadataList.map(({ title, url }) => `> [${title}](${url})`).join('\n')
            }
            return ''
        }
        case 'multimodal_text': {
            return content.parts?.map((part: any) => {
                if (typeof part === 'string') return part
                if (part.content_type === 'image_asset_pointer') return '[image]'
                if (part.content_type === 'audio_transcription') return `[audio] ${part.text}`
                return '[Unsupported multimodal content]'
            }).join('\n') || ''
        }
        default:
            return '[Unsupported Content]'
    }
}

function reformatContent(input: string) {
    const root = fromMarkdown(input)
    flatMap(root, (item: Node) => {
        if (item.type === 'strong') return (item as Strong).children
        if (item.type === 'emphasis') return (item as Emphasis).children
        return [item]
    })
    const result = toMarkdown(root)
    if (result.startsWith('\\[') && input.startsWith('[')) {
        return result.slice(1)
    }
    return result
}

function transformAuthor(author: ConversationNodeMessage['author']): string {
    switch (author.role) {
        case 'assistant':
            return 'ChatGPT'
        case 'user':
            return 'You'
        case 'tool':
            return `Plugin${author.name ? ` (${author.name})` : ''}`
        default:
            return author.role
    }
}

function transformFootNotes(
    input: string,
    metadata: ConversationNodeMessage['metadata'],
) {
    const footNoteMarkRegex = /【(\d+)†\((.+?)\)】/g
    return input.replace(footNoteMarkRegex, (match, citeIndex, _evidenceText) => {
        const citation = metadata?.citations?.find((cite: Citation) => cite.metadata?.extra?.cited_message_idx === +citeIndex)
        if (citation) return ''
        return match
    })
}