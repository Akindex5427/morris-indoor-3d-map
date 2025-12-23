# Turn-by-Turn Navigation with Voice Guidance

## Overview

Version 1.0.7 introduces comprehensive turn-by-turn navigation with voice guidance, transforming the 3D Indoor Map into a fully-featured wayfinding solution. This feature breaks down complex routes into simple, actionable steps with audio support.

## Features

### 📍 Step-by-Step Directions

- Automatic generation of turn-by-turn instructions from route paths
- Clear, concise directions like "Walk 50ft, turn left"
- Floor change instructions: "Take stairs up to Floor 3"
- Visual progress indicator showing completion percentage

### 🔊 Voice Guidance

- Text-to-speech integration using Web Speech API
- Adjustable speech rate (0.5x - 2.0x speed)
- Individual step narration or full route overview
- Auto-play mode for hands-free navigation

### 🎯 Interactive Navigation

- Click any step to jump to that location on the map
- Previous/Next step navigation
- Real-time progress tracking
- Highlighted current step with visual indicators

### 📊 Route Statistics

- Total distance calculation in meters/kilometers
- Estimated walking time (based on 1.4 m/s average speed)
- List of floors traversed
- Number of floor changes

### 🎨 Visual Design

- Modern, gradient-styled UI
- Collapsible panel for space efficiency
- Color-coded step types:
  - 🟢 Start (Green)
  - 🔴 Destination (Red)
  - 🟠 Floor Changes (Orange)
  - 🔵 Turns (Blue)
  - 🟣 Waypoints (Purple)

## How to Use

### 1. Planning a Route

1. Click the **"Plan Route"** button in the left panel
2. Select your starting location
3. Select your destination
4. Click **"Find Route"**

### 2. Viewing Directions

Once a route is calculated:

- The **DirectionsPanel** appears automatically on the right side
- View the route summary (distance, time, floors)
- See all steps in a scrollable list

### 3. Navigating Steps

- Click **Next** or **Previous** buttons to move between steps
- Click any step in the list to jump to it
- The map automatically centers on the current step

### 4. Using Voice Guidance

1. Enable **"🔊 Voice Guidance"** checkbox
2. Options:
   - **🔊 Step**: Speak current step only
   - **🔊 All**: Speak entire route
   - **⏹️ Stop**: Stop current narration
3. Enable **"▶️ Auto-play steps"** for automatic progression
4. Adjust **Speech Speed** slider (0.5x - 2.0x)

### 5. Following Your Route

- Each step shows:
  - Instruction text
  - Distance to next step
  - Current floor
  - Step icon
- Progress bar shows overall completion
- Current step is highlighted in purple

## Technical Implementation

### Components Added

#### DirectionsPanel.jsx

Main component for displaying turn-by-turn directions:

- State management for current step, voice settings
- Speech synthesis integration
- Interactive step navigation
- Responsive design with collapse functionality

#### directionsGenerator.js

Utility functions for converting routes to directions:

- `generateDirections()`: Creates step-by-step instructions
- `calculateBearing()`: Determines direction of travel
- `calculateTurn()`: Identifies turn types (left, right, sharp, etc.)
- `calculateRouteStats()`: Computes distance, time, floors
- `generateSpeechText()`: Converts directions to speech
- `formatDistance()`: Human-readable distance formatting

### Direction Types

1. **Start**: Beginning of route
2. **Destination**: End of route
3. **Turn**: Direction changes (left, right, slight, sharp, back)
4. **Floor Change**: Stairs or elevator transitions
5. **Waypoint**: Passing through significant locations

### Turn Detection Algorithm

The system calculates bearings between consecutive waypoints and determines turn angles:

- **Straight**: < 20° deviation
- **Slight Turn**: 20° - 60°
- **Turn**: 60° - 120°
- **Sharp Turn**: 120° - 160°
- **Turn Back**: > 160°

### Distance Calculations

Uses the Haversine formula for accurate distance between GPS coordinates:

```javascript
const R = 6371000; // Earth's radius in meters
// ... Haversine calculation
return distance in meters;
```

### Speech Synthesis

Leverages the Web Speech API:

```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = speechRate;
window.speechSynthesis.speak(utterance);
```

## Browser Compatibility

### Voice Guidance Support

- ✅ Chrome/Edge: Full support
- ✅ Safari: Full support
- ✅ Firefox: Full support
- ⚠️ Older browsers: Gracefully degrades (no voice, directions still work)

### Detection

The app automatically detects speech support:

```javascript
const isSpeechSupported = "speechSynthesis" in window;
```

## Keyboard Shortcuts

- **Esc**: Close directions panel
- **Arrow Keys**: Navigate between steps (when panel is focused)
- **Space**: Play/Pause voice (when panel is focused)

## Accessibility Features

### Visual

- High contrast text on colored backgrounds
- Large, clear fonts
- Icon indicators for each step type
- Progress bar for visual feedback

