
import { Point, Room, Transform, Unit, HoveredVertexInfo, HoveredEdgeInfo, SelectedElementInfo, EditingRoomNameInfo, ContextMenuState, Mode, DimensionLine, WallAlignment, HoveredDimensionLineInfo, SelectedDimensionVertexInfo, HoveredDimensionVertexInfo, DragEntireDimensionLineInfo, SnapType, CurrentSnapInfo, LayerData, SelectedOpeningWallInfo, Guideline, Door } from '../types';
import { DEFAULT_GRID_SPACING_WORLD_UNITS, METRIC_MARKER_INTERVAL_WORLD_UNITS, VERTEX_RENDER_RADIUS_SCREEN_PX, POINT_SNAP_THRESHOLD_GRID_FACTOR, EDGE_HOVER_THRESHOLD_SCREEN_PX, ANNOTATION_VISIBILITY_THRESHOLD_SCALE, REFERENCE_ARCH_SCALE_DENOMINATOR, BASE_DIMENSION_FONT_SIZE_PX, BASE_DIMENSION_TICK_LENGTH_SCREEN_PX, BASE_LABEL_FONT_SIZE_PX, VISIBILITY_SCALE_EXPONENT, ABNT_REF_HEIGHT_MM, UNITS_PER_METER, MIN_SCREEN_PIXELS_FOR_SUB_GRID_LINES, MIN_SCREEN_PIXELS_FOR_USER_GRID_MARKERS, EDGE_MIDPOINT_RADIUS_SCREEN_PX, SNAP_INDICATOR_SIZE_SCREEN_PX, SNAP_ENDPOINT_COLOR, SNAP_MIDPOINT_COLOR, SNAP_LINE_EXTENSION_COLOR, SNAP_GRID_COLOR, SNAP_ON_LINE_COLOR, SNAP_INTERSECTION_COLOR, SNAP_PERPENDICULAR_COLOR, SNAP_CENTER_COLOR, SNAP_ON_ROOM_PERIMETER_COLOR, DIM_OFFSET_MM, DIM_EXTENSION_MM, DIM_EXTENSION_LINE_GAP_MM, DEFAULT_WALL_THICKNESS_WORLD_UNITS, DEFAULT_DOOR_WIDTH_WORLD_UNITS, DEFAULT_DOOR_PANEL_THICKNESS_WORLD_UNITS, DEFAULT_DOOR_JAMB_THICKNESS_WORLD_UNITS, DEFAULT_DOOR_HINGE_OFFSET_WORLD_UNITS } from '../constants';
import { toDegrees, calculateSignedPolygonAreaTwice, distance as calculateDistance, offsetPath, calculateCentroid, calculatePolygonArea, closestPointOnSegment, getEdgeMidpoints, isPointLeftOfLine_crossProduct, findOppositeEdgeAndIndex, projectPointToLine, getLineIntersection, distancePointToSegment } from './geometry';
import { convertWorldUnitsToDisplayUnit } from './units';

export const formatDimension = (val: number, unit: Unit, suffix: boolean = true): string => { const m = val / UNITS_PER_METER; let v: string, s: string = ''; switch (unit) { case Unit.Centimeters: v = (m * 100).toFixed(0); s = ' cm'; break; case Unit.Millimeters: v = (m * 1000).toFixed(0); s = ' mm'; break; default: v = m.toFixed(2); s = ' m'; break; } return suffix ? `${v}${s}` : v; };
const formatArea = (area: number, unit: Unit): string => { const sqm = area / (UNITS_PER_METER * UNITS_PER_METER); let v: string, s: string = ''; switch (unit) { case Unit.Centimeters: v = (sqm * 10000).toFixed(0); s = ' cm²'; break; case Unit.Millimeters: v = (sqm * 1000000).toFixed(0); s = ' mm²'; break; default: v = sqm.toFixed(2); s = ' m²'; break; } return `${v}${s}`; };
export const getAbntHeightMm = (scaleDenominator: number): number => { if (scaleDenominator <= 20) return 7; if (scaleDenominator <= 75) return 5; if (scaleDenominator <= 100) return 3.5; if (scaleDenominator <= 200) return 3.0; if (scaleDenominator <= 500) return 2.5; return 2.0; };
export const getScaledScreenValue = (baseScreenValue: number, currentCanvasScale: number, baseFontSizeForRef: number): number => { if (currentCanvasScale <= 0) return baseScreenValue; const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / currentCanvasScale; const abntHeightForCurrentScaleMm = getAbntHeightMm(currentArchScaleDenom); const abntHeightForRefScaleMm = getAbntHeightMm(REFERENCE_ARCH_SCALE_DENOMINATOR); let targetScreenSize = baseFontSizeForRef * (abntHeightForCurrentScaleMm / abntHeightForRefScaleMm); targetScreenSize *= Math.pow(currentCanvasScale, VISIBILITY_SCALE_EXPONENT); return targetScreenSize; };
const toWorldForDrawing = (screenPoint: { x: number, y: number }, canvas: HTMLCanvasElement, transform: Transform): Point => { const rect = canvas.getBoundingClientRect(); return { x: (screenPoint.x - rect.left) / transform.scale - transform.panX, y: (screenPoint.y - rect.top) / transform.scale - transform.panY }; };

export const getPaperSpaceValueInWorldUnits = (paperValueMm: number, architecturalScale: number): number => {
    if (architecturalScale <= 0) return 0;
    const paperValueMeters = paperValueMm / 1000.0;
    const drawingValueMeters = paperValueMeters * architecturalScale;
    return drawingValueMeters * UNITS_PER_METER;
};

