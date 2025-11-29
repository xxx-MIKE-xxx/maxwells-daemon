import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  name: "Maxwell's Daemon",
  description: "Entropy-based Context Manager for LLM Sessions",
  version: '1.0.0',
  manifest_version: 3,
  permissions: [
    'activeTab',
    'storage',
    'sidePanel',
    'scripting'
  ],
  host_permissions: [
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*'
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: [
        'https://chatgpt.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*',
        'http://127.0.0.1/*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  side_panel: {
    default_path: 'src/panel/index.html',
  },
  action: {
    default_title: 'Open Maxwell Control',
    default_icon: 'icons/icon-32.png',
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' http://127.0.0.1:11434 ws://127.0.0.1:11434 ws://localhost:5173 http://localhost:5173;"
  }
})