import { checkPulse, infer } from '@/lib/ollamaClient';
import { scrapeChatHistory } from './scraper';
import { updateSessionState, initSessionIfMissing } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { fetchChatContent } from '../lib/chatgpt/text'; 

console.log("[Maxwell] Content Script Initialized");

// Initialize storage if empty
initSessionIfMissing("Build a browser extension");

let lastProcessedText = "";
let isProcessing = false;

function extractCodeBlocks(text: string): { language: string; code: string }[] {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim()
    });
  }
  return blocks;
}

// Listen for "Force Sync" commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "METABOLISM_FULL_SYNC") {
        console.log("Maxwell: Triggering full API sync...");
        fetchChatContent().then((fullText) => {
            sendResponse({ status: "success", data: fullText });
        }).catch(err => {
            console.error("Maxwell: Export failed", err);
            sendResponse({ status: "error", message: err.message });
        });
        return true; 
    }
});

/**
 * MAIN LOOP: The "Metabolism"
 */
async function runMetabolism() {
  if (isProcessing) return;
  
  const history = scrapeChatHistory(5);
  if (history.length === 0) return;

  const lastUserMessage = history.filter(m => m.role === 'USER').pop();
  if (!lastUserMessage) return;

  if (lastUserMessage.text === lastProcessedText) return;
  
  console.log("[Maxwell] ⚡ Processing:", lastUserMessage.text.slice(0, 50) + "...");
  isProcessing = true;
  lastProcessedText = lastUserMessage.text;

  const isAlive = await checkPulse();
  if (!isAlive) {
    console.warn("[Maxwell] Demon is offline (Ollama not found)");
    isProcessing = false;
    return;
  }

  try {
    // CHANGED: Prompt now asks for a JSON Array explicitly
    const prompt = `
      Analyze this user message. Return a strictly valid JSON ARRAY of objects.
      Do not explain. 
      
      Categories:
      0: GOAL (The main objective)
      1: CONSTRAINT (Hard rules, tech stack choices, "don't use x")
      2: CODE (Code blocks, patches, file content)
      3: TASK (Immediate next step, error fixing)
      4: NOISE (Chatter, "thanks", "ok", "looks good")

      Format: [ { "tier": number, "content": string, "confidence": number } ]

      Message: "${lastUserMessage.text}"
    `;

    const rawResponse = await infer({
      model: 'llama3', 
      prompt: prompt,
      stream: false,
      options: { temperature: 0.1 }
    });

    console.log("[Maxwell] Raw Output:", rawResponse);

    // CHANGED: More robust JSON parsing
    // 1. Try to find the array brackets [ ... ]
    let jsonString = rawResponse;
    const arrayMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        jsonString = arrayMatch[0];
    } else {
        // Fallback: If LLM output multiple objects like {...}, {...} without brackets, wrap them
        // This regex looks for } followed by , or whitespace followed by {
        if (rawResponse.trim().startsWith('{') && !rawResponse.trim().startsWith('[')) {
             jsonString = `[${rawResponse}]`;
        }
    }

    try {
        const result = JSON.parse(jsonString);
        // Handle both single object (if prompt failed) and array
        const items = Array.isArray(result) ? result : [result];
        
        for (const item of items) {
            await processClassification(item, lastUserMessage.text);
        }
    } catch (parseErr) {
        console.warn("[Maxwell] JSON Parse Error (First Attempt). cleaning...", parseErr);
        // Optional: Advanced cleaning logic could go here
    }

  } catch (e) {
    console.error("[Maxwell] 🔴 Metabolism Failed", e);
  }
  
  isProcessing = false;
}

async function processClassification(data: { tier: number, content: string }, originalText: string) {
  console.log(`[Maxwell] Classified as Tier ${data.tier}: ${data.content.slice(0, 20)}...`);

  await updateSessionState((state) => {
    if (data.tier === 0) {
      // FIX: Access .content property instead of the object itself
      const currentContent = state.north_star?.content || "";
      const defaultGoal = "Build a browser extension";

      // Only update if currently empty or still equals the default placeholder
      if (!currentContent || currentContent === defaultGoal) {
          // FIX: Assign a full object, not just a string
          state.north_star = {
              id: state.north_star?.id || uuidv4(), // Keep existing ID or make new one
              content: data.content,
              locked: true 
          };
      }
   }

    if (data.tier === 1) {
      const exists = state.constraints.some(c => c.content.includes(data.content.slice(0, 15)));
      if (!exists) {
        state.constraints.push({
          id: uuidv4(),
          content: data.content,
          active: true
        });
      }
    }

    if (data.tier === 2) {
      const blocks = extractCodeBlocks(originalText);
      blocks.forEach(block => {
        // Normalize filename if possible, otherwise use timestamp
        // TODO: Ask LLM for filename in the JSON response
        const ext = block.language === 'javascript' ? 'js' : 
                    block.language === 'typescript' ? 'ts' : 
                    block.language === 'bash' ? 'sh' :
                    block.language || 'txt';
                    
        const filename = `src/extracted_${Date.now().toString().slice(-6)}.${ext}`;
        
        state.vfs[filename] = {
          path: filename,
          content: block.code,
          language: block.language,
          last_modified: Date.now(),
          hash: uuidv4().slice(0, 8), 
          pending_patches: []
        };
      });
      console.log(`[Maxwell] 💾 Saved ${blocks.length} code blocks to VFS`);
    }

    if (data.tier === 3) {
      state.pointer.current_step = data.content;
    }
    
    // Update Meta stats
    state.meta.token_count += originalText.length / 4; 
    
    return state;
  });
}

setInterval(runMetabolism, 4000);