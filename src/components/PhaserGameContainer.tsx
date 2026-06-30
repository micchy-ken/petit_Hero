import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { GridMovementScene, HeroState, Direction, ActionLog } from '../phaser/GridMovementScene';
import { Play, Pause, RotateCcw, Eye, EyeOff, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gauge, Grid, Image as ImageIcon, Heart, Sword, Star, Settings, X, Move } from 'lucide-react';

export const PhaserGameContainer: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GridMovementScene | null>(null);
  const lastLevelRef = useRef<number>(1);

  // UIステータス
  const [showSettings, setShowSettings] = useState(false);
  const [heroState, setHeroState] = useState<HeroState>({
    gridX: 7,
    gridY: 7,
    camGridX: 4,
    camGridY: 4,
    direction: 'idle',
    isMoving: false,
    isScrolling: false,
    speedMs: 450,
    hp: 20,
    maxHp: 20,
    attack: 5,
    level: 1,
    exp: 0
  });

  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [autoMode, setAutoMode] = useState<'none' | 'random' | 'seek'>('seek');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isHd2d, setIsHd2d] = useState<boolean>(false);
  const [useGrassBg, setUseGrassBg] = useState<boolean>(true);
  const [allow8Way, setAllow8Way] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'normal' | 'text' | 'grayscale'>('text');
  const [speed, setSpeed] = useState<number>(1000);
  const [showSpritesheetModal, setShowSpritesheetModal] = useState<boolean>(false);
  const [spritesheetUrl, setSpritesheetUrl] = useState<string>('');

  useEffect(() => {
    if (!gameContainerRef.current) return;

    // ゲームコンフィグ (トータル448x448px = 7 x 64px)
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 448,
      height: 448,
      parent: gameContainerRef.current,
      backgroundColor: '#ecfdf5',
      scene: [GridMovementScene],
      physics: {
        default: 'arcade'
      },
      render: {
        pixelArt: true,
        antialias: false
      },
      audio: {
        disableWebAudio: true,
        noAudio: true
      }
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    // シーンの読み込み完了を待機してコールバックを設定
    game.events.once('ready', () => {
      const scene = game.scene.getScene('GridMovementScene') as GridMovementScene;
      if (scene) {
        sceneRef.current = scene;
        lastLevelRef.current = 1;
        scene.setOnStateChange((newState) => {
          setHeroState(newState);

          if (newState.level !== lastLevelRef.current) {
            const prevLevel = lastLevelRef.current;
            lastLevelRef.current = newState.level;

            // 自動デモンストレーション切り替え
            if (newState.level === 3) {
              setDisplayMode('grayscale');
              setSpeed(800);
              scene.setDisplayMode('grayscale');
              scene.setSpeed(800);
              scene.sendLog('【デモ】レベル3：グレースケール(32x32画質)・速度800msに自動切り替えしました！', 'system');
            } else if (newState.level === 6) {
              setDisplayMode('normal');
              setUseGrassBg(false);
              scene.setDisplayMode('normal');
              scene.toggleGrassBg(false);
              scene.sendLog('【デモ】レベル6：HD-2Dモード・GrassBGオフに自動切り替えしました！', 'system');
            } else if (newState.level === 8) {
              setAllow8Way(true);
              setSpeed(450);
              setUseGrassBg(true);
              setIsHd2d(true);
              setDisplayMode('normal');
              
              scene.toggle8WayMode(true);
              scene.setSpeed(450);
              scene.toggleGrassBg(true);
              scene.toggleHd2dEffects(true);
              scene.setDisplayMode('normal');
              scene.sendLog('【デモ】レベル8：8方向移動・速度450ms・FX & GrassBGオン（フルスペック）に自動切り替えしました！', 'system');
            } else if (newState.level === 1 && prevLevel > 1) {
              // レベル1へのリセット処理
              setDisplayMode('text');
              setSpeed(1000);
              setAllow8Way(false);
              setIsHd2d(false);
              setUseGrassBg(true);

              scene.setDisplayMode('text');
              scene.setSpeed(1000);
              scene.toggle8WayMode(false);
              scene.toggleHd2dEffects(false);
              scene.toggleGrassBg(true);
              scene.sendLog('【デモ】レベル1：初期のテキストモード（4方向・1000ms・FXオフ）に自動リセットしました！', 'system');
            }
          }
        });
        
        scene.setOnLog((newLog) => {
          setLogs(prev => [...prev.slice(-49), newLog]); // 最新50件を保持
        });

        // テクスチャからプレビュー用URLを抽出
        setTimeout(() => {
          if (game.textures.exists('hero_spritesheet')) {
            const texture = game.textures.get('hero_spritesheet');
            const sourceImage = texture.getSourceImage() as HTMLCanvasElement;
            if (sourceImage && sourceImage.toDataURL) {
              setSpritesheetUrl(sourceImage.toDataURL());
            }
          }
        }, 500);
      }
    });

    return () => {
      game.destroy(true);
      gameInstanceRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // UI操作ハンドラー
  const toggleAutoMode = () => {
    let nextMode: 'none' | 'random' | 'seek' = 'none';
    if (autoMode === 'none') nextMode = 'random';
    else if (autoMode === 'random') nextMode = 'seek';
    else nextMode = 'none';

    setAutoMode(nextMode);
    sceneRef.current?.setAutoMode(nextMode);
  };

  const toggleGrid = () => {
    const nextVal = !showGrid;
    setShowGrid(nextVal);
    sceneRef.current?.toggleGridLines(nextVal);
  };

  const toggleGrassBg = () => {
    const nextVal = !useGrassBg;
    setUseGrassBg(nextVal);
    sceneRef.current?.toggleGrassBg(nextVal);
  };

  const toggle8Way = () => {
    const nextVal = !allow8Way;
    setAllow8Way(nextVal);
    sceneRef.current?.toggle8WayMode(nextVal);
  };

  const toggleHd2d = () => {
    const nextVal = !isHd2d;
    setIsHd2d(nextVal);
    sceneRef.current?.toggleHd2dEffects(nextVal);
  };

  const isTextMode = displayMode === 'text';

  const handleDisplayModeChange = (mode: 'normal' | 'text' | 'grayscale') => {
    setDisplayMode(mode);
    sceneRef.current?.setDisplayMode(mode);
  };

  const openSpritesheetModal = () => {
    const game = gameInstanceRef.current;
    if (game) {
      let textureKey = 'hero_spritesheet';
      if (displayMode === 'text') textureKey = 'hero_spritesheet_text';
      else if (displayMode === 'grayscale') textureKey = 'hero_spritesheet_gray';

      if (game.textures.exists(textureKey)) {
        const texture = game.textures.get(textureKey);
        const sourceImage = texture.getSourceImage() as HTMLCanvasElement;
        if (sourceImage && sourceImage.toDataURL) {
          setSpritesheetUrl(sourceImage.toDataURL());
        }
      }
    }
    setShowSpritesheetModal(true);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    sceneRef.current?.setSpeed(newSpeed);
  };

  const handleReset = () => {
    sceneRef.current?.resetPosition();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 relative">
      
      {/* Settings Toggle Button */}
      <button 
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-white rounded-full shadow-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors z-20"
      >
        {showSettings ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
      </button>

      <div className={showSettings ? "hidden" : "flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200"}>
        {/* 左側：ゲーム画面（448x448pxフレーム） */}
        <div className="flex flex-col items-center bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden p-4 sm:p-6">

            
            {/* Phaser描画ターゲットとログオーバーレイのラッパー */}
            <div className="relative rounded-lg overflow-hidden shadow-inner border-2 border-emerald-600 bg-emerald-50 select-none" style={{ width: 448, height: 448 }}>
              <div 
                ref={gameContainerRef} 
                className="w-full h-full"
              />
              {/* Virtual Pad / Auto Toggle Overlay */}
              {autoMode !== 'none' ? (
                <button
                  onClick={() => {
                    setAutoMode('none');
                    sceneRef.current?.setAutoMode('none');
                  }}
                  className="absolute bottom-4 left-4 z-20 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm transition-all border border-emerald-400/50 flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  AUTO
                </button>
              ) : (
                <div className="absolute bottom-4 left-4 z-20">
                  <div className="grid grid-cols-3 gap-1 bg-slate-800/60 p-2.5 rounded-2xl backdrop-blur-sm border border-white/10 shadow-lg">
                    {/* Row 1: Up */}
                    <div />
                    <button 
                      onPointerDown={() => sceneRef.current?.setVirtualInput('up', true)}
                      onPointerUp={() => sceneRef.current?.setVirtualInput('up', false)}
                      onPointerLeave={() => sceneRef.current?.setVirtualInput('up', false)}
                      className="bg-white/20 hover:bg-white/30 active:bg-white/40 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                    ><ArrowUp className="w-6 h-6 text-white" /></button>
                    <div />
                    
                    {/* Row 2: Left, Center, Right */}
                    <button 
                      onPointerDown={() => sceneRef.current?.setVirtualInput('left', true)}
                      onPointerUp={() => sceneRef.current?.setVirtualInput('left', false)}
                      onPointerLeave={() => sceneRef.current?.setVirtualInput('left', false)}
                      className="bg-white/20 hover:bg-white/30 active:bg-white/40 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                    ><ArrowLeft className="w-6 h-6 text-white" /></button>
                    <div className="w-12 h-12 flex items-center justify-center opacity-30">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    </div>
                    <button 
                      onPointerDown={() => sceneRef.current?.setVirtualInput('right', true)}
                      onPointerUp={() => sceneRef.current?.setVirtualInput('right', false)}
                      onPointerLeave={() => sceneRef.current?.setVirtualInput('right', false)}
                      className="bg-white/20 hover:bg-white/30 active:bg-white/40 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                    ><ArrowRight className="w-6 h-6 text-white" /></button>

                    {/* Row 3: Close (✕), Down, Empty */}
                    <button 
                      onClick={() => {
                        setAutoMode('seek');
                        sceneRef.current?.setAutoMode('seek');
                      }}
                      className="bg-rose-600/85 hover:bg-rose-600 active:bg-rose-700 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm border border-rose-500/30"
                      title="Return to Auto Mode"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                    <button 
                      onPointerDown={() => sceneRef.current?.setVirtualInput('down', true)}
                      onPointerUp={() => sceneRef.current?.setVirtualInput('down', false)}
                      onPointerLeave={() => sceneRef.current?.setVirtualInput('down', false)}
                      className="bg-white/20 hover:bg-white/30 active:bg-white/40 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                    ><ArrowDown className="w-6 h-6 text-white" /></button>
                    <div />
                  </div>
                </div>
              )}

              {/* アクションログオーバーレイ (最新5件) */}
              <div className="absolute bottom-2 right-2 w-64 pointer-events-none flex flex-col justify-end gap-1 z-10 p-2">
                {logs.slice(-5).map((log) => (
                  <div key={log.id} className={`animate-in fade-in slide-in-from-bottom-2 duration-300 text-xs font-bold text-right drop-shadow-md ${
                    log.type === 'damage' ? 'text-rose-400' :
                    log.type === 'combat' ? 'text-amber-400' :
                    log.type === 'system' ? 'text-sky-300 font-extrabold' :
                    'text-white'
                  }`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>

            {/* HP and Level Status Bar */}
            <div className="w-full mt-4 flex items-center justify-between gap-4 font-mono">
              <div className="flex-1 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                  <Heart className="w-3.5 h-3.5 text-rose-400" /> HP
                </div>
                <div className="text-base font-bold text-white">
                  <span className={heroState.hp <= 5 ? "text-rose-400" : ""}>{heroState.hp}</span> / {heroState.maxHp}
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${heroState.hp <= 5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${Math.max(0, (heroState.hp / heroState.maxHp) * 100)}%` }} 
                  />
                </div>
              </div>
              
              <div className="flex-1 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                  <Star className="w-3.5 h-3.5 text-amber-400" /> Lv.{heroState.level} EXP
                </div>
                <div className="text-base font-bold text-sky-300">
                  {heroState.exp} / 10
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-sky-400 rounded-full transition-all" 
                    style={{ width: `${(heroState.exp / 10) * 100}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* デモ自動切替用のレベル調整ショートカット */}
            <div className="w-full mt-3 p-3 bg-slate-900 border border-slate-700/40 rounded-xl flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-300 font-sans font-bold">
                <Star className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>勇者レベル調整 (自動設定デモ)</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => sceneRef.current?.addLevel()}
                  className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold py-1 px-2.5 rounded transition-colors"
                >
                  Lv +1
                </button>
                <button
                  onClick={() => {
                    sceneRef.current?.resetHero();
                    setDisplayMode('text');
                    setSpeed(1000);
                    setAllow8Way(false);
                    setIsHd2d(false);
                    setUseGrassBg(true);
                  }}
                  className="bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 py-1 px-2 rounded transition-colors"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>
        </div>
      
      {/* 右側：コントロール＆ステータスパネル (設定画面) */}
      <div className={!showSettings ? "hidden" : "flex flex-col gap-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200"}>
          
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200 flex flex-col gap-6">
            <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-emerald-600" /> Control & Testing Panel
            </h3>


          {/* 自動移動モード切替 */}
          <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-sm font-medium text-slate-800">Auto Movement</div>
              <div className="text-xs text-slate-500">
                {autoMode === 'none' && 'Manual control only'}
                {autoMode === 'random' && 'Wandering randomly'}
                {autoMode === 'seek' && 'Seek & Combat (No AI)'}
              </div>
            </div>
            <button
              onClick={toggleAutoMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm ${
                autoMode !== 'none'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              {autoMode === 'none' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {autoMode === 'none' ? 'OFF' : (autoMode === 'random' ? 'Random' : 'Seek')}
            </button>
          </div>

          {/* 移動スピード調整 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-medium text-slate-700">
              <span>Movement Speed</span>
              <span className="font-mono text-emerald-600">{speed} ms / grid</span>
            </div>
            <input
              type="range"
              min="150"
              max="1000"
              step="50"
              value={speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="w-full accent-emerald-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>Fast (150ms)</span>
              <span>Slow (1000ms)</span>
            </div>
          </div>

          {/* ユーティリティボタン群 */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={toggleGrassBg}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                useGrassBg 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {useGrassBg ? 'Grass Bg ON' : 'Grass Bg OFF'}
            </button>

            <button
              onClick={toggleGrid}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                showGrid 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              {showGrid ? 'Grid ON' : 'Grid OFF'}
            </button>

            <button
              onClick={toggleHd2d}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                isHd2d 
                  ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {isHd2d ? 'HD-2D FX ON' : 'HD-2D FX OFF'}
            </button>
            
            <button
              onClick={toggle8Way}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                allow8Way 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              {allow8Way ? '8-Way Move' : '4-Way Move'}
            </button>

            <button
              onClick={openSpritesheetModal}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Sprites
            </button>

            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Center
            </button>

            {/* Display Mode Selector */}
            <div className="col-span-2 flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-sans">Display Mode</span>
              <div className="flex bg-white rounded-lg border border-slate-200/60 overflow-hidden text-xs font-medium p-0.5">
                <button
                  onClick={() => handleDisplayModeChange('normal')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1 rounded-md transition-all ${
                    displayMode === 'normal'
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  HD-2D
                </button>
                <button
                  onClick={() => handleDisplayModeChange('grayscale')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1 rounded-md transition-all ${
                    displayMode === 'grayscale'
                      ? 'bg-slate-700 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Gray 32x32
                </button>
                <button
                  onClick={() => handleDisplayModeChange('text')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1 rounded-md transition-all ${
                    displayMode === 'text'
                      ? 'bg-slate-900 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Text
                </button>
              </div>
            </div>

            {/* レベル別デモコントローラー */}
            <div className="col-span-2 flex flex-col gap-2.5 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60 mt-1">
              <span className="text-[10px] font-bold text-amber-700 tracking-wider uppercase font-sans flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                Demo Auto-Switch (レベル自動切替デモ)
              </span>
              <p className="text-[11px] text-slate-500 leading-normal">
                レベルアップに伴い、画質・速度・移動方向・エフェクトが段階的に自動解放されるデモ機能です。（手動での切り替えも自由に行えます）
              </p>
              
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => sceneRef.current?.addLevel()}
                  className="flex-1 bg-amber-600 hover:bg-amber-505 active:bg-amber-700 hover:bg-amber-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                >
                  <Star className="w-3.5 h-3.5 text-amber-200" />
                  Lv UP (+1) [現在のLv: {heroState.level}]
                </button>
                <button
                  onClick={() => {
                    sceneRef.current?.resetHero();
                    setDisplayMode('text');
                    setSpeed(1000);
                    setAllow8Way(false);
                    setIsHd2d(false);
                    setUseGrassBg(true);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-semibold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Reset to Lv.1
                </button>
              </div>

              <div className="text-[10px] text-slate-500 flex flex-col gap-1 mt-1 bg-white/75 p-2.5 rounded-lg border border-slate-200/60 font-sans">
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded ${heroState.level >= 1 && heroState.level < 3 ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-400"}`}>
                  <span>・Lv.1〜2: Text / 1000ms / 4方向 / FXオフ</span>
                  {heroState.level >= 1 && heroState.level < 3 && <span className="text-[9px] bg-amber-600 text-white px-1 rounded">現在</span>}
                </div>
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded ${heroState.level >= 3 && heroState.level < 6 ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-400"}`}>
                  <span>・Lv.3〜5: Gray 32x32 / 800ms / 4方向</span>
                  {heroState.level >= 3 && heroState.level < 6 && <span className="text-[9px] bg-amber-600 text-white px-1 rounded">現在</span>}
                </div>
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded ${heroState.level >= 6 && heroState.level < 8 ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-400"}`}>
                  <span>・Lv.6〜7: HD-2D / GrassBGオフ</span>
                  {heroState.level >= 6 && heroState.level < 8 && <span className="text-[9px] bg-amber-600 text-white px-1 rounded">現在</span>}
                </div>
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded ${heroState.level >= 8 ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-400"}`}>
                  <span>・Lv.8〜: HD-2D / 450ms / 8方向 / FX & GrassBGオン</span>
                  {heroState.level >= 8 && <span className="text-[9px] bg-amber-600 text-white px-1 rounded">現在</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* スプライトシートの切り出し確認モーダル */}
      {showSpritesheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h4 className="text-lg font-bold text-slate-800">Generated 64x64px Spritesheet</h4>
                <p className="text-xs text-slate-500">4 Frames × 4 Directions (Total 256x256px)</p>
              </div>
              <button 
                onClick={() => setShowSpritesheetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center bg-slate-900 p-6 rounded-xl border border-slate-800 mb-4 overflow-auto">
              {spritesheetUrl ? (
                <div className="relative border border-slate-700 bg-slate-800/50 p-2 rounded">
                  <img 
                    src={spritesheetUrl} 
                    alt="Hero Spritesheet" 
                    className="w-64 h-64 select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* ガイドグリッド */}
                  <div className="absolute inset-2 pointer-events-none grid grid-cols-4 grid-rows-4">
                    {Array.from({ length: 16 }).map((_, idx) => (
                      <div key={idx} className="border border-emerald-500/20" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm py-12">Loading texture...</div>
              )}
              <div className="grid grid-cols-4 w-64 text-center text-[10px] font-mono text-emerald-400 mt-2">
                <span>Frame 0</span>
                <span>Frame 1</span>
                <span>Frame 2</span>
                <span>Frame 3</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div><strong className="text-slate-800">Row 0:</strong> DOWN (Front walking animation)</div>
              <div><strong className="text-slate-800">Row 1:</strong> UP (Back walking animation)</div>
              <div><strong className="text-slate-800">Row 2:</strong> LEFT (Side walking animation)</div>
              <div><strong className="text-slate-800">Row 3:</strong> RIGHT (Side walking animation)</div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSpritesheetModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
