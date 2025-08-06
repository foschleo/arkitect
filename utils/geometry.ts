
import { Point, RoomBoundingBox } from '../types';

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const calculateSignedPolygonAreaTwice = (points: Point[]): number => {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p1.x * p2.y - p2.x * p1.y);
  }
  return sum;
};

export const calculatePolygonArea = (points: Point[]): number => {
  return Math.abs(calculateSignedPolygonAreaTwice(points) / 2);
};

export const calculateCentroid = (points: Point[]): Point => {
  if (points.length < 3) {
    let sumX = 0; let sumY = 0;
    if (points.length === 0) return { x: 0, y: 0 };
    points.forEach(p => { sumX += p.x; sumY += p.y; });
    return { x: sumX / points.length, y: sumY / points.length };
  }
  const signedAreaTwice = calculateSignedPolygonAreaTwice(points);
  if (Math.abs(signedAreaTwice) < 1e-9) {
    let sumX = 0; let sumY = 0;
    points.forEach(p => { sumX += p.x; sumY += p.y; });
    return { x: sumX / points.length, y: sumY / points.length };
  }
  let cx = 0; let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]; const p2 = points[(i + 1) % points.length];
    const crossProduct = (p1.x * p2.y - p2.x * p1.y);
    cx += (p1.x + p2.x) * crossProduct;
    cy += (p1.y + p2.y) * crossProduct;
  }
  return { x: cx / (3 * signedAreaTwice), y: cy / (3 * signedAreaTwice) };
};

