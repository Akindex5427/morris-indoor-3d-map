/**
 * Advanced GeoJSON Merger - Creates Polygons with Holes
 *
 * This script identifies building footprints and merges room boundaries as interior rings (holes).
 * This produces proper architectural floor plans with hollow interiors for 3D extrusion.
 *
 * Strategy:
 * 1. Group features by floor level and room type
 * 2. Identify the largest polygon(s) as building outline
 * 3. Detect smaller polygons contained within the outline
 * 4. Merge contained polygons as holes in the building outline
 *
 * Run: node scripts/merge-with-holes.js <input-file> <output-file>
 */

const fs = require('fs');
const path = require('path');

function mergeWithHoles(inputPath, outputPath) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Merging Polygons with Holes: ${path.basename(inputPath)}`);
  console.log('='.repeat(70) + '\n');

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // Group features by floor
  const byFloor = {};
  data.features.forEach(feature => {
    const floor = feature.properties?.floor ||
                  feature.properties?.nivel ||
                  feature.properties?.level ||
                  0;

    if (!byFloor[floor]) {
      byFloor[floor] = [];
    }
    byFloor[floor].push(feature);
  });

  const mergedFeatures = [];

  // Process each floor
  Object.entries(byFloor).forEach(([floor, features]) => {
    console.log(`\n  Processing Floor ${floor}:`);
    console.log(`    Input features: ${features.length}`);

    // Calculate areas and centroids
    const polygonsWithMetadata = features.map(feature => {
      if (feature.geometry.type !== 'Polygon') {
        return { feature, area: 0, centroid: [0, 0], bbox: null };
      }

      const ring = feature.geometry.coordinates[0];
      const area = calculateArea(ring);
      const centroid = calculateCentroid(ring);
      const bbox = calculateBBox(ring);

      return { feature, area, centroid, bbox, ring };
    });

    // Sort by area descending
    polygonsWithMetadata.sort((a, b) => b.area - a.area);

    // Strategy 1: Find the largest polygon as building outline
    // Then find all polygons contained within it as holes

    const processed = new Set();
    const output = [];

    polygonsWithMetadata.forEach((poly, idx) => {
      if (processed.has(idx)) return;

      const outerRing = poly.ring;
      if (!outerRing) {
        output.push(poly.feature);
        processed.add(idx);
        return;
      }

      // Find all smaller polygons contained within this one
      const holes = [];

      for (let j = idx + 1; j < polygonsWithMetadata.length; j++) {
        if (processed.has(j)) continue;

        const candidateRing = polygonsWithMetadata[j].ring;
        if (!candidateRing) continue;

        // Check if candidate is contained within outer ring
        if (isPolygonInsidePolygon(candidateRing, outerRing)) {
          // Add as hole (with clockwise winding)
          const holeRing = ensureClockwise(candidateRing);
          holes.push(holeRing);
          processed.add(j);
        }
      }

      // Create merged polygon
      const mergedFeature = { ...poly.feature };

      // Ensure outer ring is counter-clockwise
      const ccwOuterRing = ensureCounterClockwise(outerRing);

      // Build coordinates array: [outer ring, ...holes]
      mergedFeature.geometry = {
        type: 'Polygon',
        coordinates: [ccwOuterRing, ...holes]
      };

      // Update properties
      if (holes.length > 0) {
        mergedFeature.properties = {
          ...mergedFeature.properties,
          merged: true,
          hole_count: holes.length
        };
      }

      output.push(mergedFeature);
      processed.add(idx);
    });

    console.log(`    Output features: ${output.length}`);
    console.log(`    Features with holes: ${output.filter(f => f.properties?.hole_count > 0).length}`);

    mergedFeatures.push(...output);
  });

  // Update data
  data.features = mergedFeatures;

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`\n✅ SUCCESS!`);
  console.log(`  Output written to: ${outputPath}`);
  console.log(`  Total features: ${mergedFeatures.length}`);
  console.log(`  Features with holes: ${mergedFeatures.filter(f => f.properties?.hole_count > 0).length}`);
  console.log(`\n${'='.repeat(70)}\n`);
}

/**
 * Check if polygon A is inside polygon B using ray casting
 */
function isPolygonInsidePolygon(polyA, polyB) {
  // Check if all vertices of polyA are inside polyB
  for (const point of polyA) {
    if (!isPointInPolygon(point, polyB)) {
      return false;
    }
  }
  return true;
}

/**
 * Point in polygon test using ray casting
 */
function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate polygon area (signed)
 */
function calculateArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

/**
 * Calculate centroid
 */
function calculateCentroid(ring) {
  let xSum = 0, ySum = 0;
  for (const [x, y] of ring) {
    xSum += x;
    ySum += y;
  }
  return [xSum / ring.length, ySum / ring.length];
}

/**
 * Calculate bounding box
 */
function calculateBBox(ring) {
  const xs = ring.map(p => p[0]);
  const ys = ring.map(p => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

/**
 * Ensure ring is counter-clockwise
 */
function ensureCounterClockwise(ring) {
  return isClockwise(ring) ? ring.reverse() : ring;
}

/**
 * Ensure ring is clockwise
 */
function ensureClockwise(ring) {
  return isClockwise(ring) ? ring : ring.reverse();
}

/**
 * Check if ring is clockwise
 */
function isClockwise(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

/**
 * Batch process all floor files
 */
function batchProcess() {
  const publicDir = path.join(__dirname, '..', 'public');
  const outputDir = path.join(publicDir, 'merged');

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const floorFiles = [
    'rooms-basement-WGS.geojson',
    'rooms-level-1-WGS.geojson',
    'rooms-level-2-WGS.geojson',
    'rooms-level-3-WGS.geojson',
    'rooms-level-4-WGS.geojson',
    'rooms-level-5-WGS.geojson',
    'rooms-level-6-WGS.geojson',
    'rooms-level-7-WGS.geojson',
  ];

  console.log(`\n🔧 BATCH PROCESSING ${floorFiles.length} FILES...\n`);

  floorFiles.forEach(filename => {
    const inputPath = path.join(publicDir, filename);
    const outputPath = path.join(outputDir, filename);

    if (fs.existsSync(inputPath)) {
      try {
        mergeWithHoles(inputPath, outputPath);
      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
      }
    } else {
      console.log(`⚠️  Skipped (not found): ${filename}`);
    }
  });

  console.log(`\n✅ All files processed! Merged files are in: ${outputDir}`);
  console.log(`\nTo use merged files, update your Map3D.js getFloorFileName() function.`);
  console.log(`Example: return floorMap[floor.toString()] || 'merged/rooms-level-1-WGS.geojson';\n`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('No arguments provided. Running batch mode...\n');
    batchProcess();
  } else if (args.length === 2) {
    const [inputPath, outputPath] = args;
    mergeWithHoles(inputPath, outputPath);
  } else {
    console.log('Usage:');
    console.log('  Batch mode: node merge-with-holes.js');
    console.log('  Single file: node merge-with-holes.js <input-file> <output-file>');
    console.log('\nExamples:');
    console.log('  node merge-with-holes.js');
    console.log('  node merge-with-holes.js public/rooms-level-1-WGS.geojson public/merged/rooms-level-1-WGS.geojson');
    process.exit(1);
  }
}

module.exports = { mergeWithHoles };
