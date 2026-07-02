import { MapData } from '../../types/MapData';

export const BeginningMap: MapData = {
  "id": "map_beginning",
  "name": "始まり",
  "width": 8,
  "height": 8,
  "bgMode": "text-black",
  "events": [
    {
      "x": 0,
      "y": 0,
      "type": "start_point",
      "data": {
        "fromMap": null
      }
    },
    {
      "x": 7,
      "y": 7,
      "type": "teleport",
      "data": {
        "targetMap": "map_1782870426703",
        "requiredDefeatRate": 100
      }
    }
  ],
  "items": [],
  "enemies": [
    "slime"
  ],
  "maxEnemies": 0
};
