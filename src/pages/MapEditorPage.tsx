import React, { useState, useEffect } from 'react';
import { ArrowLeft, Box, Gem, Zap, Plus, Map as MapIcon, Save, Settings, Play, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapData } from '../types/MapData';
import { getAvailableEnemies, getAvailableBosses } from '../data/EnemyAssets';
import { PhaserGameContainer } from '../components/PhaserGameContainer';
import { allMaps } from '../data/maps';
// @ts-ignore
import grassBgUrl from '../../public/grass_bg_1782776475818.jpg';

export default function MapEditorPage() {
  const navigate = useNavigate();
  
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMapId, setCurrentMapId] = useState<string>('');
  const [isTestPlay, setIsTestPlay] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/maps?t=' + Date.now(), { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('API not available');
        return res.json();
      })
      .then(data => {
        let loadedMaps = Array.isArray(data) ? data : [];
        // Ensure map_beginning is always present in the selection list to preserve consistency
        const hasBeginning = loadedMaps.some((m: MapData) => m.id === 'map_beginning');
        if (!hasBeginning) {
          const beginningMap = allMaps.find((m: MapData) => m.id === 'map_beginning') || allMaps[0];
          loadedMaps = [beginningMap, ...loadedMaps];
        }
        setMaps(loadedMaps);
        
        // Select 'map_beginning' as the default current map if it is available
        const defaultId = loadedMaps.some((m: MapData) => m.id === 'map_beginning')
          ? 'map_beginning'
          : (loadedMaps[0]?.id || '');
        setCurrentMapId(defaultId);
        setIsLoading(false);
      })
      .catch(e => {
        console.warn("Using bundled static maps:", e.message);
        setMaps(allMaps);
        const defaultId = allMaps.some((m: MapData) => m.id === 'map_beginning')
          ? 'map_beginning'
          : (allMaps[0]?.id || '');
        setCurrentMapId(defaultId);
        setIsLoading(false);
      });
  }, []);

  const currentMap = maps.find(m => m.id === currentMapId) || maps[0];

  const [bgMode, setBgMode] = useState<MapData['bgMode']>(currentMap?.bgMode || 'text-black');
  const [placeMode, setPlaceMode] = useState<'obstacle' | 'item' | 'event'>('obstacle');
  
  // イベント配置用の状態
  const [eventType, setEventType] = useState<'start_point' | 'teleport'>('start_point');
  const [startPointFromMap, setStartPointFromMap] = useState<string>('');
  const [teleportTargetMap, setTeleportTargetMap] = useState<string>('');
  const [eventCondExpRate, setEventCondExpRate] = useState<number | null>(null);
  const [eventCondSearchRate, setEventCondSearchRate] = useState<number | null>(null);
  const [eventCondDefeatRate, setEventCondDefeatRate] = useState<number | null>(null);
  
  // アイテム配置用の状態
  const [itemType, setItemType] = useState<string>('treasure_text');

  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapWidth, setNewMapWidth] = useState(16);
  const [newMapHeight, setNewMapHeight] = useState(16);

  useEffect(() => {
    if (currentMap) {
      setBgMode(currentMap.bgMode);
    }
  }, [currentMapId, currentMap]);

  useEffect(() => {
    if (!teleportTargetMap && maps.length > 0) {
      setTeleportTargetMap(maps[0].id);
    }
  }, [maps, teleportTargetMap]);

  const handleGridClick = (x: number, y: number) => {
    if (placeMode === 'event') {
      const existingIndex = currentMap.events.findIndex(e => e.x === x && e.y === y);
      const newEvents = [...currentMap.events];
      
      if (existingIndex >= 0) {
        newEvents.splice(existingIndex, 1);
      } else {
        let data: any = {};
        if (eventType === 'start_point') {
          const targetFromMap = startPointFromMap || null;
          // 元マップ(fromMap)ごとに初期値は1つしか置けないようにする
          const sameFromMapIndex = newEvents.findIndex(
            e => e.type === 'start_point' && (e.data?.fromMap || null) === targetFromMap
          );
          if (sameFromMapIndex >= 0) {
            newEvents.splice(sameFromMapIndex, 1);
          }
          data = { fromMap: targetFromMap };
        } else if (eventType === 'teleport') {
          if (!teleportTargetMap) return;
          data = { targetMap: teleportTargetMap };
        }
        
        if (eventCondExpRate !== null) data.requiredExplorationRate = eventCondExpRate;
        if (eventCondSearchRate !== null) data.requiredSearchRate = eventCondSearchRate;
        if (eventCondDefeatRate !== null) data.requiredDefeatRate = eventCondDefeatRate;
        
        newEvents.push({ x, y, type: eventType, data });
      }
      
      handleUpdateCurrentMap({ events: newEvents });
    } else if (placeMode === 'item') {
      const existingIndex = currentMap.items.findIndex(i => i.x === x && i.y === y);
      const newItems = [...currentMap.items];
      
      if (existingIndex >= 0) {
        newItems.splice(existingIndex, 1);
      } else {
        newItems.push({ x, y, itemId: itemType });
      }
      
      handleUpdateCurrentMap({ items: newItems });
    }
  };

  const handleCreateNewMap = () => {
    if (!newMapName) return;
    const newId = `map_${Date.now()}`;
    const newMap: MapData = {
      id: newId,
      name: newMapName,
      width: newMapWidth,
      height: newMapHeight,
      bgMode: 'text-black',
      events: [],
      items: [],
      enemies: []
    };
    setMaps([...maps, newMap]);
    setCurrentMapId(newId);
    setShowNewMapModal(false);
    setNewMapName('');
    setNewMapWidth(16);
    setNewMapHeight(16);
  };

  const handleUpdateCurrentMap = (updates: Partial<MapData>) => {
    console.log("Updating map with:", updates);
    let finalUpdates = { ...updates };
    if (updates.bgMode) {
      setBgMode(updates.bgMode);
      if (updates.bgMode === 'text-black') {
        finalUpdates.enemies = ['text_teki'];
        finalUpdates.boss = undefined;
      } else if (updates.bgMode === 'stone-gray') {
        finalUpdates.enemies = ['gray_slime'];
        finalUpdates.boss = undefined;
      } else if (currentMap.bgMode === 'text-black' || currentMap.bgMode === 'stone-gray') {
        // If changing from text/gray to color, clear enemies since they are incompatible
        finalUpdates.enemies = [];
        finalUpdates.boss = undefined;
      }
    }

    const targetMap = maps.find(m => m.id === currentMapId) || currentMap;
    const nextWidth = updates.width !== undefined ? updates.width : targetMap.width;
    const nextHeight = updates.height !== undefined ? updates.height : targetMap.height;

    if (updates.width !== undefined || updates.height !== undefined) {
      finalUpdates.events = targetMap.events.filter(e => e.x < nextWidth && e.y < nextHeight);
      finalUpdates.items = targetMap.items.filter(item => item.x < nextWidth && item.y < nextHeight);
    }

    setMaps(maps.map(m => m.id === currentMapId ? { ...m, ...finalUpdates } : m));
  };

  const handleSave = async () => {
    console.log("Attempting to save map:", currentMap);
    try {
      const response = await fetch('/api/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentMap)
      });
      console.log("Save response status:", response.status);
      if (response.ok) {
        alert('保存しました (Reflected to JS file)');
      } else {
        const errorText = await response.text();
        console.error("Save failed:", errorText);
        alert('保存に失敗しました: ' + errorText);
      }
    } catch (e) {
      console.error("Save error:", e);
      alert('保存エラー: サーバーが起動していない可能性があります');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  if (isTestPlay) {
    return (
      <div className="min-h-screen bg-black flex flex-col relative items-center justify-center">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white font-bold px-4 py-2 rounded-full border-2 border-red-400 shadow-[0_0_10px_rgba(255,0,0,0.5)] flex items-center gap-2 animate-pulse">
          <Zap className="w-5 h-5" />
          TEST PLAY
        </div>
        <button
          onClick={() => setIsTestPlay(false)}
          className="absolute top-4 right-4 z-50 bg-slate-800 text-white font-bold px-4 py-2 rounded hover:bg-slate-700 transition-colors border border-slate-600 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          エディターに戻る
        </button>
        
        <PhaserGameContainer 
          isTestPlay={true}
          maps={maps}
          initialMapId={currentMapId}
          onTestPlayClear={() => setShowClearModal(true)}
        />

        {showClearModal && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-emerald-500 rounded-lg p-6 max-w-sm w-full text-center shadow-2xl">
              <h2 className="text-xl font-bold text-emerald-400 mb-4">テストプレイ 完了！</h2>
              <p className="text-slate-300 mb-6">イベント条件を満たし、目標地点に到達しました。</p>
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setIsTestPlay(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded transition-colors w-full"
              >
                確認 (エディターに戻る)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 text-slate-200 font-sans flex flex-col items-center">
      
      {/* 鋼製風ヘッダー */}
      <header className="w-full bg-gradient-to-b from-slate-600 to-slate-700 border-b border-slate-500 shadow-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 bg-slate-800 hover:bg-slate-900 rounded border border-slate-600 transition-colors shadow-inner flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <h1 className="text-xl font-bold tracking-widest text-slate-100 uppercase" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
            Map & Event Editor
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsTestPlay(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-bold shadow transition-colors"
          >
            <Play className="w-4 h-4" /> テストプレイ
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow transition-colors"
          >
            <Save className="w-4 h-4" /> 反映 (Save)
          </button>
          <span className="text-sm text-slate-300">
            {currentMap.name} ({currentMap.width}x{currentMap.height})
          </span>
          <div className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded shadow-inner border border-slate-800">
            STATUS: ONLINE
          </div>
        </div>
      </header>

      {/* エディターメイン画面 */}
      <div className="flex-1 w-full max-w-7xl p-6 flex flex-col md:flex-row gap-6">
        
        {/* 左側メニュー：鋼製パネル風 */}
        <aside className="w-full md:w-72 bg-slate-700 rounded-lg border border-slate-600 shadow-xl p-4 flex flex-col gap-6" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.3)' }}>
          
          {/* マップ選択 / 新規作成 */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-600 pb-1 flex items-center gap-2">
              <MapIcon className="w-4 h-4" /> Select Map
            </h2>
            <div className="flex flex-col gap-2">
              <select 
                value={currentMapId}
                onChange={(e) => setCurrentMapId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-400"
              >
                {maps.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.width}x{m.height})</option>
                ))}
              </select>
              
              <button 
                onClick={() => setShowNewMapModal(true)}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-sm transition-colors border border-emerald-500 shadow-inner"
              >
                <Plus className="w-4 h-4" /> 新規マップ作成
              </button>
            </div>
          </div>

          {/* 背景モード設定 */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-600 pb-1 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Background Mode
            </h2>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="bgMode" 
                  value="text-black" 
                  checked={bgMode === 'text-black'}
                  onChange={() => handleUpdateCurrentMap({ bgMode: 'text-black', bgImage: undefined })}
                  className="accent-slate-400"
                />
                <span className="text-sm">テキスト黒背景</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="bgMode" 
                  value="stone-gray" 
                  checked={bgMode === 'stone-gray'}
                  onChange={() => handleUpdateCurrentMap({ bgMode: 'stone-gray', bgImage: undefined })}
                  className="accent-slate-400"
                />
                <span className="text-sm">シンプル (グレイ石ころ)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="bgMode" 
                  value="grass-green" 
                  checked={bgMode === 'grass-green'}
                  onChange={() => handleUpdateCurrentMap({ bgMode: 'grass-green', bgImage: undefined })}
                  className="accent-slate-400"
                />
                <span className="text-sm">シンプル (緑草原)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="bgMode" 
                  value="image" 
                  checked={bgMode === 'image'}
                  onChange={() => handleUpdateCurrentMap({ bgMode: 'image', bgImage: 'grass_bg_1782776475818.jpg' })}
                  className="accent-slate-400"
                />
                <span className="text-sm">画像背景 (GrassBG等)</span>
              </label>
              
              {bgMode === 'image' && (
                <div className="pl-6 pt-1">
                  <select
                    value={currentMap.bgImage || 'grass_bg_1782776475818.jpg'}
                    onChange={(e) => handleUpdateCurrentMap({ bgImage: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-400"
                  >
                    <option value="grass_bg_1782776475818.jpg">grass_bg_1782776475818.jpg</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 配置モード設定 */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-600 pb-1">
              Placement Mode
            </h2>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setPlaceMode('obstacle')}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded text-sm transition-all ${
                  placeMode === 'obstacle' ? 'bg-slate-600 border border-slate-500 shadow-inner text-white' : 'hover:bg-slate-600/50 text-slate-300'
                }`}
              >
                <Box className="w-4 h-4" />
                障害配置
              </button>
              <button 
                onClick={() => setPlaceMode('item')}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded text-sm transition-all ${
                  placeMode === 'item' ? 'bg-slate-600 border border-slate-500 shadow-inner text-white' : 'hover:bg-slate-600/50 text-slate-300'
                }`}
              >
                <Gem className="w-4 h-4" />
                アイテム配置
              </button>
              <button 
                onClick={() => setPlaceMode('event')}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded text-sm transition-all ${
                  placeMode === 'event' ? 'bg-slate-600 border border-slate-500 shadow-inner text-white' : 'hover:bg-slate-600/50 text-slate-300'
                }`}
              >
                <Zap className="w-4 h-4" />
                イベント配置
              </button>
            </div>
          </div>

          {/* アイテム設定詳細 */}
          {placeMode === 'item' && (
            <div className="flex flex-col gap-3 mt-2 border-t border-slate-600 pt-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider pb-1">
                Item Properties
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">アイテムタイプ</label>
                  <select 
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                  >
                    {bgMode === 'text-black' && <option value="treasure_text">宝 (Text)</option>}
                    <option value="potion">ポーション (未実装)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* イベント設定詳細 */}
          {placeMode === 'event' && (
            <div className="flex flex-col gap-3 mt-2 border-t border-slate-600 pt-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider pb-1">
                Event Properties
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">イベントタイプ</label>
                  <select 
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                  >
                    <option value="start_point">初期値 (Start Point)</option>
                    <option value="teleport">マップ移動 (Teleport)</option>
                  </select>
                </div>

                {eventType === 'start_point' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">元マップ指定</label>
                    <select 
                      value={startPointFromMap}
                      onChange={(e) => setStartPointFromMap(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                    >
                      <option value="">設定なし (デフォルト開始位置)</option>
                      {maps.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {eventType === 'teleport' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">移動先マップ</label>
                    <select 
                      value={teleportTargetMap}
                      onChange={(e) => setTeleportTargetMap(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                    >
                      <option value="" disabled>選択してください</option>
                      {maps.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1 mt-2 border-t border-slate-600 pt-2">
                  <label className="text-xs text-slate-400 font-bold uppercase">固有条件 (踏破率)</label>
                  <select 
                    value={eventCondExpRate === null ? 'null' : String(eventCondExpRate)}
                    onChange={(e) => setEventCondExpRate(e.target.value === 'null' ? null : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                  >
                    <option value="null">なし (条件なし)</option>
                    <option value="50">50%</option>
                    <option value="80">80%</option>
                    <option value="100">100%</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">固有条件 (捜索率)</label>
                  <select 
                    value={eventCondSearchRate === null ? 'null' : String(eventCondSearchRate)}
                    onChange={(e) => setEventCondSearchRate(e.target.value === 'null' ? null : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                  >
                    <option value="null">なし (条件なし)</option>
                    <option value="50">50%</option>
                    <option value="80">80%</option>
                    <option value="100">100%</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 mt-2 border-t border-slate-600 pt-2">
                  <label className="text-xs text-slate-400 font-bold uppercase">固有条件 (撃破率)</label>
                  <select 
                    value={eventCondDefeatRate === null ? 'null' : String(eventCondDefeatRate)}
                    onChange={(e) => setEventCondDefeatRate(e.target.value === 'null' ? null : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                  >
                    <option value="null">なし (条件なし)</option>
                    <option value="50">50%</option>
                    <option value="80">80%</option>
                    <option value="100">100%</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* 中央：マッププレビュー領域 */}
        <main className="flex-1 bg-slate-900 rounded-lg border-2 border-slate-700 p-2 flex items-center justify-center relative overflow-auto shadow-inner">
          <div className={`w-full max-w-[600px] aspect-square rounded ${
            bgMode === 'text-black' ? 'bg-black' : 
            bgMode === 'stone-gray' ? 'bg-slate-400' : 
            bgMode === 'grass-green' ? 'bg-[#4ade80]' :
            bgMode === 'image' ? 'bg-black' : ''
          } flex items-center justify-center transition-colors relative`}
          style={{ 
            width: `${currentMap.width * 32}px`, 
            height: `${currentMap.height * 32}px`,
            backgroundImage: bgMode === 'image' && currentMap.bgImage ? (currentMap.bgImage.includes('grass_bg') ? `url(${grassBgUrl})` : `url(/${currentMap.bgImage})`) : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            ...(bgMode === 'stone-gray' ? { backgroundImage: 'radial-gradient(circle, #cbd5e1 2px, transparent 2px), radial-gradient(circle, #cbd5e1 2px, transparent 2px)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px' } : {})
          }}
          >
            
            {/* Grid Preview (Mock) */}
            <div 
              className="absolute inset-0 grid pointer-events-auto z-10"
              style={{
                gridTemplateColumns: `repeat(${currentMap.width}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${currentMap.height}, minmax(0, 1fr))`
              }}
            >
              {Array.from({ length: currentMap.width * currentMap.height }).map((_, i) => {
                const x = i % currentMap.width;
                const y = Math.floor(i / currentMap.width);
                const hasEvent = currentMap.events.find(e => e.x === x && e.y === y);
                const hasItem = currentMap.items.find(i => i.x === x && i.y === y);
                return (
                  <div 
                    key={i} 
                    className="border border-slate-500/30 hover:bg-slate-400/30 cursor-pointer flex items-center justify-center transition-colors"
                    onClick={() => handleGridClick(x, y)}
                  >
                     {hasEvent && hasEvent.type === 'start_point' && (
                        <div className="w-full h-full bg-yellow-500/50 flex items-center justify-center text-xs font-bold text-yellow-100" title={`初期値 ${hasEvent.data?.fromMap ? `(from: ${hasEvent.data.fromMap})` : ''}`}>
                          S
                        </div>
                     )}
                     {hasEvent && hasEvent.type === 'teleport' && (
                        <div className="w-full h-full bg-blue-500/50 flex items-center justify-center text-xs font-bold text-blue-100" title={`移動 (to: ${hasEvent.data?.targetMap})`}>
                          T
                        </div>
                     )}
                     {hasItem && hasItem.itemId === 'treasure_text' && (
                        <div className="w-full h-full bg-amber-500/50 flex items-center justify-center text-xs font-bold text-amber-100" title={`アイテム: ${hasItem.itemId}`}>
                          宝
                        </div>
                     )}
                  </div>
                );
              })}
            </div>

            <div className="text-center font-mono text-sm opacity-50 select-none pointer-events-none">
              <p className={bgMode === 'simple' || bgMode === 'grass' ? 'text-slate-800' : 'text-slate-400'}>
                [ Map Editor Canvas ]
              </p>
              <p className={`mt-2 ${bgMode === 'simple' || bgMode === 'grass' ? 'text-slate-800' : 'text-slate-400'}`}>
                Grid: {currentMap.width}x{currentMap.height}
              </p>
            </div>
          </div>
        </main>

        {/* 右側：マップ設定領域 */}
        <aside className="w-full md:w-80 bg-slate-700 rounded-lg border border-slate-600 shadow-xl p-4 flex flex-col gap-6 overflow-y-auto" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.3)' }}>
          {/* マップ固有設定 */}
          <div className="flex flex-col gap-3 border-b border-slate-600 pb-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider pb-1">
              Map Config
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">マップ表示名</label>
                <input 
                  type="text"
                  value={currentMap.name}
                  onChange={(e) => handleUpdateCurrentMap({ name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 w-1/2">
                  <label className="text-xs text-slate-400 font-bold uppercase">幅 (Width)</label>
                  <input 
                    type="number"
                    value={currentMap.width}
                    onChange={(e) => handleUpdateCurrentMap({ width: Math.max(1, Number(e.target.value)) })}
                    min={4}
                    max={64}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1 w-1/2">
                  <label className="text-xs text-slate-400 font-bold uppercase">高さ (Height)</label>
                  <input 
                    type="number"
                    value={currentMap.height}
                    onChange={(e) => handleUpdateCurrentMap({ height: Math.max(1, Number(e.target.value)) })}
                    min={4}
                    max={64}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 敵とボスの設定 */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-600 pb-1">
              Enemies & Boss
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">通常敵 (最大3種)</label>
                {[0, 1, 2].map((index) => (
                  <select
                    key={index}
                    value={currentMap.enemies[index] || ''}
                    onChange={(e) => {
                      const newEnemies = [...currentMap.enemies];
                      newEnemies[index] = e.target.value;
                      handleUpdateCurrentMap({ enemies: newEnemies.filter(v => v !== undefined && v !== '') });
                    }}
                    disabled={bgMode === 'text-black' || bgMode === 'stone-gray'} // 自動設定されるため無効化
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400 disabled:opacity-50"
                  >
                    <option value="">なし</option>
                    {getAvailableEnemies(bgMode).map(enemy => (
                      <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
                    ))}
                  </select>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">ボス (1種)</label>
                <select
                  value={currentMap.boss || ''}
                  onChange={(e) => handleUpdateCurrentMap({ boss: e.target.value || undefined })}
                  disabled={bgMode === 'text-black' || bgMode === 'stone-gray'} // 自動設定されるかテキスト黒/グレイには現在ボスがいないかもしれないが無効化する
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">なし</option>
                  {getAvailableBosses(bgMode).map(boss => (
                    <option key={boss.id} value={boss.id}>{boss.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 mt-2 border-t border-slate-600 pt-2">
                <label className="text-xs text-slate-400 font-bold uppercase">敵の出現数 (Max Enemies)</label>
                <select
                  value={currentMap.maxEnemies === undefined || currentMap.maxEnemies === 'infinite' ? 'infinite' : currentMap.maxEnemies === 0 ? 'none' : String(currentMap.maxEnemies)}
                  onChange={(e) => {
                    let val: 'infinite' | number = 'infinite';
                    if (e.target.value === 'infinite') val = 'infinite';
                    else if (e.target.value === 'none') val = 0;
                    else val = Number(e.target.value);
                    handleUpdateCurrentMap({ maxEnemies: val });
                  }}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-slate-400"
                >
                  <option value="none">なし (None)</option>
                  <option value="infinite">無限 (Infinite)</option>
                  <option value="5">5体</option>
                  <option value="10">10体</option>
                  <option value="20">20体</option>
                  <option value="30">30体</option>
                  <option value="50">50体</option>
                </select>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 新規マップ作成モーダル */}
      {showNewMapModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-700 rounded-xl border border-slate-500 shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" /> 新規マップ作成
            </h3>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-bold uppercase">マップ名 (表示名)</label>
              <input 
                type="text"
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                placeholder="例: はじまりの村"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1 w-1/2">
                <label className="text-xs text-slate-300 font-bold uppercase">幅 (Width)</label>
                <input 
                  type="number"
                  value={newMapWidth}
                  onChange={(e) => setNewMapWidth(Number(e.target.value))}
                  min={1}
                  max={64}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1 w-1/2">
                <label className="text-xs text-slate-300 font-bold uppercase">高さ (Height)</label>
                <input 
                  type="number"
                  value={newMapHeight}
                  onChange={(e) => setNewMapHeight(Number(e.target.value))}
                  min={1}
                  max={64}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="text-xs text-slate-400 mt-1">
              ファイル名は自動生成されます。
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={() => setShowNewMapModal(false)}
                className="px-4 py-2 rounded text-sm text-slate-300 hover:bg-slate-600 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleCreateNewMap}
                disabled={!newMapName}
                className="px-4 py-2 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

