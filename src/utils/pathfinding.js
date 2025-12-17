// A* Pathfinding algorithm for indoor navigation with room grouping
// Groups multiple features with same name into logical rooms

// Calculate Euclidean distance between two points
const distance = (p1, p2) => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// Get centroid of a room feature
const getCentroid = (room) => {
  let coords = [];

  if (room.geometry.type === "Polygon") {
    coords = room.geometry.coordinates[0];
  } else if (room.geometry.type === "MultiPolygon") {
    coords = room.geometry.coordinates[0][0];
  } else if (room.geometry.type === "LineString") {
    coords = room.geometry.coordinates;
  }

  if (coords.length === 0) return [0, 0];

  const sum = coords.reduce(
    (acc, coord) => {
      acc[0] += coord[0];
      acc[1] += coord[1];
      return acc;
    },
    [0, 0]
  );

  return [sum[0] / coords.length, sum[1] / coords.length];
};

// Get room floor
const getRoomFloor = (room) => {
  return (
    room.properties?.floor ||
    room.properties?.nivel ||
    room.properties?.level ||
    0
  );
};

// Get room name
const getRoomName = (room) => {
  return (
    room.properties?.name ||
    room.properties?.id ||
    room.properties?.room_id ||
    ""
  );
};

// Check if room is a stairwell/elevator/corridor
const isVerticalConnector = (roomName) => {
  const name = roomName.toLowerCase();
  return (
    name.includes("stair") ||
    name.includes("escada") ||
    name.includes("elevador") ||
    name.includes("elevator") ||
    name.includes("corredor") ||
    name.includes("corridor") ||
    name.includes("hallway") ||
    name.includes("lobby")
  );
};

// Check if room is a corridor/hallway (for routing through)
const isCorridor = (roomName) => {
  const name = roomName.toLowerCase();
  return (
    name.includes("hall") ||
    name.includes("corridor") ||
    name.includes("corredor") ||
    name.includes("hallway") ||
    name.includes("lobby") ||
    name.includes("passage") ||
    name.includes("passagem")
  );
};

// Check if a room is navigable (exclude structural elements)
const isNavigableRoom = (roomName) => {
  const name = roomName.toLowerCase();
  // Exclude architectural/structural elements
  if (
    name === "floor" ||
    name === "structure" ||
    name === "void" ||
    name === "exterior"
  ) {
    return false;
  }
  return true;
};

// Group rooms by name and floor to create logical "rooms"
const groupRoomsByName = (features) => {
  const roomGroups = new Map();

  features.forEach((feature) => {
    const name = getRoomName(feature);
    const floor = getRoomFloor(feature);
    const key = `${name}_F${floor}`; // Unique key for each room on each floor

    if (!roomGroups.has(key)) {
      roomGroups.set(key, {
        name,
        floor,
        features: [],
        centroid: null,
      });
    }

    roomGroups.get(key).features.push(feature);
  });

  // Calculate centroid for each room group
  roomGroups.forEach((room) => {
    const centroids = room.features.map((f) => getCentroid(f));
    const avgCentroid = [
      centroids.reduce((sum, c) => sum + c[0], 0) / centroids.length,
      centroids.reduce((sum, c) => sum + c[1], 0) / centroids.length,
    ];
    room.centroid = avgCentroid;
  });

  return roomGroups;
};