export const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, transform: Transform, isGridVisible: boolean, userGridSpacing: number) => {
  if (!isGridVisible || userGridSpacing <= 0) return;
  const PADDING = 50 / transform.scale;
  const viewRectWorld = { minX: toWorldForDrawing({ x: 0, y: 0 }, canvas, transform).x - PADDING, minY: toWorldForDrawing({ x: 0, y: 0 }, canvas, transform).y - PADDING, maxX: toWorldForDrawing({ x: canvas.width, y: canvas.height }, canvas, transform).x + PADDING, maxY: toWorldForDrawing({ x: canvas.width, y: canvas.height }, canvas, transform).y + PADDING };
  const startX = Math.floor(viewRectWorld.minX / userGridSpacing) * userGridSpacing; const endX = Math.ceil(viewRectWorld.maxX / userGridSpacing) * userGridSpacing; const startY = Math.floor(viewRectWorld.minY / userGridSpacing) * userGridSpacing; const endY = Math.ceil(viewRectWorld.maxY / userGridSpacing) * userGridSpacing;
  const screenGridSpacing = userGridSpacing * transform.scale;
  if (screenGridSpacing >= MIN_SCREEN_PIXELS_FOR_SUB_GRID_LINES) { ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 0.5 / transform.scale; for (let x = startX; x <= endX; x += userGridSpacing) { ctx.beginPath(); ctx.moveTo(x, viewRectWorld.minY); ctx.lineTo(x, viewRectWorld.maxY); ctx.stroke(); } for (let y = startY; y <= endY; y += userGridSpacing) { ctx.beginPath(); ctx.moveTo(viewRectWorld.minX, y); ctx.lineTo(viewRectWorld.maxX, y); ctx.stroke(); } }

  const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;
  let mainMarkerInterval: number;
  let mainMarkerColor: string;

  if (currentArchScaleDenom >= 500 && currentArchScaleDenom <= 5000) {
    mainMarkerInterval = 100 * METRIC_MARKER_INTERVAL_WORLD_UNITS; // 100 meters
    mainMarkerColor = 'rgba(239, 68, 68, 0.7)'; // A slightly transparent red
  } else if (currentArchScaleDenom > 5000) {
    mainMarkerInterval = 100 * METRIC_MARKER_INTERVAL_WORLD_UNITS; // 100 meters, grey
    mainMarkerColor = '#c0c0c0';
  } else { // < 500
    mainMarkerInterval = METRIC_MARKER_INTERVAL_WORLD_UNITS; // 1 meter, grey
    mainMarkerColor = '#c0c0c0';
  }

  ctx.strokeStyle = mainMarkerColor;
  ctx.lineWidth = 1 / transform.scale;
  const mainMarkerSizeFactor = 0.025;
  const mainMarkerActualSize = mainMarkerInterval * mainMarkerSizeFactor;

  const startMarkerXMain = Math.floor(viewRectWorld.minX / mainMarkerInterval) * mainMarkerInterval; const endMarkerXMain = Math.ceil(viewRectWorld.maxX / mainMarkerInterval) * mainMarkerInterval; const startMarkerYMain = Math.floor(viewRectWorld.minY / mainMarkerInterval) * mainMarkerInterval; const endMarkerYMain = Math.ceil(viewRectWorld.maxY / mainMarkerInterval) * mainMarkerInterval;
  if (mainMarkerInterval * transform.scale >= MIN_SCREEN_PIXELS_FOR_USER_GRID_MARKERS) {
    for (let x = startMarkerXMain; x <= endMarkerXMain; x += mainMarkerInterval) { for (let y = startMarkerYMain; y <= endMarkerYMain; y += mainMarkerInterval) { if (x >= viewRectWorld.minX && x <= viewRectWorld.maxX && y >= viewRectWorld.minY && y <= viewRectWorld.maxY) { ctx.beginPath(); ctx.moveTo(x - mainMarkerActualSize, y); ctx.lineTo(x + mainMarkerActualSize, y); ctx.moveTo(x, y - mainMarkerActualSize); ctx.lineTo(x, y + mainMarkerActualSize); ctx.stroke(); } } }
  }
};

export const drawGuidelines = (
  ctx: CanvasRenderingContext2D,
  guidelines: Guideline[],
  transform: Transform,
  canvas: HTMLCanvasElement
) => {
  if (!guidelines || guidelines.length === 0) return;

  const PADDING = 100 / transform.scale;
  const viewRectWorld = {
    minX: toWorldForDrawing({ x: 0, y: 0 }, canvas, transform).x - PADDING,
    minY: toWorldForDrawing({ x: 0, y: 0 }, canvas, transform).y - PADDING,
    maxX: toWorldForDrawing({ x: canvas.width, y: canvas.height }, canvas, transform).x + PADDING,
    maxY: toWorldForDrawing({ x: canvas.width, y: canvas.height }, canvas, transform).y + PADDING,
  };

  const viewportEdges = [
    { p1: { x: viewRectWorld.minX, y: viewRectWorld.minY }, p2: { x: viewRectWorld.maxX, y: viewRectWorld.minY } }, // Top
    { p1: { x: viewRectWorld.maxX, y: viewRectWorld.minY }, p2: { x: viewRectWorld.maxX, y: viewRectWorld.maxY } }, // Right
    { p1: { x: viewRectWorld.maxX, y: viewRectWorld.maxY }, p2: { x: viewRectWorld.minX, y: viewRectWorld.maxY } }, // Bottom
    { p1: { x: viewRectWorld.minX, y: viewRectWorld.maxY }, p2: { x: viewRectWorld.minX, y: viewRectWorld.minY } }, // Left
  ];

  ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)'; // A nice pink color
  ctx.lineWidth = 1 / transform.scale;
  ctx.setLineDash([8 / transform.scale, 4 / transform.scale, 2 / transform.scale, 4 / transform.scale]);

  guidelines.forEach(guide => {
    const [p1, p2] = guide.points;
    const intersections: Point[] = [];

    // Check intersections with all four viewport edges
    viewportEdges.forEach(edge => {
      const intersection = getLineIntersection(p1, p2, edge.p1, edge.p2);
      if (intersection &&
          intersection.x >= viewRectWorld.minX - 1e-6 &&
          intersection.x <= viewRectWorld.maxX + 1e-6 &&
          intersection.y >= viewRectWorld.minY - 1e-6 &&
          intersection.y <= viewRectWorld.maxY + 1e-6) {
        intersections.push(intersection);
      }
    });

    // Remove duplicate intersection points
    const uniqueIntersections = intersections.reduce<Point[]>((acc, current) => {
        if (!acc.some(p => Math.abs(p.x - current.x) < 1e-6 && Math.abs(p.y - current.y) < 1e-6)) {
            acc.push(current);
        }
        return acc;
    }, []);

    if (uniqueIntersections.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(uniqueIntersections[0].x, uniqueIntersections[0].y);
      ctx.lineTo(uniqueIntersections[1].x, uniqueIntersections[1].y);
      ctx.stroke();
    }
  });

  ctx.setLineDash([]);
};

