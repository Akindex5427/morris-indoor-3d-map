/**
 * GeoJSON Diagnostic Tool
 *
 * Analyzes GeoJSON files to identify topology issues that prevent proper 3D extrusion
 * Run: node scripts/diagnose-geojson.js <path-to-geojson-file>
 */

const fs = require('fs');
const path = require('path');

function diagnoseGeoJSON(filePath) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Analyzing: ${path.basename(filePath)}`);
  console.log('='.repeat(70));

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const stats = {
    totalFeatures: data.features.length,
    polygons: 0,
    multiPolygons: 0,
    polygonsWithHoles: 0,
    selfIntersecting: [],
    duplicateVertices: [],
    clockwiseOuter: [],
    counterClockwiseInner: [],
    tinyPolygons: [],
    overlapping: []
  };

  data.features.forEach((feature, idx) => {
    const geom = feature.geometry;

    if (geom.type === 'Polygon') {
      stats.polygons++;

      // Check for holes (interior rings)
      if (geom.coordinates.length > 1) {
        stats.polygonsWithHoles++;
      }

      // Check winding order of outer ring
      const outerRing = geom.coordinates[0];
      if (isClockwise(outerRing)) {
        stats.clockwiseOuter.push(idx);
      }

      // Check winding order of holes
      for (let i = 1; i < geom.coordinates.length; i++) {
        if (!isClockwise(geom.coordinates[i])) {
          stats.counterClockwiseInner.push(idx);
        }
      }

      // Check for duplicate vertices
      if (hasDuplicateVertices(outerRing)) {
        stats.duplicateVertices.push(idx);
      }

      // Check for tiny polygons
      const area = calculateArea(outerRing);
      if (area < 1e-12) {
        stats.tinyPolygons.push(idx);
      }

    } else if (geom.type === 'MultiPolygon') {
      stats.multiPolygons++;
    }
  });

  // Print results
  console.log(`\n📊 STATISTICS:`);
  console.log(`  Total Features: ${stats.totalFeatures}`);
  console.log(`  Polygons: ${stats.polygons}`);
  console.log(`  MultiPolygons: ${stats.multiPolygons}`);
  console.log(`  Polygons with Holes: ${stats.polygonsWithHoles}`);

  console.log(`\n⚠️  TOPOLOGY ISSUES:`);

  if (stats.clockwiseOuter.length > 0) {
    console.log(`  ❌ Clockwise outer rings (should be CCW): ${stats.clockwiseOuter.length}`);
    console.log(`     Feature IDs: ${stats.clockwiseOuter.slice(0, 5).join(', ')}${stats.clockwiseOuter.length > 5 ? '...' : ''}`);
  } else {
    console.log(`  ✅ All outer rings are counter-clockwise`);
  }

  if (stats.counterClockwiseInner.length > 0) {
    console.log(`  ❌ Counter-clockwise inner rings (should be CW): ${stats.counterClockwiseInner.length}`);
    console.log(`     Feature IDs: ${stats.counterClockwiseInner.slice(0, 5).join(', ')}${stats.counterClockwiseInner.length > 5 ? '...' : ''}`);
  } else {
    console.log(`  ✅ All inner rings are clockwise`);
  }

  if (stats.duplicateVertices.length > 0) {
    console.log(`  ❌ Duplicate consecutive vertices: ${stats.duplicateVertices.length}`);
  } else {
    console.log(`  ✅ No duplicate consecutive vertices`);
  }

  if (stats.tinyPolygons.length > 0) {
    console.log(`  ⚠️  Tiny polygons (may cause rendering issues): ${stats.tinyPolygons.length}`);
  }

  console.log(`\n🔍 DIAGNOSIS:`);
  if (stats.polygonsWithHoles === 0 && stats.polygons > 50) {
    console.log(`  ⚠️  NO HOLES DETECTED!`);
    console.log(`     This file has ${stats.polygons} polygons but ZERO polygons with interior rings.`);
    console.log(`     For architectural floor plans with rooms, you should have:`);
    console.log(`       - Building outline as outer ring`);
    console.log(`       - Room boundaries as inner rings (holes)`);
    console.log(`     \n     This is likely WHY your extrusion looks like solid blocks!`);
    console.log(`     \n     SOLUTION: Run the fix-topology.js script to merge polygons correctly.`);
  } else if (stats.polygonsWithHoles > 0) {
    console.log(`  ✅ File contains ${stats.polygonsWithHoles} polygons with holes - good topology!`);
  }

  if (stats.clockwiseOuter.length > 0 || stats.counterClockwiseInner.length > 0) {
    console.log(`  ⚠️  Winding order issues detected - this will cause rendering problems!`);
    console.log(`     SOLUTION: Run the fix-topology.js script to correct winding order.`);
  }

  console.log(`\n${'='.repeat(70)}\n`);

  return stats;
}

// Helper: Calculate signed area to determine winding order
function isClockwise(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0; // Positive = clockwise
}

// Helper: Calculate polygon area
function calculateArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

// Helper: Check for duplicate consecutive vertices
function hasDuplicateVertices(ring) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    if (x1 === x2 && y1 === y2) {
      return true;
    }
  }
  return false;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node diagnose-geojson.js <path-to-geojson-file>');
    console.log('Example: node diagnose-geojson.js public/rooms-level-1-WGS.geojson');
    process.exit(1);
  }

  args.forEach(filePath => {
    try {
      diagnoseGeoJSON(filePath);
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error.message);
    }
  });
}

module.exports = { diagnoseGeoJSON };
