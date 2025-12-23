/**
 * Turn-by-Turn Directions Generator
 * Converts route paths into human-readable navigation instructions
 */

// Calculate distance between two coordinates (in meters)
const calculateDistance = (coord1, coord2) => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  // Haversine formula for distance calculation
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Calculate bearing/direction between two points
const calculateBearing = (coord1, coord2) => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360

  return bearing;
};

// Convert bearing to direction text
const bearingToDirection = (bearing) => {
  if (bearing >= 337.5 || bearing < 22.5) return "north";
  if (bearing >= 22.5 && bearing < 67.5) return "northeast";
  if (bearing >= 67.5 && bearing < 112.5) return "east";
  if (bearing >= 112.5 && bearing < 157.5) return "southeast";
  if (bearing >= 157.5 && bearing < 202.5) return "south";
  if (bearing >= 202.5 && bearing < 247.5) return "southwest";
  if (bearing >= 247.5 && bearing < 292.5) return "west";
  if (bearing >= 292.5 && bearing < 337.5) return "northwest";
  return "north";
};

// Calculate turn direction between two bearings
const calculateTurn = (bearing1, bearing2) => {
  let diff = bearing2 - bearing1;

  // Normalize difference to -180 to 180
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  const absDiff = Math.abs(diff);

  if (absDiff < 20) return "straight";
  if (absDiff < 60) return diff > 0 ? "slight right" : "slight left";
  if (absDiff < 120) return diff > 0 ? "right" : "left";
  if (absDiff < 160) return diff > 0 ? "sharp right" : "sharp left";
  return "back";
};

