export function getPageContextFromMainWorld() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    const eventId = `maxwell_bridge_${Math.random().toString(36).substr(2, 9)}`;
    script.textContent = `
        (function() {
          try {
            // Attempt to grab the context object from known ChatGPT/Remix globals
            const data = window.__NEXT_DATA__ || window.__remixContext || {};
            window.dispatchEvent(new CustomEvent('${eventId}', { detail: data }));
          } catch (e) {
            console.error("Maxwell Bridge Error:", e);
            window.dispatchEvent(new CustomEvent('${eventId}', { detail: null }));
          }
        })();
      `;
    const listener = (event) => {
      const customEvent = event;
      resolve(customEvent.detail);
      window.removeEventListener(eventId, listener);
      script.remove();
    };
    window.addEventListener(eventId, listener);
    (document.head || document.documentElement).appendChild(script);
  });
}
