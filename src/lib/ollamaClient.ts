// src/lib/ollamaClient.ts

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean; // We usually want false for the "Demon" logic (atomic updates)
  system?: string;  // The "Role Definition"
  options?: {
    temperature?: number; // 0 for strict categorization
    num_predict?: number; // Limit tokens for speed
  };
}

const OLLAMA_HOST = 'http://127.0.0.1:11434';

/**
 * The Heartbeat Check
 * Verifies if Ollama is running and accessible before we attempt heavy lifting.
 */
export async function checkPulse(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1000); 

    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { 
      signal: controller.signal 
    });
    
    clearTimeout(id);
    return res.ok;
  } catch (err) {
    // ⬇️ ADD THIS LINE
    console.error("[Maxwell Debug] Pulse Check Error:", err);
    return false;
  }
}

/**
 * The Synapse
 * Sends a strict, non-streaming request to the local model.
 */
export async function infer(payload: OllamaRequest): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        stream: false, // Force JSON response (no streaming) for easier parsing
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaResponse;
    return data.response;
  } catch (error) {
    console.error('[Maxwell] Inference Failed:', error);
    throw error;
  }
}
