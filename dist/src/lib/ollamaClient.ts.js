const OLLAMA_HOST = "http://127.0.0.1:11434";
export async function checkPulse() {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1e3);
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(id);
    return res.ok;
  } catch (err) {
    console.error("[Maxwell Debug] Pulse Check Error:", err);
    return false;
  }
}
export async function infer(payload) {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        stream: false
        // Force JSON response (no streaming) for easier parsing
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("[Maxwell] Inference Failed:", error);
    throw error;
  }
}
