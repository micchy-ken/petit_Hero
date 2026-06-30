import React from 'react';
import { PhaserGameContainer } from './components/PhaserGameContainer';
import { Gamepad2, Layers, Cpu, ShieldCheck } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* トップヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">Petit_Hero</h1>
              <p className="text-xs text-slate-500 font-mono">64x64px Sprites & ランダムウォークAI</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-6 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grid: 7 × 7 View / 16 × 16 Field</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>Phaser 3 Engine</span>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 flex items-center justify-center py-8">
        <PhaserGameContainer />
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Built on HTML5 Canvas API & Phaser.js Base Architecture</span>
          </div>
          <div className="font-mono text-slate-400">
            Spritesheet: 256x256px (exact 64x64px slices)
          </div>
        </div>
      </footer>

    </div>
  );
}

