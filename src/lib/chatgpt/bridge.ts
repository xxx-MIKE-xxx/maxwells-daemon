// src/lib/chatgpt/bridge.ts

/**
 * Injects a script into the MAIN world to extract global variables
 * like __NEXT_DATA__ or __remixContext which contain auth tokens.
 */
export function getPageContextFromMainWorld(): Promise<any> {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      
      // We create a temporary event listener to receive the data
      const eventId = `maxwell_bridge_${Math.random().toString(36).substr(2, 9)}`;
      
      script.textContent = `
        (function() {
          try {
            const data = window.__NEXT_DATA__ || window.__remixContext || {};
            window.dispatchEvent(new CustomEvent('${eventId}', { detail: data }));
          } catch (e) {
            console.error("Maxwell Bridge Error:", e);
            window.dispatchEvent(new CustomEvent('${eventId}', { detail: null }));
          }
        })();
      `;
  
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent;
        resolve(customEvent.detail);
        window.removeEventListener(eventId, listener);
        script.remove();
      };
  
      window.addEventListener(eventId, listener);
      (document.head || document.documentElement).appendChild(script);
    });
  }