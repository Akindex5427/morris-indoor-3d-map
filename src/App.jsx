import React, { useState, useEffect } from "react";
import { FlyToInterpolator } from "@deck.gl/core";
import "./App.css";
import Map3D from "./components/Map3D";
import FloorSwitcher from "./components/FloorSwitcher";
import SearchBar from "./components/SearchBar";
import RoomInfoPopup from "./components/RoomInfoPopup";
import FilterPanel from "./components/FilterPanel";
import NavigationControls from "./components/NavigationControls";
import VisualControls from "./components/VisualControls";
import Legend from "./components/Legend";
import RoutePlanner from "./components/RoutePlanner";
import LoadingSpinner from "./components/LoadingSpinner";
import HelpOverlay from "./components/HelpOverlay";
import { findRoute, calculateRouteDistance } from "./utils/pathfinding";

function App() {
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [allRooms, setAllRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [selectedFloors, setSelectedFloors] = useState([]);
  const [highlightedRoomId, setHighlightedRoomId] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [availableFloors, setAvailableFloors] = useState([]);
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 17,
    pitch: 45,
    bearing: 0,
  });
  const [lightingEnabled, setLightingEnabled] = useState(true);
  const [translucency, setTranslucency] = useState(60); // default translucency percentage for non-selected floors
  const [heightExaggeration, setHeightExaggeration] = useState(1);
  const [basemapStyle, setBasemapStyle] = useState("satellite"); // satellite, topographic, or streets
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [routePath, setRoutePath] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // Apply dark mode to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.key.toLowerCase()) {
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
          handleFloorChange(parseInt(e.key));
          break;
        case "a":
          handleFloorChange("all");
          break;
        case "r":
          handleViewReset();
          break;
        case "l":
          setLightingEnabled((prev) => !prev);
          break;
        case "d":
          setDarkMode((prev) => !prev);
          break;
        case "f":
          setShowFilterPanel((prev) => !prev);
          break;
        case "p":
          setShowRoutePlanner((prev) => !prev);
          break;
        case "?":
          setShowHelp((prev) => !prev);
          break;
        case "escape":
          setShowHelp(false);
          setShowFilterPanel(false);
          setShowRoutePlanner(false);
          setSelectedRoom(null);
          break;
        case "arrowup":
          setViewState((prev) => ({
            ...prev,
            pitch: Math.min(85, prev.pitch + 5),
          }));
          break;
        case "arrowdown":
          setViewState((prev) => ({
            ...prev,
            pitch: Math.max(0, prev.pitch - 5),
          }));
          break;
        case "arrowleft":
          setViewState((prev) => ({ ...prev, bearing: prev.bearing - 15 }));
          break;
        case "arrowright":
          setViewState((prev) => ({ ...prev, bearing: prev.bearing + 15 }));
          break;
        case "+":
        case "=":
          setViewState((prev) => ({
            ...prev,
            zoom: Math.min(22, prev.zoom + 0.5),
          }));
          break;
        case "-":
        case "_":
          setViewState((prev) => ({
            ...prev,
            zoom: Math.max(14, prev.zoom - 0.5),
          }));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Polygon extrusion sources (primary) and optional line overlays (outlines)
  const FLOOR_POLYGON_MAP = {
    "-1": "/rooms-basement-WGS.geojson",
    0: "/rooms-basement-WGS.geojson",
    1: "/rooms-level-01-WGS.geojson",
    2: "/rooms-level-02-WGS.geojson",
    3: "/rooms-level-03-WGS.geojson",
    4: "/rooms-level-04-WGS.geojson",
    5: "/rooms-level-5-WGS.geojson",
    6: "/rooms-level-6-WGS.geojson",
    7: "/rooms-level-7-WGS.geojson",
    all: "/rooms-all-WGS-v6.geojson",
  };

  // Line overlays are optional - removed since we're using polygons now
  const FLOOR_LINE_MAP = {
    "-1": null,
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    all: null,
  };

  const fetchGeoJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.json();
  };

  // Load GeoJSON data based on selected floor
  useEffect(() => {
    const loadGeojson = async () => {
      try {
        const key = selectedFloor.toString();
        const polygonUrl = FLOOR_POLYGON_MAP[key] || FLOOR_POLYGON_MAP.all;

        // Load polygon data only (no line overlays needed with polygon files)
        const response = await fetch(polygonUrl);
        if (!response.ok) throw new Error(`Failed to load ${polygonUrl}`);
        const data = await response.json();

        const polygons = data.features || [];

        // In F-ALL mode, keep level metadata as-is for stacking
        const features =
          selectedFloor === "all"
            ? polygons
            : polygons.map((feature) => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  level:
                    feature.properties?.level ??
                    feature.properties?.floor ??
                    feature.properties?.nivel ??
                    selectedFloor,
                },
              }));

        // Use polygons directly (no line overlays)
        const combinedFeatures = features;

        if (combinedFeatures.length > 0) {
          setAllRooms(combinedFeatures);

          // Extract unique floors (supporting floor, nivel, and level properties)
          const floors = [
            ...new Set(
              polygons.map(
                (f) =>
                  f.properties?.floor ||
                  f.properties?.nivel ||
                  f.properties?.level ||
                  0
              )
            ),
          ].sort((a, b) => a - b);

          // Safety: if the dataset failed to report floors, default to all levels
          const resolvedFloors =
            floors.length > 0 ? floors : [0, 1, 2, 3, 4, 5, 6, 7];

          setAvailableFloors(resolvedFloors);

          // Calculate initial view bounds
          const coords = polygons.flatMap((f) => {
            if (f.geometry?.type === "Polygon") {
              return f.geometry.coordinates[0];
            } else if (f.geometry?.type === "MultiPolygon") {
              return f.geometry.coordinates.flatMap((p) => p[0]);
            } else if (f.geometry?.type === "LineString") {
              return f.geometry.coordinates;
            }
            return [];
          });

          if (coords.length > 0) {
            const lngs = coords.map((c) => c[0]);
            const lats = coords.map((c) => c[1]);
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

            setViewState((prev) => ({
              ...prev,
              longitude: centerLng,
              latitude: centerLat,
            }));
          }
        }
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    loadGeojson();
  }, [selectedFloor]);

  const handleFloorChange = (floor) => {
    setSelectedFloor(floor);
    setSelectedRoom(null);
    setHighlightedRoomId(null);
  };

  const handleRoomSelect = (roomProperties, roomId) => {
    setSelectedRoom(roomProperties);
    setHighlightedRoomId(roomId);

    // Position popup near click location
    setPopupPosition({
      x: window.innerWidth / 2 - 150,
      y: window.innerHeight / 2 - 150,
    });

    // Smooth camera animation to room (if geometry available)
    const feature = allRooms.find(
      (r) => (r.properties?.id || r.properties?.name) === roomId
    );
    if (feature?.geometry) {
      try {
        const coords =
          feature.geometry.type === "Polygon"
            ? feature.geometry.coordinates[0][0]
            : feature.geometry.type === "MultiPolygon"
            ? feature.geometry.coordinates[0][0][0]
            : null;

        if (coords) {
          setViewState((prev) => ({
            ...prev,
            longitude: coords[0],
            latitude: coords[1],
            zoom: 19.5,
            pitch: 50,
            transitionDuration: 1200,
            transitionInterpolator: new FlyToInterpolator(),
          }));
        }
      } catch (e) {
        console.log("Could not animate to room:", e);
      }
    }
  };

  const handleSearch = (roomIds) => {
    setFilteredRooms(roomIds);
    if (roomIds.length > 0) {
      setHighlightedRoomId(roomIds[0]);
    }
  };

  const handleFilter = (roomIds) => {
    // Support both legacy array payload and new object payload from FilterPanel
    if (Array.isArray(roomIds)) {
      setFilteredRooms(roomIds);
      setSelectedFloors([]);
      return;
    }

    const { roomIds: ids = [], selectedFloors: floors = [] } = roomIds || {};
    setFilteredRooms(ids);
    setSelectedFloors(floors);
  };

  const handleClosePopup = () => {
    setSelectedRoom(null);
    setHighlightedRoomId(null);
  };

  const handleViewReset = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: 17,
      pitch: 45,
      bearing: 0,
    }));
  };

  const handleZoomIn = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: prev.zoom + 1,
    }));
  };

  const handleZoomOut = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: prev.zoom - 1,
    }));
  };

  const handleRotate = (direction) => {
    const rotateAmount = 30;
    const pitchAmount = 15;

    switch (direction) {
      case "left":
        setViewState((prev) => ({
          ...prev,
          bearing: prev.bearing - rotateAmount,
        }));
        break;
      case "right":
        setViewState((prev) => ({
          ...prev,
          bearing: prev.bearing + rotateAmount,
        }));
        break;
      case "up":
        setViewState((prev) => ({
          ...prev,
          pitch: Math.min(prev.pitch + pitchAmount, 85),
        }));
        break;
      case "down":
        setViewState((prev) => ({
          ...prev,
          pitch: Math.max(prev.pitch - pitchAmount, 0),
        }));
        break;
      default:
        break;
    }
  };

  const handleRouteCalculate = (startRoom, endRoom, targetFloor = null) => {
    if (!startRoom || !endRoom) {
      setRoutePath(null);
      setRouteInfo(null);
      return;
    }

    try {
      const path = findRoute(allRooms, startRoom, endRoom, targetFloor);

      if (path) {
        setRoutePath(path);
        const distance = calculateRouteDistance(path);
        setRouteInfo({
          start: startRoom.properties?.name || startRoom.properties?.id,
          end: endRoom.properties?.name || endRoom.properties?.id,
          distance: (distance * 111000).toFixed(1), // Convert to meters (approximate)
          floors: [...new Set(path.map((p) => p.floor))].sort((a, b) => a - b),
          targetFloor: targetFloor,
        });
        setShowRoutePlanner(false);
      } else {
        alert("No route found between these rooms. They may not be connected.");
        setRoutePath(null);
        setRouteInfo(null);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      alert("An error occurred while calculating the route. Please try again.");
      setRoutePath(null);
      setRouteInfo(null);
    }
  };

  // Show loading screen while data is loading
  if (isLoading) {
    return <LoadingSpinner message="Loading 3D building model..." />;
  }

  return (
    <div className="App">
      {/* Help Overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {/* Floating Action Buttons */}
      <button
        className="help-button"
        onClick={() => setShowHelp(true)}
        title="Keyboard Shortcuts (Press ?)"
      >
        ?
      </button>

      <button
        className="dark-mode-toggle"
        onClick={() => setDarkMode((prev) => !prev)}
        title={`Switch to ${darkMode ? "Light" : "Dark"} Mode (Press D)`}
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      <button
        className="reset-view-button"
        onClick={handleViewReset}
        title="Reset View (Press R)"
      >
        🏠
      </button>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <h1> 3D Indoor Map Viewer</h1>
          <p>Interactive 3D building floor navigation and room explorer</p>
        </header>

        {/* Main Content */}
        <div className="main-content">
          {/* Left Panel */}
          <div className="left-panel">
            <div className="panel-section">
              <SearchBar
                rooms={allRooms}
                onSearch={handleSearch}
                onRoomSelect={handleRoomSelect}
              />
            </div>

            <div className="panel-section">
              <FloorSwitcher
                currentFloor={selectedFloor}
                onFloorChange={handleFloorChange}
                availableFloors={availableFloors}
              />
            </div>

            <div className="panel-section">
              <button
                className="btn-filter"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
              >
                Filter Rooms
              </button>
            </div>

            <div className="panel-section">
              <button
                className="btn-filter"
                onClick={() => setShowRoutePlanner(!showRoutePlanner)}
              >
                Plan Route
              </button>
              {routeInfo && (
                <div
                  style={{
                    marginTop: "0.8rem",
                    fontSize: "0.85rem",
                    color: "#666",
                  }}
                >
                  <strong>Active Route:</strong>
                  <div style={{ marginTop: "0.4rem" }}>
                    From: {routeInfo.start}
                    <br />
                    To: {routeInfo.end}
                    <br />
                    Distance: ~{routeInfo.distance}m<br />
                    Floors: {routeInfo.floors.join(", ")}
                  </div>
                  <button
                    className="btn-secondary"
                    style={{
                      marginTop: "0.6rem",
                      width: "100%",
                      padding: "0.5rem",
                    }}
                    onClick={() => {
                      setRoutePath(null);
                      setRouteInfo(null);
                    }}
                  >
                    Clear Route
                  </button>
                </div>
              )}
            </div>

            {showFilterPanel && (
              <FilterPanel
                rooms={allRooms}
                onFilter={handleFilter}
                onClose={() => setShowFilterPanel(false)}
              />
            )}

            <div className="panel-info">
              <p>
                <strong>Current Floor:</strong>{" "}
                {selectedFloor === "all"
                  ? "All Floors"
                  : selectedFloor === -1 || selectedFloor === 0
                  ? "F0 (Basement)"
                  : `F${selectedFloor}`}
              </p>
              <p>
                <strong>Rooms Displayed:</strong>{" "}
                {filteredRooms.length > 0 ? filteredRooms.length : "All"}
              </p>
              <p>
                <strong>Total Rooms:</strong> {allRooms.length}
              </p>
            </div>
          </div>

          {/* Map Container */}
          <div className="map-container">
            <Map3D
              selectedFloor={selectedFloor}
              selectedFloors={selectedFloors}
              onRoomSelect={handleRoomSelect}
              filteredRooms={filteredRooms}
              highlightedRoomId={highlightedRoomId}
              hoveredRoomId={hoveredRoomId}
              onRoomHover={setHoveredRoomId}
              colorScheme="default"
              viewState={viewState}
              onViewStateChange={setViewState}
              lightingEnabled={lightingEnabled}
              translucency={translucency}
              heightExaggeration={heightExaggeration}
              basemapStyle={basemapStyle}
              routePath={routePath}
              roomsData={allRooms}
            />

            {/* Navigation Controls */}
            <NavigationControls
              onViewReset={handleViewReset}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onRotate={handleRotate}
            />

            <VisualControls
              lightingEnabled={lightingEnabled}
              setLightingEnabled={setLightingEnabled}
              translucency={translucency}
              setTranslucency={setTranslucency}
              heightExaggeration={heightExaggeration}
              setHeightExaggeration={setHeightExaggeration}
              basemapStyle={basemapStyle}
              setBasemapStyle={setBasemapStyle}
            />
            <Legend
              selectedFloor={selectedFloor}
              selectedFloors={selectedFloors}
              translucency={translucency}
            />

            {/* Room Info Popup */}
            {selectedRoom && (
              <RoomInfoPopup
                room={selectedRoom}
                onClose={handleClosePopup}
                position={popupPosition}
              />
            )}

            {/* Route Planner */}
            {showRoutePlanner && (
              <RoutePlanner
                rooms={allRooms}
                onRouteCalculate={handleRouteCalculate}
                onClose={() => setShowRoutePlanner(false)}
                selectedFloors={selectedFloors}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <p>Built with React, Deck.gl & GeoJSON WGS84 Coordinate System</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
