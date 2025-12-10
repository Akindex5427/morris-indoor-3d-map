/**
 * TestIndoorBuilding.jsx - Simple Test Component
 *
 * This file demonstrates the standalone IndoorBuilding component.
 * Run this to verify your installation works correctly.
 *
 * Usage:
 * 1. Import this in App.js: import TestIndoorBuilding from './TestIndoorBuilding';
 * 2. Replace <App /> with <TestIndoorBuilding />
 * 3. Refresh browser
 */

import React, { useState } from 'react';
import IndoorBuilding from './components/IndoorBuilding';

function TestIndoorBuilding() {
  const [selectedFloors, setSelectedFloors] = useState([1, 2, 3]);
  const [translucency, setTranslucency] = useState(60); // 0-100

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1a1a',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#2a2a2a',
          color: 'white',
          padding: '15px 20px',
          borderBottom: '2px solid #4a4a4a',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px' }}>
          🏢 IndoorBuilding Test - ArcGIS Indoors Style
        </h1>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Control Panel */}
        <div
          style={{
            width: '280px',
            background: '#2a2a2a',
            color: 'white',
            padding: '20px',
            overflowY: 'auto',
            borderRight: '2px solid #4a4a4a',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Controls</h2>

          {/* Floor Selection */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>
              Select Floors
            </h3>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((floor) => (
              <label
                key={floor}
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFloors.includes(floor)}
                  onChange={() => {
                    if (selectedFloors.includes(floor)) {
                      setSelectedFloors(selectedFloors.filter((f) => f !== floor));
                    } else {
                      setSelectedFloors([...selectedFloors, floor].sort());
                    }
                  }}
                  style={{ marginRight: '8px' }}
                />
                <span>Floor {floor === 0 ? 'B (Basement)' : floor}</span>
              </label>
            ))}
          </div>

          {/* Translucency */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>
              Translucency: {translucency}%
            </h3>
            <input
              type="range"
              min="0"
              max="100"
              value={translucency}
              onChange={(e) => setTranslucency(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4a9eff' }}
            />
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px' }}>
              {translucency === 0 && '👻 Fully transparent'}
              {translucency > 0 && translucency < 40 && '🌫️ Very transparent'}
              {translucency >= 40 && translucency < 70 && '✨ Semi-transparent'}
              {translucency >= 70 && translucency < 90 && '🏢 Mostly opaque'}
              {translucency >= 90 && '🧱 Nearly solid'}
            </div>
          </div>

          {/* Presets */}
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>
              Quick Presets
            </h3>
            <button
              onClick={() => {
                setSelectedFloors([0, 1, 2, 3, 4, 5, 6, 7]);
                setTranslucency(60);
              }}
              style={buttonStyle}
            >
              🏢 All Floors
            </button>
            <button
              onClick={() => {
                setSelectedFloors([1]);
                setTranslucency(90);
              }}
              style={buttonStyle}
            >
              🔍 Single Floor
            </button>
            <button
              onClick={() => {
                setSelectedFloors([1, 2, 3]);
                setTranslucency(50);
              }}
              style={buttonStyle}
            >
              📦 Lower Floors
            </button>
            <button
              onClick={() => {
                setSelectedFloors([4, 5, 6, 7]);
                setTranslucency(55);
              }}
              style={buttonStyle}
            >
              🎈 Upper Floors
            </button>
          </div>

          {/* Info */}
          <div
            style={{
              marginTop: '30px',
              padding: '15px',
              background: 'rgba(74, 158, 255, 0.1)',
              border: '1px solid rgba(74, 158, 255, 0.3)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <strong>✅ Component Working!</strong>
            <p style={{ margin: '8px 0 0 0' }}>
              Selected {selectedFloors.length} floor{selectedFloors.length !== 1 && 's'}
              {selectedFloors.length > 1 ? ' (Dollhouse mode)' : ' (Single floor)'}
            </p>
          </div>
        </div>

        {/* 3D View */}
        <div style={{ flex: 1, position: 'relative' }}>
          {selectedFloors.length === 0 ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
              }}
            >
              ⬅️ Select at least one floor to view
            </div>
          ) : (
            <IndoorBuilding
              dataUrl="/rooms-all-WGS.geojson"
              selectedFloors={selectedFloors}
              translucency={translucency / 100}
              heightExaggeration={1.0}
              floorSpacing={3.0}
              onRoomClick={(room) => {
                console.log('🏠 Room clicked:', room);
                alert(
                  `Room: ${room.name || 'Unnamed'}\nFloor: ${room.level || '?'}\nHeight: ${room.height || '?'}m`
                );
              }}
            />
          )}

          {/* Overlay Instructions */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              maxWidth: '300px',
            }}
          >
            <strong>🖱️ Controls:</strong>
            <br />
            • Drag to rotate
            <br />
            • Scroll to zoom
            <br />
            • Right-click drag to pan
            <br />• Click rooms to see details
          </div>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: '8px',
  background: '#4a9eff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  transition: 'background 0.2s',
};

export default TestIndoorBuilding;
