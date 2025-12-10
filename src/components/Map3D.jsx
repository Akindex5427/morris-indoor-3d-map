import React, { useState, useEffect, useRef, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/mapbox";
import { PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { useIndoorBuilding } from "./IndoorBuilding";
import "mapbox-gl/dist/mapbox-gl.css";

// Mapbox API token - Get yours free at https://account.mapbox.com/access-tokens/
const MAPBOX_ACCESS_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN || "YOUR_MAPBOX_TOKEN_HERE";

// Available basemap styles
export const BASEMAP_STYLES = {
  satellite: {
    url: "mapbox://styles/mapbox/satellite-streets-v12",
    name: "Satellite",
    description: "Satellite imagery with street labels",
  },
  topographic: {
    url: "mapbox://styles/mapbox/outdoors-v12",
    name: "Topographic",
    description: "Topographic map with terrain",
  },
  streets: {
    url: "mapbox://styles/mapbox/streets-v12",
    name: "Streets",
    description: "OpenStreetMap-style streets",
  },
};

// Floor base elevation mapping (in meters) - must match IndoorBuilding.js
const FLOOR_BASE_ELEVATIONS = {
  0: 4.5, // Basement
  1: 13.5, // Level 1
  2: 22.5, // Level 2
  3: 31.5, // Level 3
  4: 40.5, // Level 4
  5: 49.5, // Level 5
  6: 58.5, // Level 6
  7: 67.5, // Level 7
};

// Marker elevation offset (in meters) - to ensure markers appear above floor surface
const MARKER_ELEVATION_OFFSET = 2.0; // Raise markers 2m above floor

// Helper function to get elevation for a coordinate at a specific floor
const getFloorElevation = (floor) => {
  return FLOOR_BASE_ELEVATIONS[floor] ?? floor * 9; // Default to 9m per floor
};

const Map3D = ({
  selectedFloor,
  selectedFloors,
  lightingEnabled = true,
  translucency = 60,
  heightExaggeration = 1,
  onRoomSelect,
  filteredRooms,
  highlightedRoomId,
  colorScheme,
  viewState: externalViewState,
  onViewStateChange,
  routePath = null,
  roomsData = [],
  basemapStyle = "satellite", // default to satellite view
}) => {
  const [geojsonData, setGeojsonData] = useState(null);
  const [initialViewState, setInitialViewState] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 17,
    pitch: 45,
    bearing: 0,
  });
  const [internalViewState, setInternalViewState] = useState(initialViewState);
  const deckRef = useRef(null);

  // Convert roomsData to GeoJSON format and update geojsonData
  useEffect(() => {
    if (roomsData && roomsData.length > 0) {
      const data = {
        type: "FeatureCollection",
        features: roomsData,
      };
      setGeojsonData(data);

      // Calculate initial view based on data bounds (only on first load with 0,0)
      if (initialViewState.longitude === 0 && initialViewState.latitude === 0) {
        const coords = roomsData.flatMap((f) => {
          if (f.geometry && f.geometry.type === "LineString") {
            return f.geometry.coordinates || [];
          } else if (f.geometry && f.geometry.type === "Polygon") {
            return f.geometry.coordinates[0] || [];
          } else if (f.geometry && f.geometry.type === "MultiPolygon") {
            return f.geometry.coordinates.flatMap((p) => p[0] || []);
          }
          return [];
        });

        if (coords.length > 0) {
          const lngs = coords.map((c) => c[0]);
          const lats = coords.map((c) => c[1]);
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

          const newViewState = {
            longitude: centerLng,
            latitude: centerLat,
            zoom: 17,
            pitch: 45,
            bearing: 0,
          };
          setInitialViewState(newViewState);
          setInternalViewState(newViewState);
        }
      }
    }
  }, [roomsData, initialViewState.longitude, initialViewState.latitude]);

  // Build the feature collection to display based on selection/filter state
  const getDisplayData = () => {
    if (!geojsonData || !geojsonData.features) {
      return { type: "FeatureCollection", features: [] };
    }

    let features = geojsonData.features;

    // Multi-floor selection: show selected floors and one floor above/below for context
    if (selectedFloors && selectedFloors.length > 0) {
      const maxFloor = Math.max(...selectedFloors);
      const minFloor = Math.min(...selectedFloors);
      features = features.filter((feature) => {
        const floor =
          feature.properties?.floor ||
          feature.properties?.nivel ||
          feature.properties?.level ||
          0;
        return floor >= minFloor - 1 && floor <= maxFloor + 1;
      });
    }
    // Single floor selection: show selected floor and minimal context
    else if (
      selectedFloor !== undefined &&
      selectedFloor !== null &&
      selectedFloor !== "all"
    ) {
      features = features.filter((feature) => {
        const floor =
          feature.properties?.floor ||
          feature.properties?.nivel ||
          feature.properties?.level ||
          0;
        return floor === selectedFloor;
      });
    }
    // 'all' selection leaves features intact (shows everything)

    // Apply room filtering if active
    if (filteredRooms && filteredRooms.length > 0) {
      features = features.filter((feature) => {
        const roomId = feature.properties?.id || feature.properties?.name || "";
        return filteredRooms.includes(roomId);
      });
    }

    return {
      type: "FeatureCollection",
      features: features,
    };
  };

  // Extract all unique floors from roomsData for F-ALL mode
  const allAvailableFloors = useMemo(() => {
    if (!geojsonData || !geojsonData.features) return [];
    const floors = [
      ...new Set(
        geojsonData.features.map(
          (f) =>
            f.properties?.floor ||
            f.properties?.nivel ||
            f.properties?.level ||
            0
        )
      ),
    ].sort((a, b) => a - b);
    return floors;
  }, [geojsonData]);

  // Determine which floors to pass to the IndoorBuilding hook
  const floorsToDisplay = useMemo(() => {
    // If specific floors are selected via FilterPanel
    if (selectedFloors && selectedFloors.length > 0) {
      return selectedFloors;
    }
    // If F-ALL is selected, pass all available floors to enable dollhouse mode
    if (selectedFloor === "all") {
      return allAvailableFloors;
    }
    // If a single floor is selected
    if (selectedFloor !== undefined && selectedFloor !== null) {
      return [selectedFloor];
    }
    // Default: empty array
    return [];
  }, [selectedFloors, selectedFloor, allAvailableFloors]);

  // Use the new IndoorBuilding hook for ArcGIS Indoors-style visualization
  const { layers: indoorLayers, lightingEffect } = useIndoorBuilding({
    data: getDisplayData(),
    selectedFloors: floorsToDisplay,
    translucency: translucency / 100, // Convert from 0-100 to 0-1
    heightExaggeration,
    floorSpacing: 4.5, // 4.5m vertical spacing between floors (matches provided stack)
    highlightedRoomId,
    onRoomClick: (roomProps) => {
      const roomId = roomProps?.id || roomProps?.name || "";
      onRoomSelect(roomProps, roomId);
    },
  });

  const layers = [...indoorLayers];

  // Add route visualization layers if route exists
  if (routePath && routePath.length > 1) {
    console.log("[Map3D] Rendering route with", routePath.length, "waypoints");

    // Create path coordinates with proper z-elevation based on floor
    const pathCoords = routePath.map((point) => {
      const elevation = getFloorElevation(point.floor);
      return [...point.coords, elevation]; // Add z-coordinate [lon, lat, elevation]
    });

    console.log("[Map3D] Route path coordinates:", pathCoords);

    // Route path layer
    layers.push(
      new PathLayer({
        id: "route-path",
        data: [{ path: pathCoords }],
        getPath: (d) => d.path,
        getColor: [255, 100, 50, 255], // Orange/red color for route
        getWidth: 3,
        widthMinPixels: 3,
        widthMaxPixels: 8,
        widthScale: 1,
        rounded: true,
        billboard: false,
        pickable: false,
      })
    );

    // Start and end point markers with proper elevation + offset to appear above floor
    const markerData = [
      {
        position: [
          ...routePath[0].coords,
          getFloorElevation(routePath[0].floor) + MARKER_ELEVATION_OFFSET,
        ],
        type: "start",
      },
      {
        position: [
          ...routePath[routePath.length - 1].coords,
          getFloorElevation(routePath[routePath.length - 1].floor) +
            MARKER_ELEVATION_OFFSET,
        ],
        type: "end",
      },
    ];

    console.log("[Map3D] Marker data:", markerData);

    layers.push(
      new ScatterplotLayer({
        id: "route-markers",
        data: markerData,
        getPosition: (d) => {
          console.log(
            "[Map3D] Getting position for marker:",
            d.type,
            "at",
            d.position
          );
          return d.position;
        },
        getFillColor: (d) =>
          d.type === "start" ? [50, 200, 50, 255] : [255, 50, 50, 255],
        getRadius: 30, // Large radius for visibility
        radiusMinPixels: 15, // Always visible even when zoomed out
        radiusMaxPixels: 60, // Scale up when zoomed in
        pickable: true,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 4, // Thick white border
        getLineColor: [255, 255, 255, 255],
      })
    );

    // Add text labels for markers (slightly above the marker spheres)
    layers.push(
      new TextLayer({
        id: "route-marker-labels",
        data: markerData,
        getPosition: (d) => [d.position[0], d.position[1], d.position[2] + 1], // 1m above marker
        getText: (d) => (d.type === "start" ? "START" : "END"),
        getSize: 18,
        sizeMinPixels: 12,
        getColor: [255, 255, 255, 255],
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        billboard: true, // Always face camera
        background: true,
        getBackgroundColor: [0, 0, 0, 180],
        backgroundPadding: [4, 2],
      })
    );

    // Waypoint markers along the route with proper elevation
    if (routePath.length > 2) {
      layers.push(
        new ScatterplotLayer({
          id: "route-waypoints",
          data: routePath.slice(1, -1),
          getPosition: (d) => [...d.coords, getFloorElevation(d.floor)],
          getFillColor: [255, 200, 50, 200],
          getRadius: 2,
          radiusMinPixels: 2,
          radiusMaxPixels: 8,
          pickable: false,
        })
      );
    }
  }

  // Don't render until we have data to avoid WebGL initialization issues
  if (
    !geojsonData ||
    !geojsonData.features ||
    geojsonData.features.length === 0
  ) {
    return (
      <div
        className="map-3d-container"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#ffffff",
        }}
      >
        Loading map data...
      </div>
    );
  }

  return (
    <div
      className="map-3d-container"
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <DeckGL
        ref={deckRef}
        initialViewState={internalViewState}
        viewState={externalViewState}
        onViewStateChange={({ viewState: newViewState }) => {
          setInternalViewState(newViewState);
          if (onViewStateChange) {
            onViewStateChange(newViewState);
          }
        }}
        controller={{
          dragPan: true,
          dragRotate: true,
          scrollZoom: true,
          touchZoom: true,
          touchRotate: true,
          doubleClickZoom: true,
          keyboard: true,
          inertia: true,
          minZoom: 14,
          maxZoom: 22,
          minPitch: 0,
          maxPitch: 85,
        }}
        layers={layers}
        effects={lightingEnabled ? [lightingEffect] : []}
        getCursor={() => "grab"}
        getTooltip={null}
        style={{ width: "100%", height: "100%" }}
        onWebGLInitialized={(gl) => {
          if (!gl) {
            console.error("WebGL initialization failed");
          }
        }}
      >
        {MAPBOX_ACCESS_TOKEN &&
          MAPBOX_ACCESS_TOKEN !== "YOUR_MAPBOX_TOKEN_HERE" && (
            <Map
              mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
              mapStyle={
                BASEMAP_STYLES[basemapStyle]?.url ||
                BASEMAP_STYLES.satellite.url
              }
              dragPan={false}
              dragRotate={false}
              scrollZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              touchRotate={false}
              keyboard={false}
            />
          )}
      </DeckGL>
    </div>
  );
};

export default Map3D;
