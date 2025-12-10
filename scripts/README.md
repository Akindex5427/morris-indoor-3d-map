# GeoJSON Topology Fix Scripts

This directory contains scripts to diagnose and fix GeoJSON polygon topology issues that prevent proper 3D extrusion in Deck.gl.

## 🚨 The Problem

**Symptom:** Individual floor files render as solid blocks instead of hollow architectural floor plans.

**Root Cause:** GeoJSON polygons lack interior rings (holes) to represent rooms and corridors. The data structure stores each room as a separate polygon instead of as holes within a building outline polygon.

**Solution:** Merge polygons to create proper topology: building outline as outer ring, room boundaries as interior rings.

---

## 📋 Scripts Overview

### 1. `diagnose-geojson.js` - Diagnostic Tool

Analyzes GeoJSON files to identify topology issues.

**Usage:**
```bash
node scripts/diagnose-geojson.js public/rooms-level-1-WGS.geojson
```

**Checks for:**
- Winding order (CCW for outer rings, CW for holes)
- Presence of interior rings (holes)
- Duplicate vertices
- Self-intersecting polygons
- Tiny polygons

**Output:**
```
📊 STATISTICS:
  Total Features: 150
  Polygons: 150
  Polygons with Holes: 0

⚠️  TOPOLOGY ISSUES:
  ❌ NO HOLES DETECTED!
     This is likely WHY your extrusion looks like solid blocks!
```

---

### 2. `fix-topology.js` - Basic Topology Fixer

Fixes basic topology issues: winding order, duplicate vertices.

**Usage:**
```bash
# Batch mode (processes all floor files)
node scripts/fix-topology.js

# Single file mode
node scripts/fix-topology.js public/rooms-level-1-WGS.geojson public/fixed/rooms-level-1-WGS.geojson
```

**What it fixes:**
- ✅ Corrects winding order (CCW outer, CW inner)
- ✅ Removes duplicate consecutive vertices
- ❌ Does NOT merge polygons into holes

---

### 3. `merge-with-holes.js` - Advanced Merger (RECOMMENDED)

**THIS IS THE MAIN SOLUTION!** Merges room polygons as interior rings within building outlines.

**Usage:**
```bash
# Batch mode (processes all floor files)
node scripts/merge-with-holes.js

# Single file mode
node scripts/merge-with-holes.js public/rooms-level-1-WGS.geojson public/merged/rooms-level-1-WGS.geojson
```

**What it does:**
1. Groups features by floor level
2. Sorts polygons by area (largest first)
3. Identifies building outline (largest polygon)
4. Detects rooms contained within the building
5. Merges rooms as interior rings (holes)
6. Fixes winding order for proper rendering

**Output:**
```
Processing Floor 1:
  Input features: 150
  Output features: 1
  Features with holes: 1

✅ SUCCESS!
  Output written to: public/merged/rooms-level-1-WGS.geojson
  Features with holes: 1
```

---

### 4. `validate-geojson.js` - Validation Checklist

Validates GeoJSON files against best practices for 3D extrusion.

**Usage:**
```bash
# Single file
node scripts/validate-geojson.js public/rooms-level-1-WGS.geojson

# Multiple files
node scripts/validate-geojson.js public/rooms-*.geojson
```

**Checks:**
- Valid FeatureCollection structure
- Geometry types
- Winding order
- Interior rings (holes)
- Required properties (floor, height, base_height)
- Coordinate system (WGS84)
- Duplicate vertices
- Self-intersecting polygons

---

## 🔧 Step-by-Step Fix Procedure

### Step 1: Diagnose the Problem

```bash
node scripts/diagnose-geojson.js public/rooms-level-1-WGS.geojson
```

**Expected Output:** If you see "NO HOLES DETECTED", proceed to Step 2.

---

### Step 2: Merge Polygons with Holes

```bash
node scripts/merge-with-holes.js
```

This will:
- Process all 8 floor files (basement + levels 1-7)
- Output fixed files to `public/merged/` directory
- Print statistics for each floor

**Expected Result:**
```
✅ All files processed! Merged files are in: public/merged
```

---

### Step 3: Validate Fixed Files

```bash
node scripts/validate-geojson.js public/merged/rooms-level-1-WGS.geojson
```

**Expected Output:**
```
✅ PASSED CHECKS:
  Valid FeatureCollection structure
  1 polygons have interior rings (holes) - good for 3D extrusion
  All rings have correct winding order
  Valid WGS84 coordinates detected

📋 RECOMMENDATION:
  ✅ File is ready for 3D extrusion!
```

---

### Step 4: Update React App

Edit `src/components/Map3D.js` and change:

```javascript
const USE_FIXED_TOPOLOGY = false;
```

to:

```javascript
const USE_FIXED_TOPOLOGY = true;
```

This tells the app to load files from `public/merged/` instead of `public/`.

---

### Step 5: Test in Browser

1. Restart your dev server: `npm start`
2. Navigate to `http://localhost:3000`
3. Select **Floor Switcher** → Choose **Floor 1**
4. **Expected Result:** You should now see:
   - ✅ Hollow interior spaces (not solid blocks)
   - ✅ Visible room boundaries
   - ✅ Interior walls and corridors
   - ✅ Proper "architectural cutaway" view