### Audio

- Screen reader compatible
- Voice guidance for visually impaired users
- Adjustable speech rate
- Clear, descriptive instructions

### Motor

- Large clickable targets
- Keyboard navigation support
- Collapsible panel for space management

## Performance Optimizations

### Efficient Updates

- Uses React `useMemo` for expensive calculations
- Directions only regenerate when route changes
- Stats calculated once and cached

### Memory Management

- Automatic cleanup of speech synthesis on unmount
- Cancels ongoing speech when switching steps

### Responsive Design

- Adapts to screen size
- Collapsible panel for mobile devices
- Scrollable step list

## Future Enhancements

### Planned Features

1. **Real-time Location Tracking**

   - GPS/beacon integration
   - "You are here" indicator
   - Automatic rerouting if off-path

2. **Alternative Routes**

   - Shortest distance
   - Accessible (elevator-only)
   - Avoid stairs option

3. **Landmarks & Photos**

   - Visual cues at key decision points
   - "Turn left at the water fountain"

4. **Multi-language Support**

   - Translated directions
   - Different voice options

5. **Offline Support**

   - Cache directions for offline use
   - No internet required for navigation

6. **AR Wayfinding**
   - Camera overlay with directional arrows
   - Distance countdown

## Troubleshooting

### Voice Not Working

1. Check browser compatibility
2. Ensure site is not muted
3. Check browser permissions for audio
4. Try reloading the page

### Directions Not Appearing

1. Ensure route was successfully calculated
2. Check that start and end points are different
3. Verify rooms are connected in the graph

### Map Not Following Steps

1. Ensure JavaScript is enabled
2. Check console for errors
3. Try refreshing the page

## Code Examples

### Generating Directions

```javascript
import { generateDirections } from "./utils/directionsGenerator";

const directions = generateDirections(routePath);
// Returns array of direction objects
```

### Speaking a Direction

```javascript
import { generateStepSpeech } from "./utils/directionsGenerator";

const text = generateStepSpeech(direction);
speak(text);
```

### Calculating Route Stats

```javascript
import { calculateRouteStats } from "./utils/directionsGenerator";

const stats = calculateRouteStats(routePath);
console.log(stats.totalDistance); // meters
console.log(stats.estimatedTime); // seconds
console.log(stats.floors); // [1, 2, 3]
```

## API Reference

### DirectionsPanel Props

| Prop          | Type     | Required | Description                         |
| ------------- | -------- | -------- | ----------------------------------- |
| `routePath`   | Array    | Yes      | Array of waypoints from pathfinding |
| `routeInfo`   | Object   | No       | Summary info (start, end, distance) |
| `onClose`     | Function | Yes      | Callback when panel is closed       |
| `onStepClick` | Function | No       | Callback when a step is clicked     |

### Direction Object Structure

```javascript
{
  id: number,              // Unique identifier
  type: string,            // 'start', 'turn', 'floor_change', etc.
  instruction: string,     // Human-readable instruction
  floor: number,           // Current floor
  targetFloor?: number,    // Target floor (for floor changes)
  distance: number,        // Distance to next step (meters)
  cumulativeDistance: number, // Total distance from start
  location: string,        // Room/area name
  coords: [lon, lat],      // GPS coordinates
  turn?: string,           // Turn type ('left', 'right', etc.)
  icon: string             // Emoji icon for display
}
```

## Testing

### Manual Testing Checklist

- [ ] Route calculation works
- [ ] Directions panel appears
- [ ] All steps display correctly
- [ ] Next/Previous navigation works
- [ ] Clicking steps updates map
- [ ] Voice guidance works
- [ ] Auto-play functions properly
- [ ] Speech rate adjustment works
- [ ] Panel collapses/expands
- [ ] Close button works
- [ ] Dark mode compatibility

### Test Scenarios

1. **Single Floor Route**: Two rooms on same floor
2. **Multi-Floor Route**: Across multiple floors with stairs
3. **Complex Route**: Multiple turns and waypoints
4. **Short Route**: Adjacent rooms
5. **Long Route**: Opposite ends of building

## Contributing

To extend or modify the turn-by-turn navigation:

1. **Adding New Direction Types**

   - Edit `directionsGenerator.js`
   - Add new type detection logic
   - Update icon mapping in `DirectionsPanel.jsx`

2. **Customizing Speech**

   - Modify `generateStepSpeech()` function
   - Adjust speech rate defaults
   - Add new voice options

3. **Styling Changes**
   - Edit `DirectionsPanel.css`
   - Update color schemes
   - Modify layout structure

## Version History

### v1.0.7 (Current)

- ✅ Initial turn-by-turn navigation
- ✅ Voice guidance integration
- ✅ Interactive step navigation
- ✅ Route statistics
- ✅ Auto-play mode

---

**Last Updated**: December 23, 2025  
**Author**: Morris Indoor Map Team  
**License**: MIT
