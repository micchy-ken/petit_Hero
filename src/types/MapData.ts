export interface MapEvent {
  x: number;
  y: number;
  type: string;
  data?: any;
}

export interface MapItem {
  x: number;
  y: number;
  itemId: string;
}

export interface MapClearConditions {
  explorationRate?: number | null; // 踏破率
  searchRate?: number | null;      // 捜索率
  defeatRate?: number | null;      // 撃破率
  requiredEvents?: string[];       // 必須イベント
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  bgMode: 'text-black' | 'grass-green' | 'stone-gray' | 'image';
  bgImage?: string;
  events: MapEvent[];
  items: MapItem[];
  enemies: string[]; // 最大3種類
  maxEnemies?: number | 'infinite'; // 出現数
  boss?: string;     // 最大1種類
  clearConditions?: MapClearConditions;
}