---

## 📊 Before & After Comparison

### BEFORE (Original Files):
```
rooms-level-1-WGS.geojson
├── Feature 1: Polygon (room A)
├── Feature 2: Polygon (room B)
├── Feature 3: Polygon (corridor)
├── ... (150 separate polygons)
```

**Result:** Renders as 150 solid blocks stacked on top of each other.

---

### AFTER (Merged Files):
```
merged/rooms-level-1-WGS.geojson
└── Feature 1: Polygon
    ├── Outer ring: Building outline
    ├── Hole 1: Room A
    ├── Hole 2: Room B
    ├── Hole 3: Corridor
    └── ... (149 interior holes)
```

**Result:** Renders as a single building with hollow interior spaces!

---

## 🐛 Troubleshooting

### Problem: "Cannot find module"
**Solution:** Make sure you're running commands from the project root:
```bash
cd /path/to/indoor-map-3d
node scripts/diagnose-geojson.js public/rooms-level-1-WGS.geojson
```

---

### Problem: Scripts run but nothing changes
**Check:**
1. Did you set `USE_FIXED_TOPOLOGY = true` in `Map3D.js`?
2. Are the merged files in `public/merged/`?
3. Did you restart the dev server?

---

### Problem: Polygons still render as solid blocks
**Possible causes:**
1. GeoJSON winding order is incorrect
2. Deck.gl version compatibility
3. Holes are too small to be visible

**Debug steps:**
```bash
# Re-validate the merged file
node scripts/validate-geojson.js public/merged/rooms-level-1-WGS.geojson

# Check if holes exist
grep -o '"hole_count":[0-9]*' public/merged/rooms-level-1-WGS.geojson
```

---

### Problem: "Polygons with holes: 0" after merging
**This means the script couldn't detect containment relationships.**

**Possible reasons:**
- Room polygons are NOT actually inside the building polygon
- Coordinate precision issues
- Overlapping geometries

**Solution:** You may need to use a more sophisticated GIS tool like:
- QGIS with "Polygonize" and "Difference" operations
- PostGIS with `ST_MakeValid` and `ST_Difference`
- Turf.js library for JavaScript-based spatial operations

---

## 🔬 Advanced: Manual Inspection

To manually inspect the GeoJSON structure:

```bash
# Pretty-print first feature
cat public/rooms-level-1-WGS.geojson | jq '.features[0]'

# Count features
cat public/rooms-level-1-WGS.geojson | jq '.features | length'

# Check for holes
cat public/merged/rooms-level-1-WGS.geojson | jq '.features[0].geometry.coordinates | length'
```

**Expected:**
- Original file: `coordinates.length = 1` (no holes)
- Merged file: `coordinates.length > 1` (has holes!)

---

## 📚 Additional Resources

### GeoJSON Polygon Specification
- Outer ring: **Counter-clockwise (CCW)** winding
- Inner rings (holes): **Clockwise (CW)** winding
- Format: `[[[outer]], [[hole1]], [[hole2]]]`

### Deck.gl Extrusion Requirements
- `extruded: true`
- `wireframe: true` (to see edges)
- Proper winding order
- Valid Z coordinates or `getElevation` function

### Useful Tools
- [geojson.io](http://geojson.io) - Visual GeoJSON editor
- [mapshaper.org](https://mapshaper.org) - GeoJSON simplification
- [QGIS](https://qgis.org) - Professional GIS software
- [@turf/turf](https://turfjs.org) - Spatial analysis library

---

## 🎯 Expected Final Result

After running all scripts and updating your app, you should see:

✅ **Single Floor View**
- Building outline with transparent walls
- Hollow interior showing rooms, corridors, stairs
- Crisp wireframe edges defining structure
- Proper elevation/height for each feature

✅ **Multi-Floor View (Dollhouse Mode)**
- Semi-transparent walls (32% opacity)
- All floors vertically separated (5m spacing)
- Interior spaces visible on every level
- Enhanced lighting illuminating interiors
- Strong edge definition for structure

✅ **Architectural Quality**
- Looks like ArcGIS Indoors / BIM viewer
- Clear "sliced building" perspective
- No solid blocks or filled slabs
- Proper 3D depth and shadows

---

## 💡 Pro Tips

1. **Always validate BEFORE and AFTER** merging to see the improvement
2. **Keep original files** in `public/` as backup
3. **Test with ONE floor first** before batch processing
4. **Use browser DevTools** to inspect Deck.gl layers
5. **Check console for WebGL errors** if rendering fails

---

## 🚀 Next Steps

After fixing topology, consider:
1. Adding floor plan overlays (images/PDFs)
2. Implementing pathfinding for navigation
3. Adding real-time occupancy data
4. Integrating with building sensors (IoT)
5. Creating custom 3D models for furniture/equipment

---

## 📝 License

These scripts are part of the indoor-map-3d project.
MIT License - Feel free to modify and distribute.

---

**Happy Mapping! 🗺️**
