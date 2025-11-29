// src/content/scraper.ts

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

export function scrapeChatHistory(limit: number = 10): ScrapedMessage[] {
  const platform = detectPlatform();
  
  if (platform === 'unknown') {
    // Only log this once to avoid spamming
    if (Math.random() > 0.95) console.warn("[Maxwell] Unknown platform");
    return [];
  }

  const config = SELECTORS[platform];
  
  // 1. Find all "Conversation Turns"
  let rows = Array.from(document.querySelectorAll(config.row));
  
  // DEBUG: If we find 0 rows, something is critical
  if (rows.length === 0) {
    // Fallback: Try a generic selector just in case OpenAI changed the ID prefix
    const genericRows = document.querySelectorAll('article');
    if (genericRows.length > 0) {
        console.log(`[Maxwell] Standard selectors failed, found ${genericRows.length} generic articles.`);
        rows = Array.from(genericRows);
    } else {
        return [];
    }
  }

  // 2. Map them to messages
  const history = rows.slice(-limit).map(row => {
    let role: 'USER' | 'AI' = 'AI';
    let text = "";

    if (platform === 'gemini') {
      role = row.classList.contains('user-query-text') ? 'USER' : 'AI';
      text = row.textContent || "";
    } else {
      // ChatGPT Strategy: Look for the specific role attribute
      const isUser = row.querySelector(config.user);
      const isAi = row.querySelector(config.ai) || row.querySelector(config.aiFallback);

      if (isUser) {
        role = 'USER';
        text = isUser.textContent || "";
      } else if (isAi) {
        role = 'AI';
        text = isAi.textContent || "";
      } else {
        // Last resort: Grab all text in the row
        text = row.textContent || "";
      }
    }

    return {
      role,
      text: text.trim()
    };
  }).filter(msg => msg.text.length > 0);

  // DEBUG: Prove it works
  if (history.length > 0 && Math.random() > 0.9) {
    console.log(`[Maxwell] Scraper sees ${history.length} messages. Last: "${history[history.length-1].text.slice(0, 20)}..."`);
  }

  return history;
}