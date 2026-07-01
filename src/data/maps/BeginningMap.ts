import { MapData } from '../../types/MapData';

export const BeginningMap: MapData = {
  "id": "map_beginning",
  "name": "始まり",
  "width": 9,
  "height": 9,
  "bgMode": "text-black",
  "events": [
    {
      "x": 4,
      "y": 4,
      "type": "start_point",
      "data": {
        "fromMap": null
      }
    }
  ],
  "items": [],
  "enemies": [
    "text_teki"
  ]
};
