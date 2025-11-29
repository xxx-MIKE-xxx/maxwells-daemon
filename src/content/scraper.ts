// src/content/scraper.ts

import {
  fetchConversation,
  getCurrentChatId,
  processConversation,
  type ConversationNode,
} from '@/lib/chatgpt/api'

export interface ScrapedMessage {
  role: 'USER' | 'AI';
  text: string;
}

const SELECTORS = {
  chatgpt: {
    // 🟢 THE GOLDEN ANCHORS (Stable)
    // We look for the "Turn" container first
    row: '[data-testid^="conversation-turn-"]', 
    // Then we look for the specific role attribute inside
    user: '[data-message-author-role="user"]',
    ai: '[data-message-author-role="assistant"]',
    // Fallback if data-attributes fail (Unstable)
    aiFallback: '.markdown' 
  },
  claude: {
    row: '.font-claude-message',
    user: '.font-user-message',
    ai: '.grid-cols-1',
  },
  gemini: {
    row: 'message-content',
    user: '.user-query-text',
    ai: '.model-response-text',
  }
};

function detectPlatform(): 'chatgpt' | 'claude' | 'gemini' | 'unknown' {
  const url = window.location.hostname;
  if (url.includes('chatgpt.com')) return 'chatgpt';
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('gemini.google.com')) return 'gemini';
  return 'unknown';
}

async function scrapeChatGptFromApi(limit: number): Promise<ScrapedMessage[]> {
  try {
    const chatId = await getCurrentChatId();
    const conversation = await fetchConversation(chatId, false);
    const { conversationNodes } = processConversation(conversation);

    return conversationNodes.slice(-limit).map((node): ScrapedMessage => ({
      role: node.message?.author.role === 'user' ? 'USER' : 'AI',
      text: extractTextFromNode(node),
    })).filter((msg) => msg.text.length > 0);
  } catch (error) {
    console.warn('[Maxwell] ChatGPT API scrape failed, falling back to DOM', error);
    return [];
  }
}

function scrapeFromDom(platform: 'chatgpt' | 'claude' | 'gemini', limit: number): ScrapedMessage[] {
  const config = SELECTORS[platform];

  let rows = Array.from(document.querySelectorAll(config.row));

  if (rows.length === 0) {
    const genericRows = document.querySelectorAll('article');
    if (genericRows.length > 0) {
      console.log(`[Maxwell] Standard selectors failed, found ${genericRows.length} generic articles.`);
      rows = Array.from(genericRows);
    } else {
      return [];
    }
  }

  const history = rows.slice(-limit).map(row => {
    let role: 'USER' | 'AI' = 'AI';
    let text = "";

    if (platform === 'gemini') {
      role = row.classList.contains('user-query-text') ? 'USER' : 'AI';
      text = row.textContent || "";
    } else {
      const isUser = row.querySelector(config.user);
      const isAi = row.querySelector(config.ai) || ('aiFallback' in config ? row.querySelector((config as any).aiFallback) : null);

      if (isUser) {
        role = 'USER';
        text = isUser.textContent || "";
      } else if (isAi) {
        role = 'AI';
        text = isAi.textContent || "";
      } else {
        text = row.textContent || "";
      }
    }

    return {
      role,
      text: text.trim()
    };
  }).filter(msg => msg.text.length > 0);

  return history;
}

function extractTextFromNode(node: ConversationNode): string {
  const message = node.message;
  if (!message) return '';

  const content = message.content;
  if (!content) return '';

  switch (content.content_type) {
    case 'text':
      return (content.parts || []).join('\n').trim();
    case 'code':
    case 'execution_output':
      return (content as any).text?.trim() || '';
    case 'multimodal_text':
      return (content.parts || [])
        .map((part) => typeof part === 'string' ? part : '')
        .filter(Boolean)
        .join('\n')
        .trim();
    default:
      return '';
  }
}

export async function scrapeChatHistory(limit: number = 10): Promise<ScrapedMessage[]> {
  const platform = detectPlatform();

  if (platform === 'unknown') {
    if (Math.random() > 0.95) console.warn("[Maxwell] Unknown platform");
    return [];
  }

  if (platform === 'chatgpt') {
    const apiHistory = await scrapeChatGptFromApi(limit);
    if (apiHistory.length > 0) return apiHistory;
  }

  const fallbackHistory = scrapeFromDom(platform, limit);

  if (fallbackHistory.length > 0 && Math.random() > 0.9) {
    console.log(`[Maxwell] Scraper sees ${fallbackHistory.length} messages. Last: "${fallbackHistory[fallbackHistory.length-1].text.slice(0, 20)}..."`);
  }

  return fallbackHistory;
}