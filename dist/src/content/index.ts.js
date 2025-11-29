import { checkPulse, infer } from "/src/lib/ollamaClient.ts.js";
import { scrapeChatHistory } from "/src/content/scraper.ts.js";
import { updateSessionState, initSessionIfMissing } from "/src/lib/storage.ts.js";
import { v4 as uuidv4 } from "/vendor/.vite-deps-uuid.js__v--33469017.js";
import { fetchChatContent } from "/src/lib/chatgpt/text.ts.js";
console.log("[Maxwell] Content Script Initialized");
initSessionIfMissing("Build a browser extension");
let lastProcessedText = "";
let isProcessing = false;
function extractCodeBlocks(text) {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "plaintext",
      code: match[2].trim()
    });
  }
  return blocks;
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "METABOLISM_FULL_SYNC") {
    console.log("Maxwell: Triggering full API sync...");
    fetchChatContent().then((fullText) => {
      sendResponse({ status: "success", data: fullText });
    }).catch((err) => {
      console.error("Maxwell: Export failed", err);
      sendResponse({ status: "error", message: err.message });
    });
    return true;
  }
});
async function runMetabolism() {
  if (isProcessing) return;
  const history = scrapeChatHistory(5);
  if (history.length === 0) return;
  const lastUserMessage = history.filter((m) => m.role === "USER").pop();
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
      model: "llama3",
      prompt,
      stream: false,
      options: { temperature: 0.1 }
    });
    console.log("[Maxwell] Raw Output:", rawResponse);
    let jsonString = rawResponse;
    const arrayMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonString = arrayMatch[0];
    } else {
      if (rawResponse.trim().startsWith("{") && !rawResponse.trim().startsWith("[")) {
        jsonString = `[${rawResponse}]`;
      }
    }
    try {
      const result = JSON.parse(jsonString);
      const items = Array.isArray(result) ? result : [result];
      for (const item of items) {
        await processClassification(item, lastUserMessage.text);
      }
    } catch (parseErr) {
      console.warn("[Maxwell] JSON Parse Error (First Attempt). cleaning...", parseErr);
    }
  } catch (e) {
    console.error("[Maxwell] 🔴 Metabolism Failed", e);
  }
  isProcessing = false;
}
async function processClassification(data, originalText) {
  console.log(`[Maxwell] Classified as Tier ${data.tier}: ${data.content.slice(0, 20)}...`);
  await updateSessionState((state) => {
    if (data.tier === 0) {
      const currentContent = state.north_star?.content || "";
      const defaultGoal = "Build a browser extension";
      if (!currentContent || currentContent === defaultGoal) {
        state.north_star = {
          id: state.north_star?.id || uuidv4(),
          // Keep existing ID or make new one
          content: data.content,
          locked: true
        };
      }
    }
    if (data.tier === 1) {
      const exists = state.constraints.some((c) => c.content.includes(data.content.slice(0, 15)));
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
      blocks.forEach((block) => {
        const ext = block.language === "javascript" ? "js" : block.language === "typescript" ? "ts" : block.language === "bash" ? "sh" : block.language || "txt";
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
    state.meta.token_count += originalText.length / 4;
    return state;
  });
}
setInterval(runMetabolism, 4e3);
