/**
 * Compare GeoJSON Structure - Diagnose topology differences
 *
 * This script compares the polygon structure between:
 * - rooms-all-WGS.geojson (works correctly)
 * - individual floor files (render as solid blocks)
 */

const fs = require('fs');
const path = require('path');

function analyzeGeoJSON(filePath) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Analyzing: ${path.basename(filePath)}`);
  console.log('='.repeat(70));

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const stats = {
    totalFeatures: data.features.length,
    polygons: 0,
    multiPolygons: 0,
    polygonsWithHoles: 0,
    maxRings: 0,
    sampleFeatures: []
  };

  data.features.forEach((feature, idx) => {
    if (feature.geometry.type === 'Polygon') {
      stats.polygons++;
      const numRings = feature.geometry.coordinates.length;

      if (numRings > 1) {
        stats.polygonsWithHoles++;
      }

      if (numRings > stats.maxRings) {
        stats.maxRings = numRings;
      }

      // Capture first 3 features as samples
      if (idx < 3) {
        stats.sampleFeatures.push({
          name: feature.properties?.name || feature.properties?.id || 'unnamed',
          type: feature.geometry.type,
          numRings: numRings,
          hasHoles: numRings > 1,
          outerRingPoints: feature.geometry.coordinates[0].length,
          floor: feature.properties?.floor ?? feature.properties?.nivel ?? feature.properties?.level ?? 0,
          height: feature.properties?.height ?? 3
        });
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      stats.multiPolygons++;
    }
  });

  console.log('\n📊 Statistics:');
  console.log(`  Total features: ${stats.totalFeatures}`);
  console.log(`  Polygons: ${stats.polygons}`);
  console.log(`  MultiPolygons: ${stats.multiPolygons}`);
  console.log(`  Polygons with holes: ${stats.polygonsWithHoles}`);
  console.log(`  Max rings in any polygon: ${stats.maxRings}`);

  console.log('\n🔍 Sample Features:');
  stats.sampleFeatures.forEach((sample, idx) => {
    console.log(`\n  Feature ${idx + 1}: ${sample.name}`);
    console.log(`    Type: ${sample.type}`);
    console.log(`    Rings: ${sample.numRings} (${sample.hasHoles ? 'HAS HOLES ✅' : 'NO HOLES ❌'})`);
    console.log(`    Outer ring points: ${sample.outerRingPoints}`);
    console.log(`    Floor: ${sample.floor}`);
    console.log(`    Height: ${sample.height}m`);
  });

  console.log(`\n${'='.repeat(70)}\n`);

  return stats;
}

// Main execution
const publicDir = path.join(__dirname, '..', 'public');

console.log('\n🔬 GEOJSON STRUCTURE COMPARISON\n');

// Analyze the working file
const allFloorsStats = analyzeGeoJSON(path.join(publicDir, 'rooms-all-WGS.geojson'));

// Analyze a problematic individual floor file
const level1Stats = analyzeGeoJSON(path.join(publicDir, 'rooms-level-1-WGS.geojson'));

// Compare results
console.log('\n' + '='.repeat(70));
console.log('COMPARISON RESULTS');
console.log('='.repeat(70));

console.log('\n📌 Key Differences:');
console.log(`\nrooms-all-WGS.geojson:`);
console.log(`  Polygons with holes: ${allFloorsStats.polygonsWithHoles} / ${allFloorsStats.polygons} (${Math.round(allFloorsStats.polygonsWithHoles / allFloorsStats.polygons * 100)}%)`);

console.log(`\nrooms-level-1-WGS.geojson:`);
console.log(`  Polygons with holes: ${level1Stats.polygonsWithHoles} / ${level1Stats.polygons} (${Math.round(level1Stats.polygonsWithHoles / level1Stats.polygons * 100)}%)`);

if (allFloorsStats.polygonsWithHoles > 0 && level1Stats.polygonsWithHoles === 0) {
  console.log('\n⚠️  PROBLEM IDENTIFIED:');
  console.log('  rooms-all-WGS.geojson has interior rings (holes) → renders correctly');
  console.log('  rooms-level-1-WGS.geojson has NO interior rings → renders as solid blocks');
  console.log('\n💡 SOLUTION:');
  console.log('  Option 1: Always use rooms-all-WGS.geojson and filter by floor in code');
  console.log('  Option 2: Extract per-floor data from rooms-all-WGS.geojson preserving topology');
} else if (level1Stats.polygonsWithHoles > 0) {
  console.log('\n✅ Both files have interior rings - issue may be elsewhere');
} else {
  console.log('\n⚠️  Neither file has interior rings - may need topology processing');
}

console.log('\n' + '='.repeat(70) + '\n');
