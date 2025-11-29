import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../global.css';
import { useMaxwellStore } from '@/lib/store';
import { FileNode } from '@/lib/types';
import { Trash2, FileCode, ShieldAlert, RefreshCw } from 'lucide-react'; // Ensure you installed lucide-react

const MaxwellPanel = () => {
  const { state, loadFromStorage, initializeSession, resetStorage } = useMaxwellStore();
  const [activeTab, setActiveTab] = useState<'memory' | 'vfs'>('memory');

  // Auto-refresh the UI every 2 seconds to reflect background changes
  useEffect(() => {
    loadFromStorage();
    const interval = setInterval(loadFromStorage, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return (
      <div className="bg-[#1e1e1e] h-screen p-6 text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-mono text-green-500 font-bold tracking-tighter">MAXWELL DAEMON</h1>
        <p className="text-gray-500 text-center text-xs">NO ACTIVE CONTEXT FOUND</p>
        <button 
          onClick={() => initializeSession("Build a browser extension")}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-xs font-bold transition text-black"
        >
          BOOTSTRAP SESSION
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#1e1e1e] min-h-screen text-gray-300 font-mono text-xs flex flex-col">
      {/* HEADER HUD */}
      <div className="bg-[#252526] p-3 border-b border-[#3e3e42] flex justify-between items-center sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${state.meta.token_count > 4000 ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
            <span className="font-bold text-gray-100">MAXWELL_ACTIVERECORD</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">TOKENS: {Math.floor(state.meta.token_count)} / 4096</p>
        </div>
        <button onClick={() => resetStorage()} className="hover:text-red-400 transition">
          <Trash2 size={14} />
        </button>
      </div>

      {/* EXECUTION POINTER (Always Visible) */}
      <div className="p-3 bg-[#2d2d2d] border-b border-black">
        <h3 className="text-yellow-500 font-bold mb-1">➜ CURRENT_POINTER</h3>
        <p className="text-gray-100">{state.pointer.current_step}</p>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#3e3e42]">
        <button 
          onClick={() => setActiveTab('memory')}
          className={`flex-1 py-2 text-center hover:bg-[#2d2d2d] ${activeTab === 'memory' ? 'border-b-2 border-green-500 text-green-500' : ''}`}
        >
          CONSTRAINTS ({state.constraints.length})
        </button>
        <button 
          onClick={() => setActiveTab('vfs')}
          className={`flex-1 py-2 text-center hover:bg-[#2d2d2d] ${activeTab === 'vfs' ? 'border-b-2 border-blue-500 text-blue-500' : ''}`}
        >
          VFS ({Object.keys(state.vfs).length})
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="p-3 flex-1 overflow-y-auto">
        
        {/* VIEW: MEMORY (Constraints) */}
        {activeTab === 'memory' && (
          <div className="space-y-2">
             <div className="mb-4">
              <span className="text-green-600 font-bold block mb-1">NORTH_STAR</span>
              <div className="bg-black/30 p-2 rounded border border-green-900/50 text-gray-400">
                {state.north_star.content}
              </div>
            </div>

            <span className="text-gray-500 font-bold block mb-1">HARD_CONSTRAINTS</span>
            {state.constraints.map((c) => (
              <div key={c.id} className="flex items-start gap-2 bg-[#252526] p-2 rounded border-l-2 border-red-500">
                <ShieldAlert size={12} className="mt-0.5 text-red-500 shrink-0" />
                <span>{c.content}</span>
              </div>
            ))}
            {state.constraints.length === 0 && <div className="text-gray-600 italic">No active constraints.</div>}
          </div>
        )}

        {/* VIEW: VFS (Files) */}
        {activeTab === 'vfs' && (
          <div className="space-y-2">
            {Object.values(state.vfs).map((file: FileNode) => (
              <div key={file.path} className="bg-[#252526] rounded border border-[#3e3e42] overflow-hidden">
                <div className="bg-[#2d2d2d] p-2 flex items-center justify-between border-b border-[#3e3e42]">
                  <div className="flex items-center gap-2 text-blue-400">
                    <FileCode size={12} />
                    <span className="font-bold">{file.path}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{file.language}</span>
                </div>
                <pre className="p-2 text-[10px] text-gray-400 overflow-x-auto">
                  <code>{file.content.slice(0, 150)}...</code>
                </pre>
              </div>
            ))}
            {Object.keys(state.vfs).length === 0 && (
              <div className="text-center py-8 text-gray-600">
                <p>VIRTUAL FILE SYSTEM EMPTY</p>
                <p className="text-[10px]">Paste code blocks in chat to ingest.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MaxwellPanel />
  </React.StrictMode>,
);