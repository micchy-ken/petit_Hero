import { MapData } from '../../types/MapData';
const mapModules = (import.meta as any).glob('./*.ts', { eager: true });
export const allMaps: MapData[] = [];
const seenIds = new Set<string>();
for (const path in mapModules) {
  if (path.includes('index.ts')) continue;
  const mod: any = mapModules[path];
  for (const key in mod) {
    if (mod[key] && mod[key].id) {
      if (!seenIds.has(mod[key].id)) {
        seenIds.add(mod[key].id);
        allMaps.push(mod[key]);
      }
    }
  }
}
