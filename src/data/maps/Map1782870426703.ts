import { MapData } from '../../types/MapData';

export const Map1782870426703: MapData = {
  "id": "map_1782870426703",
  "name": "白黒の世界",
  "width": 16,
  "height": 16,
  "bgMode": "stone-gray",
  "events": [
    {
      "x": 15,
      "y": 15,
      "type": "start_point",
      "data": {
        "fromMap": null
      }
    },
    {
      "x": 1,
      "y": 0,
      "type": "teleport",
      "data": {
        "targetMap": "map_beginning",
        "requiredDefeatRate": 80
      }
    }
  ],
  "items": [],
  "enemies": [
    "gray_slime"
  ],
  "maxEnemies": 10
};
