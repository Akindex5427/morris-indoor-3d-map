const fs = require("fs");
const path = require("path");

function findGeojsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(findGeojsonFiles(full));
    else if (e.isFile() && e.name.toLowerCase().endsWith(".geojson"))
      files.push(full);
  }
  return files;
}

function summarize(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || raw.trim().length === 0) {
      console.log(`\n== ${filePath} ==`);
      console.log("  (empty file)");
      return;
    }
    const data = JSON.parse(raw);
    const features = data.features || [];
    let minH = Infinity,
      maxH = -Infinity;
    let hasBase = 0,
      hasHeight = 0,
      hasAltCoords = 0;
    const levelCounts = {};
    let total = features.length;
    for (const f of features) {
      const p = f.properties || {};
      const base = Number(
        p.base_height ?? p.base ?? p.baseheight ?? p.baseHeight ?? 0
      );
      const height = Number(p.height ?? p.altura ?? p.alt ?? p.h ?? 0);
      if (!Number.isNaN(height)) {
        hasHeight += height !== 0 ? 1 : 0;
        minH = Math.min(minH, height);
        maxH = Math.max(maxH, height);
      }
      if (p.base_height !== undefined || p.base !== undefined) hasBase++;
      const level =
        p.level ?? p.nivel ?? p.floor ?? p.floor_num ?? p.floorNumber ?? null;
      if (level !== null && level !== undefined)
        levelCounts[String(level)] = (levelCounts[String(level)] || 0) + 1;

      // check geometry coords for non-zero Z values
      const geom = f.geometry;
      if (geom && (geom.type === "Polygon" || geom.type === "MultiPolygon")) {
        const coords = JSON.stringify(geom.coordinates);
        if (
          coords.includes(",0,") === false &&
          coords.includes(",0]") === false
        ) {
          // crude check - many files include explicit 0 z values; look for any non-zero third coordinate
        }
        // more precise: scan first few coordinates for 3-length arrays with non-zero third element
        const scan = function (arr) {
          if (!arr) return false;
          for (const a of arr) {
            if (Array.isArray(a)) {
              if (Array.isArray(a[0])) {
                if (scan(a)) return true;
              } else {
                // a is a coordinate like [lng,lat] or [lng,lat,z]
                if (a.length >= 3 && Math.abs(Number(a[2])) > 1e-9) return true;
              }
            }
          }
          return false;
        };
        if (scan(geom.coordinates)) hasAltCoords++;
      }
    }
    if (minH === Infinity) minH = 0;
    if (maxH === -Infinity) maxH = 0;
    console.log(`\n== ${filePath} ==`);
    console.log(`  features: ${total}`);
    console.log(`  features with non-zero height property: ${hasHeight}`);
    console.log(`  min height: ${minH}, max height: ${maxH}`);
    console.log(`  features with base_height/base present: ${hasBase}`);
    console.log(
      `  features with some Z coordinate != 0 (sampled): ${hasAltCoords}`
    );
    console.log("  level counts:", levelCounts);
  } catch (err) {
    console.log(`\n== ${filePath} ==`);
    console.log("  Error parsing:", err.message);
  }
}

const root = path.resolve(__dirname, "..");
const files = findGeojsonFiles(root);
if (files.length === 0) {
  console.log("No geojson files found.");
  process.exit(0);
}
console.log("Found geojson files:", files.length);
for (const f of files) summarize(f);

console.log("\nSummary complete.");