// Format distance for display
const formatDistance = (meters) => {
  if (meters < 1) {
    return `${Math.round(meters * 100)} cm`;
  } else if (meters < 10) {
    return `${meters.toFixed(1)} m`;
  } else if (meters < 100) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(2)} km`;
  }
};

// Check if room name indicates a vertical connector
const isStairwell = (name) => {
  const lower = name.toLowerCase();
  return lower.includes("stair") || lower.includes("escada");
};

const isElevator = (name) => {
  const lower = name.toLowerCase();
  return (
    lower.includes("elevator") ||
    lower.includes("elevador") ||
    lower.includes("lift")
  );
};

const isCorridor = (name) => {
  const lower = name.toLowerCase();
  return (
    lower.includes("corridor") ||
    lower.includes("corredor") ||
    lower.includes("hallway") ||
    lower.includes("hall") ||
    lower.includes("lobby") ||
    lower.includes("passage")
  );
};

// Generate turn-by-turn directions from route path
export const generateDirections = (routePath) => {
  if (!routePath || routePath.length < 2) {
    return [];
  }

  const directions = [];
  let cumulativeDistance = 0;
  let previousBearing = null;
  let segmentDistance = 0;
  let currentInstruction = null;

  // Start instruction
  directions.push({
    id: 0,
    type: "start",
    instruction: `Start at ${routePath[0].name}`,
    floor: routePath[0].floor,
    distance: 0,
    cumulativeDistance: 0,
    location: routePath[0].name,
    coords: routePath[0].coords,
  });

  for (let i = 1; i < routePath.length; i++) {
    const current = routePath[i];
    const previous = routePath[i - 1];
    const next = i < routePath.length - 1 ? routePath[i + 1] : null;

    const distanceToNext = calculateDistance(previous.coords, current.coords);
    segmentDistance += distanceToNext;
    cumulativeDistance += distanceToNext;

    // Check for floor changes
    if (current.floor !== previous.floor) {
      const floorDiff = current.floor - previous.floor;
      const floorChangeType = isStairwell(previous.name)
        ? "stairs"
        : isElevator(previous.name)
        ? "elevator"
        : "stairs/elevator";

      const direction = floorDiff > 0 ? "up" : "down";
      const floorText =
        floorDiff > 0 ? `Floor ${current.floor}` : `Floor ${current.floor}`;

      directions.push({
        id: directions.length,
        type: "floor_change",
        instruction: `Take ${floorChangeType} ${direction} to ${floorText}`,
        floor: previous.floor,
        targetFloor: current.floor,
        distance: segmentDistance,
        cumulativeDistance: cumulativeDistance,
        location: previous.name,
        coords: previous.coords,
        icon: floorChangeType === "elevator" ? "🛗" : "🪜",
      });

      segmentDistance = 0;
      previousBearing = null;
      continue;
    }

    // Calculate bearing for current segment
    const currentBearing = calculateBearing(previous.coords, current.coords);

    // Determine if we need to add a turn instruction
    if (previousBearing !== null) {
      const turn = calculateTurn(previousBearing, currentBearing);

      // Add turn instruction if significant turn
      if (turn !== "straight" && segmentDistance > 3) {
        const direction = bearingToDirection(currentBearing);
        let turnInstruction = "";

        if (turn === "back") {
          turnInstruction = "Turn around";
        } else if (turn.includes("slight")) {
          turnInstruction = `Continue ${turn}`;
        } else {
          turnInstruction = `Turn ${turn}`;
        }

        // Add location context if not in a corridor
        const locationContext = isCorridor(current.name)
          ? ""
          : ` at ${current.name}`;

        directions.push({
          id: directions.length,
          type: "turn",
          instruction: `${turnInstruction}${locationContext}`,
          floor: current.floor,
          distance: segmentDistance,
          cumulativeDistance: cumulativeDistance,
          location: current.name,
          coords: current.coords,
          turn: turn,
          icon: turn.includes("left")
            ? "↰"
            : turn.includes("right")
            ? "↱"
            : "↑",
        });

        segmentDistance = 0;
      }
    }

    // Check if we're entering a significant room (not a corridor)
    if (!isCorridor(current.name) && i < routePath.length - 1) {
      const nextBearing = next
        ? calculateBearing(current.coords, next.coords)
        : null;

      // If this is not the destination and it's a significant location
      if (i < routePath.length - 2 && segmentDistance > 5) {
        directions.push({
          id: directions.length,
          type: "waypoint",
          instruction: `Pass through ${current.name}`,
          floor: current.floor,
          distance: segmentDistance,
          cumulativeDistance: cumulativeDistance,
          location: current.name,
          coords: current.coords,
          icon: "📍",
        });
        segmentDistance = 0;
      }
    }

    previousBearing = currentBearing;
  }

  // Destination instruction
  const lastPoint = routePath[routePath.length - 1];
  directions.push({
    id: directions.length,
    type: "destination",
    instruction: `Arrive at ${lastPoint.name}`,
    floor: lastPoint.floor,
    distance: segmentDistance,
    cumulativeDistance: cumulativeDistance,
    location: lastPoint.name,
    coords: lastPoint.coords,
    icon: "🎯",
  });

  return directions;
};

// Generate speech text from directions
export const generateSpeechText = (directions) => {
  if (!directions || directions.length === 0) return "";

  const texts = directions.map((dir) => {
    let text = dir.instruction;

    // Add distance information for all but start and destination
    if (
      dir.type !== "start" &&
      dir.type !== "destination" &&
      dir.distance > 1
    ) {
      text += `, in ${formatDistance(dir.distance)}`;
    }

    return text;
  });

  return texts.join(". ") + ".";
};

// Generate speech for a single direction step
export const generateStepSpeech = (direction) => {
  if (!direction) return "";

  let text = direction.instruction;

  if (direction.distance && direction.distance > 1) {
    text += `. Distance: ${formatDistance(direction.distance)}`;
  }

  if (direction.targetFloor !== undefined) {
    text += `. Moving from Floor ${direction.floor} to Floor ${direction.targetFloor}`;
  }

  return text;
};

// Calculate total route statistics
export const calculateRouteStats = (routePath) => {
  if (!routePath || routePath.length < 2) {
    return {
      totalDistance: 0,
      estimatedTime: 0,
      floors: [],
      floorChanges: 0,
    };
  }

  let totalDistance = 0;
  const floorsSet = new Set();
  let floorChanges = 0;

  for (let i = 1; i < routePath.length; i++) {
    const current = routePath[i];
    const previous = routePath[i - 1];

    totalDistance += calculateDistance(previous.coords, current.coords);
    floorsSet.add(current.floor);

    if (current.floor !== previous.floor) {
      floorChanges++;
    }
  }

  // Add first floor
  floorsSet.add(routePath[0].floor);

  // Estimate walking time (average walking speed: 1.4 m/s)
  // Add 30 seconds for each floor change
  const estimatedTime = totalDistance / 1.4 + floorChanges * 30;

  return {
    totalDistance,
    estimatedTime,
    floors: Array.from(floorsSet).sort((a, b) => a - b),
    floorChanges,
  };
};