export const drawRooms = (
  ctx: CanvasRenderingContext2D, rooms: Room[], transform: Transform, currentUnit: Unit,
  isEditModeActiveForLayer: boolean, selectedRoomId: number | null, editingRoomNameInfo: EditingRoomNameInfo | null,
  isSplittingAttemptActiveForLayer: boolean, divisionLinePoints: Point[], hoveredRoomIndex: number | null, layerId: string,
  isLayerCurrentlyActive: boolean,
  getAbntHeightMm: (scaleDenominator: number) => number,
  getScaledScreenValue: (baseScreenValue: number, currentCanvasScale: number, baseFontSizeForRef: number) => number,
  REFERENCE_ARCH_SCALE_DENOMINATOR: number
) => {

  // Pass 1: Draw floor areas (rooms that are not walls)
  rooms.forEach((room, roomIdx) => {
    if (room.isWall) return;

    const pathDefinition = room.points;
    if (!pathDefinition || pathDefinition.length < 2) return;

    const isRoomSelected = room.id === selectedRoomId;
    const isRoomHovered = roomIdx === hoveredRoomIndex;
    const isRoomBeingRenamed = editingRoomNameInfo?.layerId === layerId && editingRoomNameInfo.roomIndexInLayer === roomIdx;

    ctx.beginPath();
    ctx.moveTo(pathDefinition[0].x, pathDefinition[0].y);
    for (let i = 1; i < pathDefinition.length; i++) ctx.lineTo(pathDefinition[i].x, pathDefinition[i].y);
    ctx.closePath();

    let defaultFill = 'rgba(200, 200, 200, 0.3)';
    if (!isLayerCurrentlyActive) {
      defaultFill = 'rgba(180, 180, 180, 0.5)';
    }
    ctx.fillStyle = isRoomSelected ? 'rgba(211, 211, 211, 0.6)'
                  : isRoomHovered ? 'rgba(56, 189, 248, 0.3)'
                  : defaultFill;
    ctx.fill();

    if(isRoomSelected) {
        ctx.strokeStyle = isRoomSelected ? 'rgba(150,150,150,0.8)' : 'rgba(100,100,100,0.5)';
        ctx.lineWidth = 1 / transform.scale;
        ctx.stroke();
    }

    const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;
    if (!room.isSegment && room.labelPosition && !isRoomBeingRenamed && currentArchScaleDenom <= ANNOTATION_VISIBILITY_THRESHOLD_SCALE) {
      const abntHeightMm = getAbntHeightMm(currentArchScaleDenom);
      const targetScreenFontSize = BASE_LABEL_FONT_SIZE_PX * (abntHeightMm / ABNT_REF_HEIGHT_MM);
      const scaledLabelFontSize = getScaledScreenValue(targetScreenFontSize, transform.scale, BASE_LABEL_FONT_SIZE_PX);

      ctx.font = `${scaledLabelFontSize}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isRoomSelected ? '#334155' : '#475569';

      const lineSpacing = scaledLabelFontSize * 0.2;
      const textLineHeight = scaledLabelFontSize + lineSpacing;

      const nameYPos = room.labelPosition.y - lineSpacing;
      const areaYPos = room.labelPosition.y + textLineHeight;

      ctx.fillText(room.name, room.labelPosition.x, nameYPos);
      ctx.font = `${scaledLabelFontSize * 0.9}px Segoe UI, sans-serif`;
      ctx.fillText(formatArea(room.area, currentUnit), room.labelPosition.x, areaYPos);
    }
  });

  // Pass 2: Draw walls and their interactive elements
  rooms.forEach((room, roomIdx) => {
    if (!room.isWall) return;

    const pathDefinition = room.points;
    if (!pathDefinition || pathDefinition.length < 2) return;

    const isRoomSelected = room.id === selectedRoomId;
    const isRoomHovered = roomIdx === hoveredRoomIndex;

    const wallFillColor = isRoomSelected ? 'rgba(150, 150, 150, 0.95)' : isRoomHovered ? 'rgba(96, 165, 250, 0.85)' : 'rgba(50, 50, 50, 0.9)';
    const wallStrokeColor = isRoomSelected ? 'rgba(120,120,120,0.95)' : isRoomHovered ? 'rgba(70,140,220,0.85)' : 'rgba(40,40,40,0.9)';

    ctx.fillStyle = wallFillColor;
    ctx.strokeStyle = wallStrokeColor;
    ctx.lineWidth = 0.85 / transform.scale;

    ctx.beginPath();
    ctx.moveTo(pathDefinition[0].x, pathDefinition[0].y);
    for (let k = 1; k < pathDefinition.length; k++) ctx.lineTo(pathDefinition[k].x, pathDefinition[k].y);
    ctx.closePath();

    if (room.innerPoints && room.innerPoints.length > 2) {
      const innerPath = room.innerPoints;
      ctx.moveTo(innerPath[0].x, innerPath[0].y);
      for (let k = 1; k < innerPath.length; k++) ctx.lineTo(innerPath[k].x, innerPath[k].y);
      ctx.closePath();
      ctx.fill('evenodd');
    } else {
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(pathDefinition[0].x, pathDefinition[0].y);
    for (let k = 1; k < pathDefinition.length; k++) ctx.lineTo(pathDefinition[k].x, pathDefinition[k].y);
    ctx.closePath();
    ctx.stroke();

    // The stroke for the inner path is removed to prevent it from overlapping the floor fill.
    // The clean edge between the wall fill and floor fill creates the desired visual boundary.

    if (isEditModeActiveForLayer && (isRoomSelected || isRoomHovered)) {
      const drawVerticesForPath = (points: Point[]) => {
        points.forEach(vertex => {
          ctx.beginPath();
          ctx.arc(vertex.x, vertex.y, VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale, 0, 2 * Math.PI);
          ctx.fillStyle = isRoomSelected ? 'rgb(170, 170, 170)' : 'rgba(100, 100, 100, 0.8)';
          ctx.fill();
        });
      };
      drawVerticesForPath(room.points || []);
      if (room.innerPoints) drawVerticesForPath(room.innerPoints);
    }
  });
};

export const drawDoors = (
  ctx: CanvasRenderingContext2D,
  doors: Door[],
  transform: Transform,
  selectedDoorId: number | null
) => {
    if (!doors) return;

    doors.forEach(door => {
        const { center, width, wallThickness, wallVector, swing, isSelected } = door;

        // Basic vectors and dimensions
        const wallNormal = { x: -wallVector.y, y: wallVector.x };
        const halfWidth = width / 2;
        const halfThickness = wallThickness / 2;

        // The two points defining the opening on the wall's centerline
        const op1_center = { x: center.x - wallVector.x * halfWidth, y: center.y - wallVector.y * halfWidth };
        const op2_center = { x: center.x + wallVector.x * halfWidth, y: center.y + wallVector.y * halfWidth };

        // Define the four corners of the raw wall opening
        const op1_in = { x: op1_center.x + wallNormal.x * halfThickness, y: op1_center.y + wallNormal.y * halfThickness };
        const op1_out = { x: op1_center.x - wallNormal.x * halfThickness, y: op1_center.y - wallNormal.y * halfThickness };
        const op2_in = { x: op2_center.x + wallNormal.x * halfThickness, y: op2_center.y + wallNormal.y * halfThickness };
        const op2_out = { x: op2_center.x - wallNormal.x * halfThickness, y: op2_center.y - wallNormal.y * halfThickness };

        // --- Draw Jambs ---
        const jambThickness = DEFAULT_DOOR_JAMB_THICKNESS_WORLD_UNITS;
        ctx.fillStyle = isSelected ? 'rgba(96, 165, 250, 0.85)' : 'rgba(50, 50, 50, 0.9)';

        // Left Jamb
        const jamb1_p1 = op1_out;
        const jamb1_p2 = { x: op1_out.x + wallVector.x * jambThickness, y: op1_out.y + wallVector.y * jambThickness };
        const jamb1_p3 = { x: op1_in.x + wallVector.x * jambThickness, y: op1_in.y + wallVector.y * jambThickness };
        const jamb1_p4 = op1_in;
        ctx.beginPath();
        ctx.moveTo(jamb1_p1.x, jamb1_p1.y);
        ctx.lineTo(jamb1_p2.x, jamb1_p2.y);
        ctx.lineTo(jamb1_p3.x, jamb1_p3.y);
        ctx.lineTo(jamb1_p4.x, jamb1_p4.y);
        ctx.closePath();
        ctx.fill();

        // Right Jamb
        const jamb2_p1 = op2_out;
        const jamb2_p2 = { x: op2_out.x - wallVector.x * jambThickness, y: op2_out.y - wallVector.y * jambThickness };
        const jamb2_p3 = { x: op2_in.x - wallVector.x * jambThickness, y: op2_in.y - wallVector.y * jambThickness };
        const jamb2_p4 = op2_in;
        ctx.beginPath();
        ctx.moveTo(jamb2_p1.x, jamb2_p1.y);
        ctx.lineTo(jamb2_p2.x, jamb2_p2.y);
        ctx.lineTo(jamb2_p3.x, jamb2_p3.y);
        ctx.lineTo(jamb2_p4.x, jamb2_p4.y);
        ctx.closePath();
        ctx.fill();

        // --- Door Leaf and Swing Arc ---
        const [swingSide, swingDirection] = swing.split('_') as [ 'left' | 'right', 'in' | 'out' ];
        const isInSwing = swingDirection === 'in';

        // Point where the panel is visually attached to the jamb
        let panelAttachmentPoint: Point;
        // Point where the panel latches
        let latchPoint: Point;

        if (swingSide === 'left') {
            panelAttachmentPoint = isInSwing ? jamb1_p3 : jamb1_p2;
            latchPoint = isInSwing ? jamb2_p3 : jamb2_p2;
        } else { // 'right'
            panelAttachmentPoint = isInSwing ? jamb2_p3 : jamb2_p2;
            latchPoint = isInSwing ? jamb1_p3 : jamb1_p2;
        }

        // The center of rotation is the outer corner of the jamb.
        let rotationCenter: Point;
        if (swingSide === 'left') {
            rotationCenter = isInSwing ? op1_in : op1_out;
        } else {
            rotationCenter = isInSwing ? op2_in : op2_out;
        }

        const useClockwiseRotation = (swingSide === 'left' && isInSwing) || (swingSide === 'right' && !isInSwing);

        // Rotate the panelAttachmentPoint to find its open position
        const vecAttach = { x: panelAttachmentPoint.x - rotationCenter.x, y: panelAttachmentPoint.y - rotationCenter.y };
        let vecAttachOpen;
        if (useClockwiseRotation) {
            vecAttachOpen = { x: vecAttach.y, y: -vecAttach.x };
        } else {
            vecAttachOpen = { x: -vecAttach.y, y: vecAttach.x };
        }
        const panelAttachmentPoint_open = { x: rotationCenter.x + vecAttachOpen.x, y: rotationCenter.y + vecAttachOpen.y };

        // Rotate the latchPoint to find its open position
        const vecLatch = { x: latchPoint.x - rotationCenter.x, y: latchPoint.y - rotationCenter.y };
        let vecLatchOpen;
        if (useClockwiseRotation) {
            vecLatchOpen = { x: vecLatch.y, y: -vecLatch.x };
        } else {
            vecLatchOpen = { x: -vecLatch.y, y: vecLatch.x };
        }
        const latchPoint_open = { x: rotationCenter.x + vecLatchOpen.x, y: rotationCenter.y + vecLatchOpen.y };


        // Draw Door Leaf
        ctx.strokeStyle = isSelected ? 'rgba(59, 130, 246, 1)' : 'rgba(40,40,40,0.9)';
        const originalLineWidth = ctx.lineWidth;
        ctx.lineWidth = DEFAULT_DOOR_PANEL_THICKNESS_WORLD_UNITS / transform.scale;
        ctx.beginPath();
        ctx.moveTo(panelAttachmentPoint_open.x, panelAttachmentPoint_open.y);
        ctx.lineTo(latchPoint_open.x, latchPoint_open.y);
        ctx.stroke();
        ctx.lineWidth = originalLineWidth;

        // Draw Swing Arc
        const arcRadius = calculateDistance(rotationCenter, latchPoint);
        const startAngle = Math.atan2(latchPoint.y - rotationCenter.y, latchPoint.x - rotationCenter.x);
        const endAngle = Math.atan2(latchPoint_open.y - rotationCenter.y, latchPoint_open.x - rotationCenter.y);
        const counterClockwise = !useClockwiseRotation;

        ctx.strokeStyle = isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(100,100,100,0.7)';
        ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
        ctx.beginPath();
        ctx.arc(rotationCenter.x, rotationCenter.y, arcRadius, startAngle, endAngle, counterClockwise);
        ctx.stroke();
        ctx.setLineDash([]);
    });
};

export const drawDoorPreview = (
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  wallInfo: SelectedOpeningWallInfo,
  centerPoint: Point
) => {
    const doorWidth = DEFAULT_DOOR_WIDTH_WORLD_UNITS;
    const wallThickness = wallInfo.originalWallObject.wallThickness || DEFAULT_WALL_THICKNESS_WORLD_UNITS;

    const dx = wallInfo.edgeP2.x - wallInfo.edgeP1.x;
    const dy = wallInfo.edgeP2.y - wallInfo.edgeP1.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const wallVector = { x: dx/len, y: dy/len };

    const doorObj: Door = {
      id: -1,
      layerId: '',
      wallElementId: -1,
      center: centerPoint,
      width: doorWidth,
      wallThickness: wallThickness,
      wallVector: wallVector,
      swing: 'right_in', // Default preview swing
    };

    ctx.globalAlpha = 0.6;
    drawDoors(ctx, [doorObj], transform, null);
    ctx.globalAlpha = 1.0;
};


export const drawCurrentPolygon = (
  ctx: CanvasRenderingContext2D, points: Point[], previewEndPoint: Point | null, transform: Transform,
  currentUnit: Unit, currentMode: Mode, currentWallThickness: number, isDrawing: boolean,
  currentWallAlignment: WallAlignment, currentSnapInfo: CurrentSnapInfo | null
) => {
  if (!isDrawing || points.length === 0) return;

  if (currentMode === Mode.Wall && points.length >= 1) {
    const guideline = [...points];
    if (previewEndPoint) {
      guideline.push(previewEndPoint);
    }

    if (guideline.length < 2) return;

    const isClosing = guideline.length > 3 &&
      ( (currentSnapInfo?.displayText?.startsWith("Close Wall")) ||
        calculateDistance(guideline[0], guideline[guideline.length - 1]) < 1e-6 );

    const pathForOffset = isClosing ? guideline.slice(0, -1) : guideline;

    let outerFace: Point[], innerFace: Point[];
    if (currentWallAlignment === WallAlignment.Centered) {
      outerFace = offsetPath(pathForOffset, currentWallThickness / 2, isClosing);
      innerFace = offsetPath(pathForOffset, -currentWallThickness / 2, isClosing);
    } else if (currentWallAlignment === WallAlignment.Exterior) {
      outerFace = [...pathForOffset];
      innerFace = offsetPath(pathForOffset, -currentWallThickness, isClosing);
    } else { // Interior
      innerFace = [...pathForOffset];
      outerFace = offsetPath(pathForOffset, currentWallThickness, isClosing);
    }

    ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.lineWidth = 1 / transform.scale;

    if (isClosing) {
        if (outerFace.length < 3 || innerFace.length < 3) return; // Cannot draw if offset failed

        ctx.beginPath();
        ctx.moveTo(outerFace[0].x, outerFace[0].y);
        for (let i = 1; i < outerFace.length; i++) ctx.lineTo(outerFace[i].x, outerFace[i].y);
        ctx.closePath();

        ctx.moveTo(innerFace[0].x, innerFace[0].y);
        for (let i = 1; i < innerFace.length; i++) ctx.lineTo(innerFace[i].x, innerFace[i].y);
        ctx.closePath();

        ctx.fill('evenodd');

        ctx.beginPath();
        ctx.moveTo(outerFace[0].x, outerFace[0].y);
        for (let i = 1; i < outerFace.length; i++) ctx.lineTo(outerFace[i].x, outerFace[i].y);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(innerFace[0].x, innerFace[0].y);
        for (let i = 1; i < innerFace.length; i++) ctx.lineTo(innerFace[i].x, innerFace[i].y);
        ctx.closePath();
        ctx.stroke();

    } else { // Draw an open wall segment
        const wallPolygon = [...outerFace, ...[...innerFace].reverse()];
        if (wallPolygon.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(wallPolygon[0].x, wallPolygon[0].y);
        for (let i = 1; i < wallPolygon.length; i++) {
          ctx.lineTo(wallPolygon[i].x, wallPolygon[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

  } else { // Room Mode
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    if (previewEndPoint) {
      ctx.lineTo(previewEndPoint.x, previewEndPoint.y);
    }

    ctx.strokeStyle = '#3b82f6'; // blue-500
    ctx.lineWidth = 1.5 / transform.scale;
    ctx.stroke();
  }

  [...points, ...(previewEndPoint ? [previewEndPoint] : [])].forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
  });
};

export const drawDivisionLinePreview = (
  ctx: CanvasRenderingContext2D, transform: Transform, isEditMode: boolean, isSplitting: boolean,
  divisionPoints: Point[], previewEndPoint: Point | null
) => {
  if (!isEditMode || !isSplitting || divisionPoints.length === 0 || !previewEndPoint) return;

  ctx.beginPath();
  ctx.moveTo(divisionPoints[0].x, divisionPoints[0].y);
  ctx.lineTo(previewEndPoint.x, previewEndPoint.y);

  ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // red-500
  ctx.lineWidth = 1.5 / transform.scale;
  ctx.stroke();
  ctx.setLineDash([]);
};

export const drawManualDimensionLines = (
    ctx: CanvasRenderingContext2D, dimensionLines: DimensionLine[], transform: Transform,
    currentUnit: Unit, layerId: string, selectedDimId: number | null,
    draggedOffsetDimIndex: number | null, draggedVertexDimIndex: number | null,
    hoveredDimLineIndex: number | null, isEditMode: boolean,
    hoveredDimVertexInfo: HoveredDimensionVertexInfo | null,
    isDraggingEntireLine: boolean, draggedEntireLineInfo: DragEntireDimensionLineInfo | null,
    architecturalScale: number
) => {
    const currentArchScaleDenom = architecturalScale;
    if (currentArchScaleDenom > ANNOTATION_VISIBILITY_THRESHOLD_SCALE) return;

    const standardOffset = getPaperSpaceValueInWorldUnits(DIM_OFFSET_MM, currentArchScaleDenom);
    const lineExtension = getPaperSpaceValueInWorldUnits(DIM_EXTENSION_MM, currentArchScaleDenom);
    const extensionLineGap = getPaperSpaceValueInWorldUnits(DIM_EXTENSION_LINE_GAP_MM, currentArchScaleDenom);
    const scaledTickLength = getScaledScreenValue(BASE_DIMENSION_TICK_LENGTH_SCREEN_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX) / transform.scale;
    const scaledFontSize = getScaledScreenValue(BASE_DIMENSION_FONT_SIZE_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX);

    ctx.font = `${scaledFontSize}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    dimensionLines.forEach((dl, dlIndex) => {
        if (!dl.points || dl.points.length < 2) return;

        const isSelected = dl.id === selectedDimId;
        const isHovered = dlIndex === hoveredDimLineIndex;
        const isDraggingOffset = dlIndex === draggedOffsetDimIndex;
        const isDraggingVertex = dlIndex === draggedVertexDimIndex;
        const isDraggingEntire = isDraggingEntireLine && draggedEntireLineInfo?.dimensionLineIndexInLayer === dlIndex;

        ctx.strokeStyle = (isSelected || isHovered || isDraggingOffset || isDraggingVertex || isDraggingEntire) ? 'rgba(75, 85, 99, 0.9)' : 'rgba(107, 114, 128, 0.9)';
        ctx.fillStyle = (isSelected || isHovered) ? '#1f2937' : '#374151';
        ctx.lineWidth = 1 / transform.scale;

        const p1 = dl.points[0];
        const pN = dl.points[dl.points.length - 1];

        const offset = dl.customOffset !== undefined ? dl.customOffset : standardOffset;

        let dx = pN.x - p1.x;
        let dy = pN.y - p1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        let nx=0, ny=0;
        if (len > 0) {
            nx = -dy/len;
            ny = dx/len;
        } else {
            nx = 0;
            ny = -1;
        }

        const finalNx = nx * dl.offsetSide;
        const finalNy = ny * dl.offsetSide;

        for (let i = 0; i < dl.points.length - 1; i++) {
            const segP1 = dl.points[i];
            const segP2 = dl.points[i + 1];

            const visualP1 = { x: segP1.x + finalNx * offset, y: segP1.y + finalNy * offset };
            const visualP2 = { x: segP2.x + finalNx * offset, y: segP2.y + finalNy * offset };

            const seg_dx = segP2.x - segP1.x;
            const seg_dy = segP2.y - segP1.y;
            const seg_len = Math.sqrt(seg_dx*seg_dx + seg_dy*seg_dy);
            const seg_dir_x = seg_len > 0 ? seg_dx / seg_len : 0;
            const seg_dir_y = seg_len > 0 ? seg_dy / seg_len : 0;

            const drawP1 = { x: visualP1.x - seg_dir_x * lineExtension, y: visualP1.y - seg_dir_y * lineExtension };
            const drawP2 = { x: visualP2.x + seg_dir_x * lineExtension, y: visualP2.y + seg_dir_y * lineExtension };

            ctx.beginPath();
            ctx.moveTo(drawP1.x, drawP1.y);
            ctx.lineTo(drawP2.x, drawP2.y);
            ctx.stroke();

            const extDir1x = segP1.x - visualP1.x;
            const extDir1y = segP1.y - visualP1.y;
            const extDir1Len = Math.sqrt(extDir1x*extDir1x + extDir1y*extDir1y);
            const extDir1nx = extDir1Len > 0 ? extDir1x / extDir1Len : 0;
            const extDir1ny = extDir1Len > 0 ? extDir1y / extDir1Len : 0;
            const extStartP1 = { x: segP1.x - extDir1nx * extensionLineGap, y: segP1.y - extDir1ny * extensionLineGap };

            ctx.beginPath();
            ctx.moveTo(extStartP1.x, extStartP1.y);
            ctx.lineTo(visualP1.x, visualP1.y);
            ctx.stroke();

            const extDir2x = segP2.x - visualP2.x;
            const extDir2y = segP2.y - visualP2.y;
            const extDir2Len = Math.sqrt(extDir2x*extDir2x + extDir2y*extDir2y);
            const extDir2nx = extDir2Len > 0 ? extDir2x / extDir2Len : 0;
            const extDir2ny = extDir2Len > 0 ? extDir2y / extDir2Len : 0;
            const extStartP2 = { x: segP2.x - extDir2nx * extensionLineGap, y: segP2.y - extDir2ny * extensionLineGap };

            ctx.beginPath();
            ctx.moveTo(extStartP2.x, extStartP2.y);
            ctx.lineTo(visualP2.x, visualP2.y);
            ctx.stroke();

            if (seg_len > 1e-6) {
                const s_norm_x = seg_dx / seg_len;
                const s_norm_y = seg_dy / seg_len;

                const t1_x = finalNx + s_norm_x;
                const t1_y = finalNy + s_norm_y;
                const t1_len = Math.sqrt(t1_x * t1_x + t1_y * t1_y);
                const tick_dir_x = t1_len > 1e-6 ? t1_x / t1_len : 0;
                const tick_dir_y = t1_len > 1e-6 ? t1_y / t1_len : 0;

                const halfTick = scaledTickLength / 2;

                const originalLineWidth = ctx.lineWidth;
                ctx.lineWidth = 2.5 / transform.scale;

                ctx.beginPath();
                ctx.moveTo(visualP1.x - halfTick * tick_dir_x, visualP1.y - halfTick * tick_dir_y);
                ctx.lineTo(visualP1.x + halfTick * tick_dir_x, visualP1.y + halfTick * tick_dir_y);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(visualP2.x - halfTick * tick_dir_x, visualP2.y - halfTick * tick_dir_y);
                ctx.lineTo(visualP2.x + halfTick * tick_dir_x, visualP2.y + halfTick * tick_dir_y);
                ctx.stroke();

                ctx.lineWidth = originalLineWidth;
            }

            const textMidPoint = { x: (visualP1.x + visualP2.x) / 2, y: (visualP1.y + visualP2.y) / 2 };
            const textToDisplay = dl.customText || formatDimension(seg_len, currentUnit, false);
            ctx.save();
            ctx.translate(textMidPoint.x, textMidPoint.y);
            const angleRad = Math.atan2(visualP2.y - visualP1.y, visualP2.x - visualP1.x);
            let textAngle = angleRad;
            if (textAngle < -Math.PI / 2) textAngle += Math.PI;
            if (textAngle > Math.PI / 2) textAngle -= Math.PI;
            ctx.rotate(textAngle);
            ctx.fillText(textToDisplay, 0, -scaledFontSize * 0.3);
            ctx.restore();
        }

        if (isEditMode && (isSelected || isHovered || isDraggingVertex || isDraggingEntire)) {
            dl.points.forEach((vertex, vIdx) => {
                const isHoveredVertex = hoveredDimVertexInfo?.layerId === layerId && hoveredDimVertexInfo.dimensionLineIndexInLayer === dlIndex && hoveredDimVertexInfo.vertexIndex === vIdx;
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale * (isHoveredVertex ? 1.3 : 1), 0, 2 * Math.PI);
                ctx.fillStyle = isHoveredVertex ? 'rgba(59, 130, 246, 0.9)' : 'rgba(75, 85, 99, 0.7)';
                ctx.fill();
            });
        }
    });
};

export const drawDimensionPreview = (
    ctx: CanvasRenderingContext2D,
    startPoint: Point,
    endPoint: Point,
    offsetSide: number,
    transform: Transform,
    currentUnit: Unit,
    architecturalScale: number
) => {
    if (!startPoint || !endPoint) return;
    const dist = calculateDistance(startPoint, endPoint);
    if (dist < 1e-6) return;

    const currentArchScaleDenom = architecturalScale;
    if (currentArchScaleDenom > ANNOTATION_VISIBILITY_THRESHOLD_SCALE) return;

    const standardOffset = getPaperSpaceValueInWorldUnits(DIM_OFFSET_MM, currentArchScaleDenom);
    const lineExtension = getPaperSpaceValueInWorldUnits(DIM_EXTENSION_MM, currentArchScaleDenom);
    const extensionLineGap = getPaperSpaceValueInWorldUnits(DIM_EXTENSION_LINE_GAP_MM, currentArchScaleDenom);
    const scaledTickLength = getScaledScreenValue(BASE_DIMENSION_TICK_LENGTH_SCREEN_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX) / transform.scale;
    const scaledFontSize = getScaledScreenValue(BASE_DIMENSION_FONT_SIZE_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX);

    ctx.strokeStyle = 'rgba(75, 85, 99, 0.7)';
    ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
    ctx.lineWidth = 1 / transform.scale;
    ctx.font = `${scaledFontSize}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy/len;
    const ny = dx/len;

    const finalNx = nx * offsetSide;
    const finalNy = ny * offsetSide;

    const visualP1 = { x: startPoint.x + finalNx * standardOffset, y: startPoint.y + finalNy * standardOffset };
    const visualP2 = { x: endPoint.x + finalNx * standardOffset, y: endPoint.y + finalNy * standardOffset };

    const seg_dx = visualP2.x - visualP1.x;
    const seg_dy = visualP2.y - visualP1.y;
    const seg_len = Math.sqrt(seg_dx*seg_dx + seg_dy*seg_dy);
    const seg_dir_x = seg_len > 0 ? seg_dx / seg_len : 0;
    const seg_dir_y = seg_len > 0 ? seg_dy / seg_len : 0;

    const drawP1 = { x: visualP1.x - seg_dir_x * lineExtension, y: visualP1.y - seg_dir_y * lineExtension };
    const drawP2 = { x: visualP2.x + seg_dir_x * lineExtension, y: visualP2.y + seg_dir_y * lineExtension };

    ctx.beginPath();
    ctx.moveTo(drawP1.x, drawP1.y);
    ctx.lineTo(drawP2.x, drawP2.y);
    ctx.stroke();

    const extDir1x = startPoint.x - visualP1.x;
    const extDir1y = startPoint.y - visualP1.y;
    const extDir1Len = Math.sqrt(extDir1x*extDir1x + extDir1y*extDir1y);
    const extDir1nx = extDir1Len > 0 ? extDir1x / extDir1Len : 0;
    const extDir1ny = extDir1Len > 0 ? extDir1y / extDir1Len : 0;
    const extStartP1 = { x: startPoint.x - extDir1nx * extensionLineGap, y: startPoint.y - extDir1ny * extensionLineGap };

    ctx.beginPath();
    ctx.moveTo(extStartP1.x, extStartP1.y);
    ctx.lineTo(visualP1.x, visualP1.y);
    ctx.stroke();

    const extDir2x = endPoint.x - visualP2.x;
    const extDir2y = endPoint.y - visualP2.y;
    const extDir2Len = Math.sqrt(extDir2x*extDir2x + extDir2y*extDir2y);
    const extDir2nx = extDir2Len > 0 ? extDir2x / extDir2Len : 0;
    const extDir2ny = extDir2Len > 0 ? extDir2y / extDir2Len : 0;
    const extStartP2 = { x: endPoint.x - extDir2nx * extensionLineGap, y: endPoint.y - extDir2ny * extensionLineGap };

    ctx.beginPath();
    ctx.moveTo(extStartP2.x, extStartP2.y);
    ctx.lineTo(visualP2.x, visualP2.y);
    ctx.stroke();

    // Ticks
    const s_norm_x = seg_dir_x;
    const s_norm_y = seg_dir_y;

    const t1_x = finalNx + s_norm_x;
    const t1_y = finalNy + s_norm_y;
    const t1_len = Math.sqrt(t1_x * t1_x + t1_y * t1_y);
    const tick_dir_x = t1_len > 1e-6 ? t1_x / t1_len : 0;
    const tick_dir_y = t1_len > 1e-6 ? t1_y / t1_len : 0;

    const halfTick = scaledTickLength / 2;
    const originalLineWidth = ctx.lineWidth;
    ctx.lineWidth = 2.5 / transform.scale;
    ctx.beginPath();
    ctx.moveTo(visualP1.x - halfTick * tick_dir_x, visualP1.y - halfTick * tick_dir_y);
    ctx.lineTo(visualP1.x + halfTick * tick_dir_x, visualP1.y + halfTick * tick_dir_y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(visualP2.x - halfTick * tick_dir_x, visualP2.y - halfTick * tick_dir_y);
    ctx.lineTo(visualP2.x + halfTick * tick_dir_x, visualP2.y + halfTick * tick_dir_y);
    ctx.stroke();
    ctx.lineWidth = originalLineWidth;


    // Text
    const textMidPoint = { x: (visualP1.x + visualP2.x) / 2, y: (visualP1.y + visualP2.y) / 2 };
    const textToDisplay = formatDimension(dist, currentUnit, false);

    ctx.save();
    ctx.translate(textMidPoint.x, textMidPoint.y);
    const angleRad = Math.atan2(visualP2.y - visualP1.y, visualP2.x - visualP1.x);
    let textAngle = angleRad;
    if (textAngle < -Math.PI / 2) textAngle += Math.PI;
    if (textAngle > Math.PI / 2) textAngle -= Math.PI;
    ctx.rotate(textAngle);
    ctx.fillText(textToDisplay, 0, -scaledFontSize * 0.3);
    ctx.restore();
};

export const drawHighlights = (
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  layers: LayerData[],
  activeLayerId: string | null,
  currentPolygonPoints: Point[],
  previewLineEndPoint: Point | null,
  currentSnapInfo: CurrentSnapInfo | null,
  hoveredVertexInfo: HoveredVertexInfo | null,
  hoveredEdgeInfo: HoveredEdgeInfo | null,
  contextMenuState: ContextMenuState,
  draggingVertex: boolean,
  isDraggingEdge: boolean,
  selectedElementInfo: SelectedElementInfo | null,
  isEditMode: boolean,
  isDrawing: boolean,
  isSplitting: boolean,
  currentMode: Mode,
  currentDimensionStartPoint: Point | null,
  currentDimensionPreviewEndPoint: Point | null,
  hoveredDimensionLineInfo: HoveredDimensionLineInfo | null,
  hoveredDimensionVertexInfo: HoveredDimensionVertexInfo | null,
  draggingDimensionVertex: boolean,
  selectedDimensionVertexInfoInternal: SelectedDimensionVertexInfo | null,
  selectedOpeningWallInfo: SelectedOpeningWallInfo | null,
  openingFirstPoint: Point | null
) => {

  const drawSnapIndicator = (point: Point, color: string, type: SnapType) => {
    ctx.beginPath();
    const size = SNAP_INDICATOR_SIZE_SCREEN_PX / transform.scale;
    switch (type) {
      case SnapType.ENDPOINT_ROOM:
      case SnapType.ENDPOINT_DIM:
        ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
        break;
      case SnapType.MIDPOINT_ROOM:
      case SnapType.MIDPOINT_DIM:
        ctx.moveTo(point.x, point.y - size / 2);
        ctx.lineTo(point.x + size / 2, point.y + size / 2);
        ctx.lineTo(point.x - size / 2, point.y + size / 2);
        ctx.closePath();
        break;
      case SnapType.INTERSECTION_POINT:
         ctx.moveTo(point.x - size/2, point.y - size/2);
         ctx.lineTo(point.x + size/2, point.y + size/2);
         ctx.moveTo(point.x + size/2, point.y - size/2);
         ctx.lineTo(point.x - size/2, point.y + size/2);
        break;
      case SnapType.PERPENDICULAR_POINT:
        ctx.moveTo(point.x - size/2, point.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineTo(point.x, point.y + size/2);
        ctx.rect(point.x - size/2, point.y, size/2, size/2);
        break;
      default:
        ctx.arc(point.x, point.y, size / 2, 0, 2 * Math.PI);
        break;
    }
    ctx.fillStyle = color;
    ctx.fill();
  };

  if (currentSnapInfo) {
    let snapColor = SNAP_ON_LINE_COLOR;
    switch (currentSnapInfo.type) {
        case SnapType.ENDPOINT_ROOM:
        case SnapType.ENDPOINT_DIM:
            snapColor = SNAP_ENDPOINT_COLOR;
            break;
        case SnapType.MIDPOINT_ROOM:
        case SnapType.MIDPOINT_DIM:
            snapColor = SNAP_MIDPOINT_COLOR;
            break;
        case SnapType.GEOMETRIC_CENTER:
            snapColor = SNAP_CENTER_COLOR;
            break;
        case SnapType.INTERSECTION_POINT:
            snapColor = SNAP_INTERSECTION_COLOR;
            break;
        case SnapType.PERPENDICULAR_POINT:
            snapColor = SNAP_PERPENDICULAR_COLOR;
            break;
        case SnapType.LINE_EXTENSION_ROOM_WALL:
        case SnapType.LINE_EXTENSION_DIM:
        case SnapType.PARALLEL:
            snapColor = SNAP_LINE_EXTENSION_COLOR;
            break;
        case SnapType.ON_LINE:
        case SnapType.ON_SELECTED_EDGE:
            snapColor = SNAP_ON_LINE_COLOR;
            break;
        case SnapType.GRID:
            snapColor = SNAP_GRID_COLOR;
            break;
        case SnapType.ON_ROOM_PERIMETER:
            snapColor = SNAP_ON_ROOM_PERIMETER_COLOR;
            break;
    }
    drawSnapIndicator(currentSnapInfo.point, snapColor, currentSnapInfo.type);

    if (currentSnapInfo.type === SnapType.LINE_EXTENSION_ROOM_WALL || currentSnapInfo.type === SnapType.LINE_EXTENSION_DIM) {
        if (currentSnapInfo.relatedElements?.p1 && currentSnapInfo.relatedElements?.p2) {
            ctx.beginPath();
            ctx.moveTo(currentSnapInfo.relatedElements.p1.x, currentSnapInfo.relatedElements.p1.y);
            ctx.lineTo(currentSnapInfo.relatedElements.p2.x, currentSnapInfo.relatedElements.p2.y);
            ctx.strokeStyle = SNAP_LINE_EXTENSION_COLOR;
            ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
            ctx.lineWidth = 1 / transform.scale;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
     if (currentSnapInfo.type === SnapType.PARALLEL) {
        if (currentSnapInfo.relatedElements?.p1 && currentSnapInfo.relatedElements?.p2) {
            ctx.beginPath();
            ctx.moveTo(currentSnapInfo.relatedElements.p1.x, currentSnapInfo.relatedElements.p1.y);
            ctx.lineTo(currentSnapInfo.relatedElements.p2.x, currentSnapInfo.relatedElements.p2.y);
            ctx.strokeStyle = SNAP_LINE_EXTENSION_COLOR;
            ctx.lineWidth = 2 / transform.scale;
            ctx.stroke();
        }
    }
  }

  if (isEditMode && !isDrawing) {
      if (hoveredVertexInfo) {
          const layer = layers.find(l => l.id === hoveredVertexInfo.layerId);
          if (layer) {
              const room = layer.rooms[hoveredVertexInfo.roomIndexInLayer];
              const points = hoveredVertexInfo.pathIndex === 1 ? room.innerPoints : room.points;
              if (points) {
                  const vertex = points[hoveredVertexInfo.vertexIndex];
                  ctx.beginPath();
                  ctx.arc(vertex.x, vertex.y, VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale * 1.5, 0, 2 * Math.PI);
                  ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
                  ctx.fill();
              }
          }
      } else if (hoveredEdgeInfo) {
          const layer = layers.find(l => l.id === hoveredEdgeInfo.layerId);
          if(layer) {
              const room = layer.rooms[hoveredEdgeInfo.roomIndexInLayer];
              const points = hoveredEdgeInfo.pathIndex === 1 ? room.innerPoints : room.points;
              if (points && points.length >= 2) {
                const isPathOpen = !!(room.isWall && !room.innerPoints);
                const p1 = points[hoveredEdgeInfo.edgeIndex];
                const p2 = isPathOpen ? points[hoveredEdgeInfo.edgeIndex + 1] : points[(hoveredEdgeInfo.edgeIndex + 1) % points.length];
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
                ctx.lineWidth = 2.5 / transform.scale;
                ctx.stroke();
              }
          }
      }
  }

  if (selectedOpeningWallInfo) {
    ctx.beginPath();
    ctx.moveTo(selectedOpeningWallInfo.edgeP1.x, selectedOpeningWallInfo.edgeP1.y);
    ctx.lineTo(selectedOpeningWallInfo.edgeP2.x, selectedOpeningWallInfo.edgeP2.y);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.9)'; // amber-500
    ctx.lineWidth = 4 / transform.scale;
    ctx.stroke();
  }

  if (selectedElementInfo && isEditMode) {
      if (selectedElementInfo.elementType === 'room') {
          const layer = layers.find(l => l.id === selectedElementInfo!.layerId);
          if(layer) {
              const room = layer.rooms.find(r => r.id === selectedElementInfo!.elementId);
              if (room && room.isWall && !room.innerPoints) { // Open wall segment
                  const midpoints = getEdgeMidpoints(room.points, true);
                  midpoints.forEach(({point, edgeIndex}) => {
                      if (edgeIndex === (room.points.length / 2) - 1 || edgeIndex === room.points.length - 1) return;
                      ctx.beginPath();
                      ctx.arc(point.x, point.y, EDGE_MIDPOINT_RADIUS_SCREEN_PX / transform.scale, 0, 2 * Math.PI);
                      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
                      ctx.fill();
                  });
              } else if (room) { // Closed room or closed wall
                  const drawMidpointsForPath = (path: Point[]) => {
                      const midpoints = getEdgeMidpoints(path);
                      midpoints.forEach(({point}) => {
                          ctx.beginPath();
                          ctx.arc(point.x, point.y, EDGE_MIDPOINT_RADIUS_SCREEN_PX / transform.scale, 0, 2 * Math.PI);
                          ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
                          ctx.fill();
                      });
                  };
                  if (room.points) drawMidpointsForPath(room.points);
                  if (room.innerPoints) drawMidpointsForPath(room.innerPoints);
              }
          }
      }
  }
};

export const drawOpeningPreview = (
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  wallInfo: SelectedOpeningWallInfo,
  openingFirstPoint: Point | null,
  openingPreviewLine: {p1: Point, p2: Point} | null,
  previewEndPoint: Point | null,
  currentUnit: Unit,
  getScaledScreenValue: (base: number, scale: number, ref: number) => number,
  REFERENCE_ARCH_SCALE_DENOMINATOR: number
) => {
    if (!wallInfo) return;

    if (openingPreviewLine) {
        const {p1, p2} = openingPreviewLine;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = 'rgba(239, 68, 68, 1)'; // red-500
        ctx.lineWidth = 3 / transform.scale;
        ctx.stroke();

        const dist = calculateDistance(p1, p2);
        if (dist > 1e-6) {
          const text = formatDimension(dist, currentUnit);
          const scaledFontSize = getScaledScreenValue(BASE_DIMENSION_FONT_SIZE_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX);
          ctx.font = `${scaledFontSize}px Segoe UI, sans-serif`;
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const midPoint = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2};
          const dx = wallInfo.edgeP2.x - wallInfo.edgeP1.x;
          const dy = wallInfo.edgeP2.y - wallInfo.edgeP1.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          const nx = -dy/len;
          const ny = dx/len;

          const textOffset = 20 / transform.scale;
          const textPoint = { x: midPoint.x + nx * textOffset, y: midPoint.y + ny * textOffset };
          ctx.fillText(text, textPoint.x, textPoint.y);
        }

    } else if (previewEndPoint) {
        ctx.beginPath();
        ctx.arc(previewEndPoint.x, previewEndPoint.y, VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; // red-500
        ctx.fill();
    }
};
