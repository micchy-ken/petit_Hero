import { MapData } from '../../types/MapData';

export const Map1782950565893: MapData = {
  "id": "map_1782950565893",
  "name": "カラーの世界",
  "width": 16,
  "height": 16,
  "bgMode": "grass-green",
  "events": [
    {
      "x": 1,
      "y": 0,
      "type": "start_point",
      "data": {
        "fromMap": null
      }
    },
    {
      "x": 15,
      "y": 15,
      "type": "teleport",
      "data": {
        "targetMap": "map_1782951234203",
        "requiredDefeatRate": 100
      }
    }
  ],
  "items": [],
  "enemies": [],
  "maxEnemies": 20
};