// Build adjacency graph with corridor-aware routing
const buildRoomGraph = (roomGroups, targetFloor = null) => {
  const graph = new Map();
  const rooms = Array.from(roomGroups.values());

  // Filter by floor if specified and exclude non-navigable rooms
  let filteredRooms =
    targetFloor !== null ? rooms.filter((r) => r.floor === targetFloor) : rooms;

  const beforeNavFilter = filteredRooms.length;
  // Further filter to only include navigable rooms
  filteredRooms = filteredRooms.filter((r) => isNavigableRoom(r.name));
  const afterNavFilter = filteredRooms.length;

  console.log(
    `[Pathfinding] Graph building: ${beforeNavFilter} rooms before navigable filter, ${afterNavFilter} after`
  );

  // Separate corridors from regular rooms for corridor-aware routing
  const corridors = filteredRooms.filter((r) => isCorridor(r.name));
  const regularRooms = filteredRooms.filter((r) => !isCorridor(r.name));

  console.log(
    `[Pathfinding] Identified ${corridors.length} corridors and ${regularRooms.length} regular rooms`
  );

  // Build adjacency list with corridor preference
  filteredRooms.forEach((room) => {
    const key = `${room.name}_F${room.floor}`;
    const neighbors = [];
    const isRoomCorridor = isCorridor(room.name);

    // Find neighboring rooms
    filteredRooms.forEach((otherRoom) => {
      if (room.name === otherRoom.name && room.floor === otherRoom.floor) {
        return; // Skip same room
      }

      // Rooms on same floor
      if (room.floor === otherRoom.floor) {
        const dist = distance(room.centroid, otherRoom.centroid);
        const isOtherCorridor = isCorridor(otherRoom.name);

        // Different thresholds based on room types
        let threshold;
        let distanceWeight = dist;

        if (isRoomCorridor && isOtherCorridor) {
          // Corridor to corridor - prefer these connections
          threshold = 0.05;
          distanceWeight = dist * 0.8; // Lower cost for corridor-to-corridor
        } else if (isRoomCorridor || isOtherCorridor) {
          // Room to corridor or corridor to room - allow these
          threshold = 0.03; // Closer proximity needed
          distanceWeight = dist * 0.9; // Slight preference
        } else {
          // Room to room - only if very close (might be adjacent rooms)
          threshold = 0.015; // Must be very close
          distanceWeight = dist * 1.2; // Higher cost for direct room-to-room
        }

        if (dist < threshold && dist > 0) {
          neighbors.push({
            key: `${otherRoom.name}_F${otherRoom.floor}`,
            name: otherRoom.name,
            floor: otherRoom.floor,
            distance: distanceWeight,
            isCorridor: isOtherCorridor,
          });
        }
      }
      // Vertical connections (between floors through stairs/elevators)
      else if (Math.abs(room.floor - otherRoom.floor) === 1) {
        // Check if either room is a stairwell/elevator
        if (
          isVerticalConnector(room.name) ||
          isVerticalConnector(otherRoom.name)
        ) {
          const dist = distance(room.centroid, otherRoom.centroid);
          const threshold = 0.02; // Larger threshold for vertical connections

          if (dist < threshold && dist > 0) {
            neighbors.push({
              key: `${otherRoom.name}_F${otherRoom.floor}`,
              name: otherRoom.name,
              floor: otherRoom.floor,
              distance: dist * 2, // Penalty for floor change
              isCorridor: isCorridor(otherRoom.name),
            });
          }
        }
      }
    });

    graph.set(key, {
      room,
      neighbors,
      centroid: room.centroid,
      isCorridor: isRoomCorridor,
    });
  });

  return graph;
};

