import { checkPulse, infer } from '@/lib/ollamaClient';
import { scrapeChatHistory } from './scraper';
import { updateSessionState, initSessionIfMissing } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

console.log("[Maxwell] Content Script Initialized");

// Initialize storage if empty (Development helper)
initSessionIfMissing("Build a browser extension");

let lastProcessedText = "";
let isProcessing = false;

/**
 * HELPER: Extracts code blocks from markdown text
 * Returns an array of { language, code } objects
 */
function extractCodeBlocks(text: string): { language: string; code: string }[] {
  // Regex to capture ```language\n code ``` blocks
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

/**
 * MAIN LOOP: The "Metabolism"
 */
async function runMetabolism() {
  if (isProcessing) return;
  
  // 1. Scrape
  const history = await scrapeChatHistory(5);
  if (history.length === 0) return;

  // 2. Get latest USER message
  const lastUserMessage = history.filter(m => m.role === 'USER').pop();
  if (!lastUserMessage) return;

  // 3. Deduplication (Don't re-process the same prompt)
  if (lastUserMessage.text === lastProcessedText) return;
  
  console.log("[Maxwell] ⚡ Processing:", lastUserMessage.text.slice(0, 50) + "...");
  isProcessing = true;
  lastProcessedText = lastUserMessage.text;

  // 4. Send to The Demon (Ollama)
  const isAlive = await checkPulse();
  if (!isAlive) {
    console.warn("[Maxwell] Demon is offline (Ollama not found)");
    isProcessing = false;
    return;
  }

  try {
    const prompt = `
      Analyze this user message. Return ONLY a JSON object.
      Do not explain. 
      
      Categories:
      0: GOAL (The main objective)
      1: CONSTRAINT (Hard rules, tech stack choices, "don't use x")
      2: CODE (Code blocks, patches, file content)
      3: TASK (Immediate next step, error fixing)
      4: NOISE (Chatter, "thanks", "ok", "looks good")

      Format: { "tier": number, "content": string, "confidence": number }

      Message: "${lastUserMessage.text}"
    `;

    const rawResponse = await infer({
      model: 'llama3', // Ensure this matches your 'ollama list'
      prompt: prompt,
      stream: false,
      options: { temperature: 0.1 }
    });

    console.log("[Maxwell] Raw Output:", rawResponse);

    // Parse JSON (Ollama can be chatty, so we try to find the JSON block)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      // CRITICAL: We pass the original full text so we can extract code blocks if Tier == 2
      await processClassification(result, lastUserMessage.text);
    }

  } catch (e) {
    console.error("[Maxwell] 🔴 Metabolism Failed", e);
  }
  
  isProcessing = false;
}

/**
 * STATE UPDATE LOGIC
 */
async function processClassification(data: { tier: number, content: string }, originalText: string) {
  console.log(`[Maxwell] Classified as Tier ${data.tier}`);

  await updateSessionState((state) => {
    // --- TIER 1: CONSTRAINTS ---
    if (data.tier === 1) {
      // Deduplication: Don't add if a very similar constraint exists
      const exists = state.constraints.some(c => c.content.includes(data.content.slice(0, 15)));
      
      if (!exists) {
        state.constraints.push({
          id: uuidv4(),
          content: data.content,
          active: true
        });
      }
    }

    // --- TIER 2: VIRTUAL FILE SYSTEM (Code) ---
    if (data.tier === 2) {
      const blocks = extractCodeBlocks(originalText);
      
      blocks.forEach(block => {
        // We generate a filename based on time + extension (since we don't have filename inference yet)
        const ext = block.language === 'javascript' ? 'js' : 
                    block.language === 'typescript' ? 'ts' : 
                    block.language || 'txt';
                    
        const filename = `src/extracted_${Date.now().toString().slice(-6)}.${ext}`;
        
        state.vfs[filename] = {
          path: filename,
          content: block.code,
          language: block.language,
          last_modified: Date.now(),
          hash: uuidv4().slice(0, 8), // Placeholder for real SHA-256
          pending_patches: []
        };
      });
      console.log(`[Maxwell] 💾 Saved ${blocks.length} code blocks to VFS`);
    }

    // --- TIER 3: POINTER (Status) ---
    if (data.tier === 3) {
      state.pointer.current_step = data.content;
    }

    // --- TIER 4: NOISE (Dropped) ---
    
    // Update Meta stats
    state.meta.token_count += originalText.length / 4; 
    
    return state;
  });
}

// Heartbeat - Runs every 4 seconds
setInterval(runMetabolism, 4000);