export const isPointInPolygon = (point: Point, polygonPoints: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].x, yi = polygonPoints[i].y;
    const xj = polygonPoints[j].x, yj = polygonPoints[j].y;
    if (((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

export const distancePointToSegment = (p: Point, p1: Point, p2: Point): { dist: number, closestPoint: Point } => {
  const l2 = distance(p1, p2) * distance(p1, p2);
  if (l2 === 0) return { dist: distance(p, p1), closestPoint: { ...p1 } };
  let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const closestPoint = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  return { dist: distance(p, closestPoint), closestPoint };
};

export const closestPointOnSegment = (p: Point, p1: Point, p2: Point): Point => {
  return distancePointToSegment(p, p1, p2).closestPoint;
};

export const getRoomBoundingBox = (points: Point[]): RoomBoundingBox | null => {
    if (!points || points.length === 0) return null;
    let minX = points[0].x; let maxX = points[0].x;
    let minY = points[0].y; let maxY = points[0].y;
    for (let i = 1; i < points.length; i++) {
        minX = Math.min(minX, points[i].x); maxX = Math.max(maxX, points[i].x);
        minY = Math.min(minY, points[i].y); maxY = Math.max(maxY, points[i].y);
    }
    return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
};

export const toDegrees = (radians: number): number => radians * (180 / Math.PI);
export const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

export const getEdgeMidpoints = (points: Point[], isOpenPolyline: boolean = false): {point: Point, edgeIndex: number}[] => {
  const midpoints: {point: Point, edgeIndex: number}[] = [];
  if (points.length < 2) return midpoints;
  const limit = isOpenPolyline ? points.length - 1 : points.length;
  for (let i = 0; i < limit; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length]; // Wraps around for the last edge if closed
    midpoints.push({
      point: {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
      },
      edgeIndex: i
    });
  }
  return midpoints;
};


export const getPerpendicularDistanceToLine = (point: Point, lineP1: Point, lineP2: Point): number => {
  const numerator = Math.abs(
    (lineP2.y - lineP1.y) * point.x -
    (lineP2.x - lineP1.x) * point.y +
    lineP2.x * lineP1.y -
    lineP2.y * lineP1.x
  );
  const denominator = distance(lineP1, lineP2);
  if (denominator === 0) return distance(point, lineP1); // Line is a point
  return numerator / denominator;
};

export const isPointLeftOfLine_crossProduct = (p: Point, p1: Point, p2: Point): number => {
    return (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x);
};

/**
 * Calculates the intersection point of two lines defined by (p1, p2) and (p3, p4).
 * Returns the intersection point or null if lines are parallel or coincident.
 */
export const getLineIntersection = (p0: Point, p1: Point, p2: Point, p3: Point): Point | null => {
    const A1 = p1.y - p0.y;
    const B1 = p0.x - p1.x;
    const C1 = A1 * p0.x + B1 * p0.y;

    const A2 = p3.y - p2.y;
    const B2 = p2.x - p3.x;
    const C2 = A2 * p2.x + B2 * p2.y;

    const determinant = A1 * B2 - A2 * B1;

    if (Math.abs(determinant) < 1e-9) { // Lines are parallel or coincident
        return null;
    } else {
        const x = (B2 * C1 - B1 * C2) / determinant;
        const y = (A1 * C2 - A2 * C1) / determinant;
        return { x, y };
    }
};

/**
 * Checks if a point `p` lies on the line segment `p1-p2`.
 * @param p The point to check.
 * @param p1 Start point of the segment.
 * @param p2 End point of the segment.
 * @param tolerance A small tolerance for floating point comparisons.
 * @returns True if `p` is on the segment `p1-p2`, false otherwise.
 */
export const isPointOnLineSegment = (p: Point, p1: Point, p2: Point, tolerance: number = 1e-6): boolean => {
    const d1 = distance(p, p1);
    const d2 = distance(p, p2);
    const lineLen = distance(p1, p2);
    return Math.abs(d1 + d2 - lineLen) < tolerance;
};


/**
 * Calculates an offset path for a given polyline or polygon, creating mitered corners.
 * @param points The array of points defining the path.
 * @param offsetDistance The distance to offset the path. Positive for left/outward, negative for right/inward.
 * @param isClosed Whether the path is a closed polygon.
 * @returns An array of points for the offset path.
 */
export const offsetPath = (points: Point[], offsetDistance: number, isClosed: boolean): Point[] => {
    if (points.length < 2) return points.map(p => ({ ...p }));
    if (offsetDistance === 0) return points.map(p => ({...p}));

    // Simplified handling for a single open segment (2 points)
    if (!isClosed && points.length === 2) {
        const p1 = points[0];
        const p2 = points[1];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return points.map(p => ({ ...p })); // Degenerate segment

        const normalX = -dy / len;
        const normalY = dx / len;

        return [
            { x: p1.x + normalX * offsetDistance, y: p1.y + normalY * offsetDistance },
            { x: p2.x + normalX * offsetDistance, y: p2.y + normalY * offsetDistance }
        ];
    }

    const offsetPoints: Point[] = [];
    const n = points.length;

    const getOffsetPoint = (p: Point, normal: Point, dist: number): Point => {
        return { x: p.x + normal.x * dist, y: p.y + normal.y * dist };
    };

    const getSegmentNormal = (p1: Point, p2: Point): Point => {
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return { x: 0, y: 0 };
        return { x: -dy / len, y: dx / len };
    };

    if (!isClosed) {
        const normalStart = getSegmentNormal(points[0], points[1]);
        offsetPoints.push(getOffsetPoint(points[0], normalStart, offsetDistance));
    }

    for (let i = 0; i < (isClosed ? n : n - 1); i++) {
        const p0 = points[isClosed ? (i - 1 + n) % n : Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];

        const normal1 = getSegmentNormal(p0, p1);
        const normal2 = getSegmentNormal(p1, p2);

        const op0_s1 = getOffsetPoint(p0, normal1, offsetDistance);
        const op1_s1 = getOffsetPoint(p1, normal1, offsetDistance);
        const op1_s2 = getOffsetPoint(p1, normal2, offsetDistance);
        const op2_s2 = getOffsetPoint(p2, normal2, offsetDistance);

        const intersection = getLineIntersection(op0_s1, op1_s1, op1_s2, op2_s2);

        if (intersection) {
            offsetPoints.push(intersection);
        } else {
             // Fallback if lines are parallel (e.g., straight segment or collinear points)
             // For an open path, the 'previous' segment normal (normal1) might be (0,0) if p0=p1
             // For the first actual segment of an open path, this logic needs care.
             // If normal1 is (0,0) (e.g. first point of open path, p0=p1), use normal2's offset point.
            if (normal1.x === 0 && normal1.y === 0 && (normal2.x !== 0 || normal2.y !== 0)) {
                 offsetPoints.push(getOffsetPoint(p1, normal2, offsetDistance));
            } else if ((normal1.x !== 0 || normal1.y !== 0) && normal2.x === 0 && normal2.y === 0) {
                 // Should not happen if p1 != p2 for normal2, but as a fallback
                 offsetPoints.push(getOffsetPoint(p1, normal1, offsetDistance));
            } else {
                 // Default to using the offset from the outgoing segment if intersection fails
                 offsetPoints.push(getOffsetPoint(p1, normal2, offsetDistance));
            }
        }
    }

    if (!isClosed) {
        const normalEnd = getSegmentNormal(points[n - 2], points[n - 1]);
        offsetPoints.push(getOffsetPoint(points[n - 1], normalEnd, offsetDistance));
    } else {
        // For closed paths, connect the last computed miter point back to the first.
        // The loop already computes n miter points. Need to ensure the first and last are handled correctly by the miter.
        // A common approach is to compute the miter for points[0] using points[n-1], points[0], points[1].
        // The current loop for `i=0` when `isClosed=true` uses `p0 = points[n-1]`, `p1 = points[0]`, `p2 = points[1]`.
        // This calculates the miter at `points[0]`.
        // The last point added by the loop `i = n-1` corresponds to the miter at `points[n-1]`.
        // If the first and last points of offsetPoints are too close, they are merged by cleaning.
    }

    if (offsetPoints.length > 1) {
        const cleaned: Point[] = [offsetPoints[0]];
        for (let i = 1; i < offsetPoints.length; i++) {
            if (distance(cleaned[cleaned.length - 1], offsetPoints[i]) > 1e-6) {
                cleaned.push(offsetPoints[i]);
            }
        }
        if (isClosed && cleaned.length > 1 && distance(cleaned[0], cleaned[cleaned.length - 1]) < 1e-6) {
             cleaned.pop();
        }
        return cleaned;
    }

    return offsetPoints;
};

export const closestPointOnInfiniteLine = (p: Point, lineP1: Point, lineP2: Point): Point => {
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;

  if (dx === 0 && dy === 0) { // Line is a point
    return { ...lineP1 };
  }

  const t = ((p.x - lineP1.x) * dx + (p.y - lineP1.y) * dy) / (dx * dx + dy * dy);

  return {
    x: lineP1.x + t * dx,
    y: lineP1.y + t * dy,
  };
};

/**
 * Projects point `P` onto the line defined by `A` and `B`.
 */
export const projectPointToLine = (P: Point, A: Point, B: Point): Point => {
    return closestPointOnInfiniteLine(P, A, B);
};

export const findOppositeEdgeAndIndex = (
    sourcePath: Point[],
    sourceEdgeIndex: number,
    targetPath: Point[],
    wallThickness: number
): { edge: [Point, Point], index: number } | null => {
    if (sourcePath.length < 2 || targetPath.length < 2) return null;

    const p1 = sourcePath[sourceEdgeIndex];
    const p2 = sourcePath[(sourceEdgeIndex + 1) % sourcePath.length];

    // Create a test point at the midpoint of the source edge
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    // Find the closest point on the entire targetPath to the source midpoint.
    // This is more robust than projecting along a calculated normal, which can fail at sharp corners.
    let minDistance = Infinity;
    let bestEdgeIndex = -1;

    for (let i = 0; i < targetPath.length; i++) {
        const seg_p1 = targetPath[i];
        const seg_p2 = targetPath[(i + 1) % targetPath.length];
        const { dist } = distancePointToSegment(midPoint, seg_p1, seg_p2);

        if (dist < minDistance) {
            minDistance = dist;
            bestEdgeIndex = i;
        }
    }

    // Tolerance check: The closest edge should be roughly wallThickness away.
    // A generous tolerance (e.g., up to twice the thickness) accounts for non-parallel or irregular walls.
    if (bestEdgeIndex !== -1 && minDistance < wallThickness * 2.0) {
        return {
            edge: [targetPath[bestEdgeIndex], targetPath[(bestEdgeIndex + 1) % targetPath.length]],
            index: bestEdgeIndex
        };
    }

    return null;
};