// A* pathfinding algorithm
const aStar = (graph, startKey, endKey) => {
  if (!graph.has(startKey) || !graph.has(endKey)) {
    console.warn(`Start or end room not in graph`);
    return null;
  }

  const openSet = new Set([startKey]);
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(startKey, 0);

  const startNode = graph.get(startKey);
  const endNode = graph.get(endKey);
  const heuristic = distance(startNode.centroid, endNode.centroid);
  fScore.set(startKey, heuristic);

  console.log(
    `[Pathfinding] A* starting: startKey=${startKey}, endKey=${endKey}, initial_heuristic=${heuristic.toFixed(
      6
    )}`
  );

  let iterations = 0;
  while (openSet.size > 0) {
    iterations++;

    // Find node in openSet with lowest fScore
    let current = null;
    let lowestF = Infinity;

    openSet.forEach((key) => {
      const f = fScore.get(key) || Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = key;
      }
    });

    if (!current) {
      console.warn(
        `[Pathfinding] A* No valid current node found in iteration ${iterations}`
      );
      break;
    }

    if (iterations <= 5 || iterations % 10 === 0) {
      console.log(
        `[Pathfinding] A* iteration ${iterations}: current=${current}, f=${lowestF.toFixed(
          6
        )}, openSetSize=${openSet.size}`
      );
    }

    if (current === endKey) {
      // Reconstruct path
      const path = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.unshift(current);
      }
      console.log(
        `[Pathfinding] A* found path! Length: ${path.length}, iterations: ${iterations}`
      );
      return path;
    }

    openSet.delete(current);
    closedSet.add(current);

    const currentNode = graph.get(current);
    if (!currentNode) {
      console.warn(`[Pathfinding] Current node not in graph: ${current}`);
      continue;
    }

    const currentG = gScore.has(current) ? gScore.get(current) : Infinity;
    console.log(
      `[Pathfinding] Processing ${current} with ${
        currentNode.neighbors.length
      } neighbors, gScore=${currentG.toFixed(6)}`
    );

    currentNode.neighbors.forEach((neighbor) => {
      if (closedSet.has(neighbor.key)) {
        return; // Skip already processed nodes
      }

      const tentativeGScore = currentG + neighbor.distance;
      const neighborCurrentG = gScore.has(neighbor.key)
        ? gScore.get(neighbor.key)
        : Infinity;

      if (tentativeGScore < neighborCurrentG) {
        cameFrom.set(neighbor.key, current);
        gScore.set(neighbor.key, tentativeGScore);

        const neighborNode = graph.get(neighbor.key);
        if (!neighborNode) {
          console.warn(
            `[Pathfinding] Neighbor node not in graph: ${neighbor.key}`
          );
          return;
        }

        const h = distance(neighborNode.centroid, endNode.centroid);
        fScore.set(neighbor.key, tentativeGScore + h);

        if (!openSet.has(neighbor.key)) {
          openSet.add(neighbor.key);
          if (iterations <= 5) {
            console.log(
              `[Pathfinding]   Added to openSet: ${
                neighbor.key
              }, g=${tentativeGScore.toFixed(6)}, h=${h.toFixed(6)}, f=${(
                tentativeGScore + h
              ).toFixed(6)}`
            );
          }
        }
      }
    });
  }

  console.warn(
    `[Pathfinding] A* failed after ${iterations} iterations, openSet.size=${openSet.size}`
  );
  return null; // No path found
};

