import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/save-map", (req, res) => {
    try {
      const mapData = req.body;
      if (!mapData || !mapData.id) {
        return res.status(400).json({ error: "Invalid map data" });
      }

      // Convert id (e.g. map_beginning) to CamelCase (e.g. BeginningMap) for export name
      let exportName = mapData.id
        .split('_')
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      
      if (mapData.id === 'map_beginning') {
        exportName = 'BeginningMap';
      }
      
      const content = `import { MapData } from '../../types/MapData';

export const ${exportName}: MapData = ${JSON.stringify(mapData, null, 2)};
`;
      const fileName = `${exportName}.ts`;
      const filePath = path.join(process.cwd(), "src", "data", "maps", fileName);
      
      fs.writeFileSync(filePath, content);
      console.log(`Saved map to ${filePath}`);
      res.json({ success: true, filePath });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/maps", (req, res) => {
    try {
      const mapsDir = path.join(process.cwd(), "src", "data", "maps");
      const files = fs.readdirSync(mapsDir);
      const maps = [];
      for (const file of files) {
        if (file.endsWith(".ts") && file !== "index.ts") {
          const filePath = path.join(mapsDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          // Extract JSON using a highly flexible regex that supports trailing semicolons or not, arbitrary whitespace, etc.
          const match = content.match(/export const \w+\s*:\s*MapData\s*=\s*(\{[\s\S]*?\})\s*;?\s*$/) || 
                        content.match(/export const \w+\s*:\s*MapData\s*=\s*(\{[\s\S]*\})/);
          if (match && match[1]) {
            try {
              maps.push(JSON.parse(match[1]));
            } catch (err) {
              try {
                // Fallback: evaluate the object literal safely as standard JS object
                const parsedObject = new Function(`return ${match[1]}`)();
                maps.push(parsedObject);
              } catch (evalErr: any) {
                console.error("Failed to parse or evaluate JSON for file", file, evalErr.message);
              }
            }
          } else {
            console.warn(`Flexible regex did not match content of file: ${file}`);
          }
        }
      }
      console.log(`Loaded ${maps.length} maps from disk:`, maps.map(m => m.id));
      res.json(maps);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
