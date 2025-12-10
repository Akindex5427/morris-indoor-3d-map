/**
 * EXAMPLE USAGE - IndoorBuilding Component
 *
 * This file shows how to integrate the IndoorBuilding component into your React app.
 * Copy the relevant sections into your App.js or create a dedicated page component.
 */

import React, { useState } from 'react';
import IndoorBuilding from './components/IndoorBuilding';
import './App.css';

// ============================================================================
// EXAMPLE 1: BASIC USAGE - All Floors
// ============================================================================

export function Example1_AllFloors() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <IndoorBuilding
        dataUrl="/rooms-all-WGS.geojson"
        selectedFloors={[0, 1, 2, 3, 4, 5, 6, 7]}
        translucency={0.6}
        heightExaggeration={1.0}
        floorSpacing={3.0}
      />
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: SINGLE FLOOR VIEW
// ============================================================================

export function Example2_SingleFloor() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <IndoorBuilding
        dataUrl="/rooms-all-WGS.geojson"
        selectedFloors={[1]} // Show only Floor 1
        translucency={0.9}
        heightExaggeration={1.0}
        floorSpacing={3.0}
      />
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: WITH INTERACTIVE CONTROLS
// ============================================================================

export function Example3_WithControls() {
  const [selectedFloors, setSelectedFloors] = useState([1, 2, 3]);
  const [translucency, setTranslucency] = useState(60); // 0-100
  const [heightExaggeration, setHeightExaggeration] = useState(1.0);
  const [floorSpacing, setFloorSpacing] = useState(3.0);

  const toggleFloor = (floor) => {
    if (selectedFloors.includes(floor)) {
      setSelectedFloors(selectedFloors.filter((f) => f !== floor));
    } else {
      setSelectedFloors([...selectedFloors, floor].sort());
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {/* Control Panel */}
      <div
        style={{
          width: '300px',
          background: '#2a2a2a',
          color: '#ffffff',
          padding: '20px',
          overflowY: 'auto',
        }}
      >
        <h2>Floor Controls</h2>

        {/* Floor Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Select Floors</h3>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((floor) => (
            <label
              key={floor}
              style={{
                display: 'block',
                marginBottom: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selectedFloors.includes(floor)}
                onChange={() => toggleFloor(floor)}
              />
              <span style={{ marginLeft: '8px' }}>
                Floor {floor === 0 ? 'B' : floor}
              </span>
            </label>
          ))}
        </div>

        {/* Translucency Slider */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Translucency: {translucency}%</h3>
          <input
            type="range"
            min="0"
            max="100"
            value={translucency}
            onChange={(e) => setTranslucency(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            0% = Transparent, 100% = Opaque
          </div>
        </div>

        {/* Height Exaggeration */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Height Exaggeration: {heightExaggeration.toFixed(1)}x</h3>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={heightExaggeration}
            onChange={(e) => setHeightExaggeration(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Floor Spacing */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Floor Spacing: {floorSpacing.toFixed(1)}m</h3>
          <input
            type="range"
            min="1"
            max="6"
            step="0.5"
            value={floorSpacing}
            onChange={(e) => setFloorSpacing(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Quick Presets */}
        <div>
          <h3>Presets</h3>
          <button
            onClick={() => {
              setSelectedFloors([0, 1, 2, 3, 4, 5, 6, 7]);
              setTranslucency(60);
              setFloorSpacing(3.0);
            }}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              cursor: 'pointer',
            }}
          >
            All Floors (Dollhouse)
          </button>
          <button
            onClick={() => {
              setSelectedFloors([1]);
              setTranslucency(90);
              setFloorSpacing(3.0);
            }}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              cursor: 'pointer',
            }}
          >
            Single Floor
          </button>
          <button
            onClick={() => {
              setSelectedFloors([1, 2, 3]);
              setTranslucency(50);
              setFloorSpacing(4.0);
            }}
            style={{
              width: '100%',
              padding: '10px',
              cursor: 'pointer',
            }}
          >
            Lower Floors
          </button>
        </div>
      </div>

      {/* 3D View */}
      <div style={{ flex: 1, position: 'relative' }}>
        <IndoorBuilding
          dataUrl="/rooms-all-WGS.geojson"
          selectedFloors={selectedFloors}
          translucency={translucency / 100} // Convert to 0-1
          heightExaggeration={heightExaggeration}
          floorSpacing={floorSpacing}
          onRoomClick={(room) => {
            console.log('Room clicked:', room);
            alert(`Room: ${room.name || 'Unnamed'}\nFloor: ${room.level}`);
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: WITH ROOM HIGHLIGHTING
// ============================================================================

export function Example4_WithHighlight() {
  const [highlightedRoom, setHighlightedRoom] = useState(null);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <IndoorBuilding
        dataUrl="/rooms-all-WGS.geojson"
        selectedFloors={[1, 2, 3]}
        translucency={0.6}
        heightExaggeration={1.0}
        floorSpacing={3.0}
        highlightedRoomId={highlightedRoom}
        onRoomClick={(room) => {
          const roomId = room.id || room.name;
          setHighlightedRoom(roomId);
        }}
      />

      {/* Room Info Overlay */}
      {highlightedRoom && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            minWidth: '200px',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0' }}>Selected Room</h3>
          <p style={{ margin: '5px 0' }}>
            <strong>ID:</strong> {highlightedRoom}
          </p>
          <button
            onClick={() => setHighlightedRoom(null)}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: CUSTOM INITIAL VIEW
// ============================================================================

export function Example5_CustomView() {
  const customViewState = {
    longitude: -122.45, // Replace with your building's coordinates
    latitude: 37.78,
    zoom: 18,
    pitch: 60,
    bearing: 30,
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <IndoorBuilding
        dataUrl="/rooms-all-WGS.geojson"
        selectedFloors={[0, 1, 2, 3, 4, 5, 6, 7]}
        translucency={0.6}
        heightExaggeration={1.2}
        floorSpacing={3.5}
        initialViewState={customViewState}
      />
    </div>
  );
}

// ============================================================================
// DEFAULT EXPORT - Choose your preferred example
// ============================================================================

export default Example3_WithControls;