// Main function to find route between rooms
export const findRoute = (rooms, startRoom, endRoom, targetFloor = null) => {
  // Get start and end room names
  const startName = getRoomName(startRoom).toLowerCase();
  const endName = getRoomName(endRoom).toLowerCase();

  if (!startName || !endName) return null;

  console.log("[Pathfinding] Starting route search:");
  console.log(`  Start room: ${startName}, Floor: ${getRoomFloor(startRoom)}`);
  console.log(`  End room: ${endName}, Floor: ${getRoomFloor(endRoom)}`);
  console.log(`  Target floor: ${targetFloor}`);

  // Group all features by name
  const roomGroups = groupRoomsByName(rooms);
  console.log(
    `[Pathfinding] Grouped ${roomGroups.size} room groups from ${rooms.length} features`
  );

  // Determine which floor to search
  // If no target floor, try multi-floor routing
  const searchFloor = targetFloor !== null ? targetFloor : null;

  // Build graph
  const graph = buildRoomGraph(roomGroups, searchFloor);
  console.log(`[Pathfinding] Built graph with ${graph.size} nodes`);

  // Find rooms in graph that match start and end names (case-insensitive)
  let startKey = null;
  let endKey = null;

  graph.forEach((node, key) => {
    const nodeName = node.room.name.toLowerCase();
    if (nodeName === startName) {
      startKey = key;
    }
    if (nodeName === endName) {
      endKey = key;
    }
  });

  if (!startKey || !endKey) {
    console.warn(
      `[Pathfinding] Could not find rooms: start="${startName}" (${startKey}), end="${endName}" (${endKey})`
    );
    console.warn(
      `[Pathfinding] Available rooms in graph:`,
      Array.from(graph.keys()).slice(0, 20)
    );
    return null;
  }

  console.log(`[Pathfinding] Found start room: ${startKey}`);
  console.log(`[Pathfinding] Found end room: ${endKey}`);

  const startNode = graph.get(startKey);
  const endNode = graph.get(endKey);

  console.log(`[Pathfinding] Start neighbors: ${startNode.neighbors.length}`);
  if (startNode.neighbors.length > 0) {
    console.log(
      `[Pathfinding] Start neighbors list:`,
      startNode.neighbors.map((n) => n.name).join(", ")
    );
  } else {
    console.warn(
      `[Pathfinding] WARNING: Start room "${startNode.room.name}" has NO neighbors!`
    );
  }

  console.log(`[Pathfinding] End neighbors: ${endNode.neighbors.length}`);
  if (endNode.neighbors.length > 0) {
    console.log(
      `[Pathfinding] End neighbors list:`,
      endNode.neighbors.map((n) => n.name).join(", ")
    );
  } else {
    console.warn(
      `[Pathfinding] WARNING: End room "${endNode.room.name}" has NO neighbors!`
    );
  }

  console.log(
    `[Pathfinding] Distance between start and end: ${distance(
      startNode.centroid,
      endNode.centroid
    ).toFixed(6)} degrees`
  );

  // Run A* algorithm
  const pathKeys = aStar(graph, startKey, endKey);

  if (!pathKeys) {
    console.warn("No path found between rooms");
    return null;
  }

  // Convert path to coordinate arrays for visualization
  const pathCoords = pathKeys.map((key) => {
    const node = graph.get(key);
    return {
      coords: node.centroid,
      floor: node.room.floor,
      name: node.room.name,
      features: node.room.features,
      isCorridor: node.isCorridor,
    };
  });

  console.log(
    `[Pathfinding] Raw path: ${pathCoords.map((p) => p.name).join(" -> ")}`
  );

  // Add corridor waypoints for smoother, more realistic paths
  const enhancedPath = addCorridorWaypoints(pathCoords);

  console.log(
    `[Pathfinding] Enhanced path with ${enhancedPath.length} waypoints`
  );

  return enhancedPath;
};

