const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/rooms-level-1-WGS.geojson', 'utf8'));
const feature = data.features[0];

const floor = feature.properties.floor ?? feature.properties.nivel ?? feature.properties.level ?? 0;
const height = feature.properties.height || 3;
const baseHeightProp = feature.properties.base_height;

const calculatedBase = floor * 5;
const shouldUseExplicit = (
  baseHeightProp !== undefined &&
  baseHeightProp !== null &&
  (floor === 0 || baseHeightProp > 0)
);
const finalBase = shouldUseExplicit ? baseHeightProp : calculatedBase;
const clampedHeight = Math.min(height, 4.8);
const totalElevation = finalBase + clampedHeight;

console.log('='.repeat(70));
console.log('ELEVATION CALCULATION TEST - Level 1');
console.log('='.repeat(70));
console.log('Feature:', feature.properties.name);
console.log('Floor number:', floor);
console.log('Height property:', height);
console.log('base_height property:', baseHeightProp);
console.log('\nCalculations:');
console.log('  Calculated base (floor * 5):', calculatedBase + 'm');
console.log('  Should use explicit base_height?', shouldUseExplicit);
console.log('  Final base elevation:', finalBase + 'm');
console.log('  Clamped height:', clampedHeight + 'm');
console.log('  ✅ TOTAL ELEVATION:', totalElevation + 'm');
console.log('\nExpected: 9m for Floor 1 (5m base + 4m height)');
console.log('='.repeat(70));
