/**
 * GeoJSON Validation Checklist
 *
 * Validates GeoJSON files against best practices for 3D extrusion
 * Run: node scripts/validate-geojson.js <path-to-geojson-file>
 */

const fs = require('fs');
const path = require('path');

function validateGeoJSON(filePath) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Validating: ${path.basename(filePath)}`);
  console.log('='.repeat(70)}\n`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const checks = {
    passed: [],
    warnings: [],
    errors: []
  };

  // Check 1: Valid GeoJSON structure
  if (!data.type || data.type !== 'FeatureCollection') {
    checks.errors.push('Not a valid FeatureCollection');
  } else {
    checks.passed.push('Valid FeatureCollection structure');
  }

  // Check 2: Has features
  if (!data.features || data.features.length === 0) {
    checks.errors.push('No features found');
  } else {
    checks.passed.push(`Contains ${data.features.length} features`);
  }

  // Check 3: Geometry types
  const geometryTypes = {};
  data.features.forEach(f => {
    const type = f.geometry.type;
    geometryTypes[type] = (geometryTypes[type] || 0) + 1;
  });

  Object.entries(geometryTypes).forEach(([type, count]) => {
    checks.passed.push(`${type}: ${count} feature(s)`);
  });

  // Check 4: Winding order
  let correctWindingOuter = 0;
  let correctWindingInner = 0;
  let wrongWindingOuter = 0;
  let wrongWindingInner = 0;

  data.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring, idx) => {
        const isOuter = idx === 0;
        const isCCW = !isClockwise(ring);

        if (isOuter) {
          if (isCCW) correctWindingOuter++;
          else wrongWindingOuter++;
        } else {
          if (!isCCW) correctWindingInner++;
          else wrongWindingInner++;
        }
      });
    }
  });

  if (wrongWindingOuter === 0 && wrongWindingInner === 0) {
    checks.passed.push(`All rings have correct winding order`);
  } else {
    if (wrongWindingOuter > 0) {
      checks.errors.push(`${wrongWindingOuter} outer rings are CLOCKWISE (should be counter-clockwise)`);
    }
    if (wrongWindingInner > 0) {
      checks.errors.push(`${wrongWindingInner} inner rings are COUNTER-CLOCKWISE (should be clockwise)`);
    }
  }

  // Check 5: Polygon holes
  let polygonsWithHoles = 0;
  data.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates.length > 1) {
      polygonsWithHoles++;
    }
  });

  if (polygonsWithHoles > 0) {
    checks.passed.push(`${polygonsWithHoles} polygons have interior rings (holes) - good for 3D extrusion`);
  } else if (data.features.length > 20) {
    checks.warnings.push(`No polygons with holes detected - may render as solid blocks`);
    checks.warnings.push(`Consider running: node scripts/merge-with-holes.js`);
  }

  // Check 6: Required properties
  const requiredProps = ['level', 'floor', 'base_height', 'height'];
  const propCounts = {};

  requiredProps.forEach(prop => {
    const count = data.features.filter(f => {
      return f.properties && (
        f.properties[prop] !== undefined ||
        f.properties[prop.replace('_', '')] !== undefined
      );
    }).length;

    propCounts[prop] = count;

    if (count === data.features.length) {
      checks.passed.push(`All features have '${prop}' property`);
    } else if (count === 0) {
      checks.warnings.push(`No features have '${prop}' property`);
    } else {
      checks.warnings.push(`Only ${count}/${data.features.length} features have '${prop}' property`);
    }
  });

  // Check 7: Coordinate system
  const sample = data.features[0]?.geometry?.coordinates?.[0]?.[0];
  if (sample) {
    const [lon, lat, z] = sample;

    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      checks.errors.push(`Invalid coordinates detected: [${lon}, ${lat}]`);
    } else {
      checks.passed.push(`Valid WGS84 coordinates detected`);
    }

    if (z !== undefined) {
      checks.passed.push(`Has Z coordinates (3D)`);
    }
  }

  // Check 8: Duplicate vertices
  let featuresWithDuplicates = 0;
  data.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach(ring => {
        if (hasDuplicateVertices(ring)) {
          featuresWithDuplicates++;
        }
      });
    }
  });

  if (featuresWithDuplicates === 0) {
    checks.passed.push(`No duplicate consecutive vertices`);
  } else {
    checks.warnings.push(`${featuresWithDuplicates} features have duplicate consecutive vertices`);
  }

  // Check 9: Self-intersecting polygons (basic check)
  let selfIntersecting = 0;
  data.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      if (hasSelfIntersection(feature.geometry.coordinates[0])) {
        selfIntersecting++;
      }
    }
  });

  if (selfIntersecting === 0) {
    checks.passed.push(`No obvious self-intersecting polygons`);
  } else {
    checks.errors.push(`${selfIntersecting} polygons may be self-intersecting`);
  }

  // Print results
  console.log(`✅ PASSED CHECKS (${checks.passed.length}):`);
  checks.passed.forEach(msg => console.log(`  ${msg}`));

  if (checks.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${checks.warnings.length}):`);
    checks.warnings.forEach(msg => console.log(`  ${msg}`));
  }

  if (checks.errors.length > 0) {
    console.log(`\n❌ ERRORS (${checks.errors.length}):`);
    checks.errors.forEach(msg => console.log(`  ${msg}`));
  }

  // Final recommendation
  console.log(`\n📋 RECOMMENDATION:`);
  if (checks.errors.length === 0 && checks.warnings.length === 0) {
    console.log(`  ✅ File is ready for 3D extrusion!`);
  } else if (checks.errors.length > 0) {
    console.log(`  ❌ File has critical errors. Run: node scripts/fix-topology.js`);
  } else {
    console.log(`  ⚠️  File may have issues. Consider running: node scripts/merge-with-holes.js`);
  }

  console.log(`\n${'='.repeat(70)}\n`);

  return {
    passed: checks.passed.length,
    warnings: checks.warnings.length,
    errors: checks.errors.length
  };
}

function isClockwise(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

function hasDuplicateVertices(ring) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    if (x1 === x2 && y1 === y2) return true;
  }
  return false;
}

function hasSelfIntersection(ring) {
  // Simplified check - full check requires complex geometry algorithms
  for (let i = 0; i < ring.length - 3; i++) {
    for (let j = i + 2; j < ring.length - 1; j++) {
      if (i === 0 && j === ring.length - 2) continue; // Skip first and last segments (they share a vertex)

      const seg1 = [ring[i], ring[i + 1]];
      const seg2 = [ring[j], ring[j + 1]];

      if (segmentsIntersect(seg1[0], seg1[1], seg2[0], seg2[1])) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(p1, p2, p3, p4) {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const [x4, y4] = p4;

  const det = (x2 - x1) * (y4 - y3) - (x4 - x3) * (y2 - y1);
  if (det === 0) return false; // Parallel

  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / det;
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / det;

  return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node validate-geojson.js <path-to-geojson-file> [<file2> ...]');
    console.log('Example: node validate-geojson.js public/rooms-level-1-WGS.geojson');
    process.exit(1);
  }

  let totalPassed = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  args.forEach(filePath => {
    try {
      const results = validateGeoJSON(filePath);
      totalPassed += results.passed;
      totalWarnings += results.warnings;
      totalErrors += results.errors;
    } catch (error) {
      console.error(`Error validating ${filePath}:`, error.message);
    }
  });

  if (args.length > 1) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`SUMMARY: ${args.length} files validated`);
    console.log(`  ✅ Passed: ${totalPassed}`);
    console.log(`  ⚠️  Warnings: ${totalWarnings}`);
    console.log(`  ❌ Errors: ${totalErrors}`);
    console.log('='.repeat(70) + '\n');
  }
}

module.exports = { validateGeoJSON };