// Get boundary points of a room (for corridor edge routing)
const getRoomBoundaryPoints = (room, targetPoint) => {
  const coords = [];

  room.features.forEach((feature) => {
    if (feature.geometry.type === "Polygon") {
      coords.push(...feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === "MultiPolygon") {
      coords.push(...feature.geometry.coordinates[0][0]);
    } else if (feature.geometry.type === "LineString") {
      coords.push(...feature.geometry.coordinates);
    }
  });

  if (coords.length === 0) return null;

  // Find the point on the boundary closest to the target
  let closestPoint = coords[0];
  let minDist = distance(coords[0], targetPoint);

  coords.forEach((coord) => {
    const dist = distance(coord, targetPoint);
    if (dist < minDist) {
      minDist = dist;
      closestPoint = coord;
    }
  });

  return closestPoint;
};

// Get multiple evenly spaced points along a corridor for smooth routing
const getCorridorPathPoints = (room, fromPoint, toPoint, numPoints = 2) => {
  const coords = [];

  room.features.forEach((feature) => {
    if (feature.geometry.type === "Polygon") {
      coords.push(...feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === "MultiPolygon") {
      coords.push(...feature.geometry.coordinates[0][0]);
    } else if (feature.geometry.type === "LineString") {
      coords.push(...feature.geometry.coordinates);
    }
  });

  if (coords.length < 3) return [];

  // Calculate corridor "spine" by finding points along the path from entry to exit
  const entryPoint = getRoomBoundaryPoints(room, fromPoint);
  const exitPoint = getRoomBoundaryPoints(room, toPoint);

  if (!entryPoint || !exitPoint) return [];

  // Generate intermediate points along the line from entry to exit
  const waypoints = [];
  for (let i = 1; i <= numPoints; i++) {
    const t = i / (numPoints + 1);
    const interpolated = [
      entryPoint[0] + (exitPoint[0] - entryPoint[0]) * t,
      entryPoint[1] + (exitPoint[1] - entryPoint[1]) * t,
    ];
    waypoints.push(interpolated);
  }

  return waypoints;
};

// Add intermediate waypoints along corridor edges for smoother, more natural paths
const addCorridorWaypoints = (pathCoords) => {
  if (pathCoords.length < 2) return pathCoords;

  const enhancedPath = [];

  for (let i = 0; i < pathCoords.length; i++) {
    const current = pathCoords[i];
    enhancedPath.push(current);

    // Add intermediate waypoints between rooms if they're far apart
    if (i < pathCoords.length - 1) {
      const next = pathCoords[i + 1];
      const dist = distance(current.coords, next.coords);

      // If distance is significant and involves corridors, add waypoints
      if (dist > 0.008) {
        // Lowered threshold for more waypoints
        const currentIsCorridor = isCorridor(current.name);
        const nextIsCorridor = isCorridor(next.name);

        // If transitioning to/from corridor, add boundary waypoints
        if (currentIsCorridor !== nextIsCorridor) {
          let waypointCoord;

          if (currentIsCorridor) {
            // Exiting corridor - use point on corridor edge closest to next room
            waypointCoord = getRoomBoundaryPoints(current, next.coords);
          } else {
            // Entering corridor - use point on corridor edge closest to current room
            waypointCoord = getRoomBoundaryPoints(next, current.coords);
          }

          if (waypointCoord) {
            enhancedPath.push({
              coords: waypointCoord,
              floor: current.floor,
              name: currentIsCorridor ? current.name : next.name,
              features: currentIsCorridor ? current.features : next.features,
              isWaypoint: true,
            });
          }
        }
        // If both are corridors and far apart, add multiple waypoints along corridor path
        else if (currentIsCorridor && nextIsCorridor && dist > 0.015) {
          // Determine number of waypoints based on distance
          const numWaypoints = Math.min(Math.floor(dist / 0.01), 5); // Max 5 waypoints

          // Get corridor path points
          const prevCoords = i > 0 ? pathCoords[i - 1].coords : current.coords;
          const nextNextCoords =
            i < pathCoords.length - 2 ? pathCoords[i + 2].coords : next.coords;

          const corridorPoints = getCorridorPathPoints(
            current,
            prevCoords,
            nextNextCoords,
            numWaypoints
          );

          if (corridorPoints.length > 0) {
            corridorPoints.forEach((point) => {
              enhancedPath.push({
                coords: point,
                floor: current.floor,
                name: current.name,
                features: current.features,
                isWaypoint: true,
              });
            });
          } else {
            // Fallback to simple interpolation
            for (let j = 1; j <= numWaypoints; j++) {
              const t = j / (numWaypoints + 1);
              const interpolated = [
                current.coords[0] + (next.coords[0] - current.coords[0]) * t,
                current.coords[1] + (next.coords[1] - current.coords[1]) * t,
              ];
              enhancedPath.push({
                coords: interpolated,
                floor: current.floor,
                name: current.name,
                features: current.features,
                isWaypoint: true,
              });
            }
          }
        }
        // Room to room transitions - add single midpoint if reasonably far
        else if (!currentIsCorridor && !nextIsCorridor && dist > 0.012) {
          const midpoint = [
            (current.coords[0] + next.coords[0]) / 2,
            (current.coords[1] + next.coords[1]) / 2,
          ];
          enhancedPath.push({
            coords: midpoint,
            floor: current.floor,
            name: "transition",
            features: current.features,
            isWaypoint: true,
          });
        }
      }
    }
  }

  console.log(
    `[Pathfinding] Enhanced path from ${pathCoords.length} to ${enhancedPath.length} points with corridor waypoints`
  );
  return enhancedPath;
};

// Calculate total route distance
export const calculateRouteDistance = (pathCoords) => {
  if (!pathCoords || pathCoords.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < pathCoords.length; i++) {
    totalDistance += distance(pathCoords[i - 1].coords, pathCoords[i].coords);
  }

  return totalDistance;
};
