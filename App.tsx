// Application file reviewed
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Point, Room, Unit, Mode, Transform, SelectedElementInfo, HoveredVertexInfo, HoveredEdgeInfo, EditingRoomNameInfo, ContextTarget, DistanceInputState, ContextMenuState, AlertModalState, RoomBoundingBox, DimensionLine, AppStateSnapshot, WallAlignment, HoveredDimensionLineInfo, EditingDimensionOffsetInfo, SelectedDimensionVertexInfo, HoveredDimensionVertexInfo, DragEntireDimensionLineInfo, SnapType, CurrentSnapInfo, LayerData, OsnapType, FloatingPanelState, PanelId, UndoRedoPanelProps, ModeButtonPanelProps, LayersTogglePanelProps, GridSnapPanelProps, ToggleButtonPanelProps, AngleSnapPanelProps, OsnapSettingsPanelProps, WallThicknessPanelProps, WallAlignmentPanelProps, UnitsScalePanelProps, FloatingPanelConfig, SelectedOpeningWallInfo, Guideline, GuidelineSettingsPanelProps, Door, DoorPropertiesPanelProps } from './types';
import { UNITS_PER_METER, DEFAULT_GRID_SPACING_WORLD_UNITS, POINT_SNAP_THRESHOLD_GRID_FACTOR, VERTEX_RENDER_RADIUS_SCREEN_PX, EDGE_HOVER_THRESHOLD_SCREEN_PX, ANGLES_TO_SNAP_DEGREES, ANGLE_SNAP_THRESHOLD_DEGREES, ARCHITECTURAL_SCALES, REFERENCE_ARCH_SCALE_DENOMINATOR, MAX_HISTORY_SIZE, ABNT_REF_HEIGHT_MM, BASE_LABEL_FONT_SIZE_PX, VISIBILITY_SCALE_EXPONENT, DEFAULT_WALL_THICKNESS_WORLD_UNITS, EDGE_MIDPOINT_RADIUS_SCREEN_PX, ANNOTATION_VISIBILITY_THRESHOLD_SCALE, BASE_DIMENSION_TEXT_OFFSET_SCREEN_PX, BASE_DIMENSION_FONT_SIZE_PX, LINE_EXTENSION_SNAP_THRESHOLD_FACTOR, LINE_EXTENSION_RENDER_FACTOR, PARALLEL_ANGLE_THRESHOLD_DEGREES, PERPENDICULAR_SNAP_THRESHOLD_FACTOR, DEFAULT_GUIDELINE_COUNT, DEFAULT_GUIDELINE_DISTANCE_WORLD_UNITS, DEFAULT_DOOR_WIDTH_WORLD_UNITS } from './constants';
import CanvasComponent from './components/CanvasComponent';
import StatusBar from './components/StatusBar';
import Modal from './components/Modal';
import DistanceInputComponent from './components/DistanceInput';
import ContextMenuComponent from './components/ContextMenu';
import RoomNameInputComponent from './components/RoomNameInput';
import DimensionOffsetInputComponent from './components/DimensionOffsetInput';
import LayerPanel from './components/LayerPanel';
import FloatingPanelWrapper from './components/FloatingPanelWrapper';
import { TopRightControls, WallThicknessControl, WallAlignmentButtons, GuidelineSettingsControl, DoorPropertiesControl } from './components/TopBar';
import LeftBarFixed from './components/LeftBarFixed';
import BottomBarFixed from './components/BottomBarFixed';
import { 
    calculatePolygonArea, calculateCentroid, isPointInPolygon, distancePointToSegment, 
    getRoomBoundingBox, toDegrees, toRadians, 
    distance as calculateDistance, calculateSignedPolygonAreaTwice, getEdgeMidpoints, 
    offsetPath, closestPointOnInfiniteLine, isPointLeftOfLine_crossProduct, 
    closestPointOnSegment, getLineIntersection, projectPointToLine, isPointOnLineSegment,
    getAbntHeightMm, getScaledScreenValue, formatDimension,
    convertValueToWorldUnits, convertWorldUnitsToDisplayUnit,
    findOppositeEdgeAndIndex
} from './utils';


const DRAWING_SEARCH_RADIUS_WORLD = UNITS_PER_METER * 4;
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;


const findParallelSnap = (
  cursorOriginalPos: Point, 
  segmentStartPoint: Point,
  layersToSearch: LayerData[],
  parallelAngleThresholdRad: number,
  activeLayerIdForSnap: string 
): CurrentSnapInfo | null => {
  let bestParallelSnap: CurrentSnapInfo | null = null;
  let minAngleDifference = parallelAngleThresholdRad;

  const currentSegmentVector = { x: cursorOriginalPos.x - segmentStartPoint.x, y: cursorOriginalPos.y - segmentStartPoint.y };
  const currentSegmentOriginalAngle = Math.atan2(currentSegmentVector.y, currentSegmentVector.x);
  const currentSegmentOriginalLength = Math.sqrt(currentSegmentVector.x**2 + currentSegmentVector.y**2);

  if (currentSegmentOriginalLength < 1e-6) return null;

  layersToSearch.forEach(layer => {
    if (!layer.isVisible || layer.isLocked) return;

    const checkSegmentsForParallel = (points: Point[], isSegmentType: boolean, elementId: number, elementType: 'room' | 'wall' | 'dimension') => {
      const limit = isSegmentType ? points.length - 1 : points.length;
      for (let i = 0; i < limit; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        const refSegmentVector = { x: p2.x - p1.x, y: p2.y - p1.y };
        if (Math.sqrt(refSegmentVector.x**2 + refSegmentVector.y**2) < 1e-6) continue;

        const refSegmentAngle = Math.atan2(refSegmentVector.y, refSegmentVector.x);
        
        let angleDiffPrimary = Math.abs(currentSegmentOriginalAngle - refSegmentAngle);
        while (angleDiffPrimary > Math.PI) angleDiffPrimary -= Math.PI * 2; 
        angleDiffPrimary = Math.abs(angleDiffPrimary);

        let angleDiffAlternate = Math.abs(currentSegmentOriginalAngle - (refSegmentAngle + Math.PI));
        while (angleDiffAlternate > Math.PI) angleDiffAlternate -= Math.PI * 2;
        angleDiffAlternate = Math.abs(angleDiffAlternate);
        
        const effectiveAngleDiff = Math.min(angleDiffPrimary, angleDiffAlternate);

        if (effectiveAngleDiff < minAngleDifference) {
          minAngleDifference = effectiveAngleDiff;
          
          let snappedAngle = refSegmentAngle;
          if (angleDiffAlternate < angleDiffPrimary) {
             snappedAngle = refSegmentAngle + Math.PI;
          }
          
          const snappedEndPoint = {
            x: segmentStartPoint.x + Math.cos(snappedAngle) * currentSegmentOriginalLength,
            y: segmentStartPoint.y + Math.sin(snappedAngle) * currentSegmentOriginalLength,
          };

          bestParallelSnap = {
            point: snappedEndPoint,
            type: SnapType.PARALLEL,
            layerId: layer.id, 
            relatedElements: { p1: {...p1}, p2: {...p2}, angle: snappedAngle, elementId, elementType },
            displayText: `Parallel`,
          };
        }
      }
    };

    (layer.rooms || []).forEach(room => checkSegmentsForParallel(room.points || [], !!room.isSegment, room.id, room.isWall ? 'wall' : 'room'));
    (layer.dimensionLines || []).forEach(dl => {
      if ((dl.points || []).length >= 2) {
        checkSegmentsForParallel([dl.points[0], dl.points[dl.points.length-1]], true, dl.id, 'dimension');
      }
    });
  });

  return bestParallelSnap;
};


export function App(): JSX.Element {
  const initialBaseLayerId = generateId();
  
  const initialLayers: LayerData[] = [
    { id: initialBaseLayerId, name: 'Base Layer', rooms: [], dimensionLines: [], guidelines: [], doors: [], nextRoomId: 1, nextDimensionId: 1, nextGuidelineId: 1, nextDoorId: 1, isVisible: true, isLocked: false, opacity: 1.0 },
    { id: generateId(), name: 'Furniture Layer', rooms: [], dimensionLines: [], guidelines: [], doors: [], nextRoomId: 1, nextDimensionId: 1, nextGuidelineId: 1, nextDoorId: 1, isVisible: true, isLocked: false, opacity: 1.0 },
  ];

  const [layers, setLayers] = useState<LayerData[]>(initialLayers);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(initialBaseLayerId);
  
  const [currentMode, setCurrentMode] = useState<Mode>(Mode.Idle);
  
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState<Point[]>([]);
  const [previewLineEndPoint, setPreviewLineEndPoint] = useState<Point | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentDimensionStartPoint, setCurrentDimensionStartPoint] = useState<Point | null>(null);
  const [currentDimensionPreviewEndPoint, setCurrentDimensionPreviewEndPoint] = useState<Point | null>(null);
  const [currentDimensionOffsetSidePreview, setCurrentDimensionOffsetSidePreview] = useState<number>(1);
  const [extendingDimensionInfo, setExtendingDimensionInfo] = useState<{ layerId: string; elementId: number; fromVertexIndex: number; } | null>(null);

  const [isOrthogonalMode, setIsOrthogonalMode] = useState<boolean>(true);
  const [isAngleSnapActive, setIsAngleSnapActive] = useState<boolean>(false);
  const [isGridSnapActive, setIsGridSnapActive] = useState<boolean>(true);
  const [isGridVisible, setIsGridVisible] = useState<boolean>(true); 
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.Meters);
  
  const [selectedElementInfo, setSelectedElementInfo] = useState<SelectedElementInfo | null>(null);
  
  const [draggingVertex, setDraggingVertex] = useState<boolean>(false); 
  const [isDraggingRoom, setIsDraggingRoom] = useState<boolean>(false);
  const [initialDragMousePos, setInitialDragMousePos] = useState<Point | null>(null);
  
  const [transform, setTransform] = useState<Transform>({ scale: 1.0, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [lastPanPosition, setLastPanPosition] = useState<Point>({ x: 0, y: 0 });
  const [lastMouseWorldPos, setLastMouseWorldPos] = useState<Point & { screenX?: number, screenY?: number }>({ x: 0, y: 0 });
  const [currentWallAlignment, setCurrentWallAlignment] = useState<WallAlignment>(WallAlignment.Centered);
  const [userGridSpacing, setUserGridSpacing] = useState<number>(DEFAULT_GRID_SPACING_WORLD_UNITS);
  const [statusMessage, setStatusMessage] = useState<{ text: string, id: number } | null>(null);
  const [currentScaleDisplayText, setCurrentScaleDisplayText] = useState<string>(`Scale: 1:${REFERENCE_ARCH_SCALE_DENOMINATOR}`);

  const [alertModalState, setAlertModalState] = useState<AlertModalState>({ show: false, message: '' });
  const [distanceInputState, setDistanceInputState] = useState<DistanceInputState>({ show: false, x: 0, y: 0, value: '', angle: 0, unit: Unit.Meters });
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({ show: false, x: 0, y: 0, target: null });
  const [customAngle, setCustomAngle] = useState<string>('');
  const [architecturalScale, setArchitecturalScale] = useState<number>(REFERENCE_ARCH_SCALE_DENOMINATOR);
  const [isSplittingAttemptActive, setIsSplittingAttemptActive] = useState<boolean>(false);
  const [divisionLinePoints, setDivisionLinePoints] = useState<Point[]>([]);
  const [divisionPreviewLineEndPoint, setDivisionPreviewLineEndPoint] = useState<Point | null>(null);
  const [editingRoomNameInfo, setEditingRoomNameInfo] = useState<EditingRoomNameInfo | null>(null);
  const [editingDimensionOffsetInfo, setEditingDimensionOffsetInfo] = useState<EditingDimensionOffsetInfo | null>(null);
  
  const [hoveredVertexInfo, setHoveredVertexInfo] = useState<HoveredVertexInfo | null>(null); 
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<HoveredEdgeInfo | null>(null); 
  const [hoveredRoomIndexInActiveLayer, setHoveredRoomIndexInActiveLayer] = useState<number | null>(null); 
  const [hoveredLabelRoomIndexInActiveLayer, setHoveredLabelRoomIndexInActiveLayer] = useState<number | null>(null); 

  const [currentSnapInfo, setCurrentSnapInfo] = useState<CurrentSnapInfo | null>(null); 
  const [isDraggingEdge, setIsDraggingEdge] = useState<boolean>(false); 

  const [currentWallThickness, setCurrentWallThickness] = useState<number>(DEFAULT_WALL_THICKNESS_WORLD_UNITS);
  const [visualCursorWorldPos, setVisualCursorWorldPos] = useState<Point | null>(null);
  const [viewInitializedOnLoad, setViewInitializedOnLoad] = useState(false);
  
  const [hoveredDimensionLineInfo, setHoveredDimensionLineInfo] = useState<HoveredDimensionLineInfo | null>(null); 
  const [hoveredDimensionVertexInfo, setHoveredDimensionVertexInfo] = useState<HoveredDimensionVertexInfo | null>(null); 
  const [isDraggingDimensionLineOffset, setIsDraggingDimensionLineOffset] = useState<boolean>(false); 
  const [draggedDimensionLineOffsetInfo, setDraggedDimensionLineOffsetInfo] = useState<{ layerId: string; indexInLayer: number; originalPoints: Point[]; } | null>(null); 
  const [selectedDimensionVertexInfoInternal, setSelectedDimensionVertexInfoInternal] = useState<SelectedDimensionVertexInfo | null>(null); 
  const [draggingDimensionVertex, setDraggingDimensionVertex] = useState<boolean>(false); 
  const [isDraggingEntireDimensionLine, setIsDraggingEntireDimensionLine] = useState<boolean>(false); 
  const [draggedEntireDimensionLineInfo, setDraggedEntireDimensionLineInfo] = useState<DragEntireDimensionLineInfo | null>(null); 

  const [osnapSettings, setOsnapSettings] = useState<Record<OsnapType, boolean>>({
    [OsnapType.ENDPOINT]: false,
    [OsnapType.MIDPOINT]: false,
    [OsnapType.CENTER]: false,
    [OsnapType.INTERSECTION]: false,
    [OsnapType.PERPENDICULAR]: false,
    [OsnapType.NEAREST]: false,
    [OsnapType.EXTENSION]: false, 
    [OsnapType.PARALLEL]: false,  
  });
  
  // Opening tool state
  const [selectedOpeningWallInfo, setSelectedOpeningWallInfo] = useState<SelectedOpeningWallInfo | null>(null);
  const [openingFirstPoint, setOpeningFirstPoint] = useState<Point | null>(null);
  const [openingPreviewLine, setOpeningPreviewLine] = useState<{p1: Point, p2: Point} | null>(null);
  
  // Guideline tool state
  const [isMultiGuideMode, setIsMultiGuideMode] = useState<boolean>(false);
  const [multiGuideCount, setMultiGuideCount] = useState<number>(DEFAULT_GUIDELINE_COUNT);
  const [multiGuideDistance, setMultiGuideDistance] = useState<number>(DEFAULT_GUIDELINE_DISTANCE_WORLD_UNITS);
  const [drawingGuidelineStartPoint, setDrawingGuidelineStartPoint] = useState<Point | null>(null);
  const [activeToolPanelAnchorRect, setActiveToolPanelAnchorRect] = useState<DOMRect | null>(null);


  const initialOsnapSettingsForHistory = { ...osnapSettings };
  const initialHistorySnapshot: AppStateSnapshot = {
    layers: initialLayers.map(l => ({...l, rooms: [], dimensionLines: [], guidelines: [], doors: [] })),
    activeLayerId: initialBaseLayerId,
    currentWallAlignment: WallAlignment.Centered, userGridSpacing: DEFAULT_GRID_SPACING_WORLD_UNITS,
    osnapSettings: initialOsnapSettingsForHistory,
    isMultiGuideMode: false,
    multiGuideCount: DEFAULT_GUIDELINE_COUNT,
    multiGuideDistance: DEFAULT_GUIDELINE_DISTANCE_WORLD_UNITS,
  };
  const [historyStack, setHistoryStack] = useState<AppStateSnapshot[]>([initialHistorySnapshot]);
  const [redoStack, setRedoStack] = useState<AppStateSnapshot[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const lockedOrthoAxisRef = useRef<'H' | 'V' | null>(null);
  const editingRoomNameInputRef = useRef<HTMLInputElement>(null);
  const editingDimensionOffsetInputRef = useRef<HTMLInputElement>(null);
  const justPlacedNumericallyRef = useRef(false); // Ref to track if last point was numeric

  // Basic utility Callbacks (defined early)
  const getActiveLayer = useCallback(() => layers.find(l => l.id === activeLayerId), [layers, activeLayerId]);
  const updateActiveLayer = useCallback((updater: (prevLayerData: LayerData) => LayerData) => { setLayers(prevLayers => prevLayers.map(l => l.id === activeLayerId ? updater(l) : l)); }, [activeLayerId]);
  const updateLayerById = useCallback((layerId: string, updater: (prevLayerData: LayerData) => LayerData) => { setLayers(prevLayers => prevLayers.map(l => l.id === layerId ? updater(l) : l)); }, []);
  const showSimpleAlert = useCallback((message: string) => { setAlertModalState({ show: true, message }); }, []);
  const displayStatusMessage = useCallback((message: string, duration: number = 3000) => { if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current); setStatusMessage({ text: message, id: Date.now() }); if (duration > 0) { statusTimeoutRef.current = window.setTimeout(() => setStatusMessage(null), duration); } }, []);
  const hideStatusMessage = useCallback(() => { if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current); setStatusMessage(null); }, []);
  const handleToggleOsnap = useCallback((type: OsnapType) => { setOsnapSettings(prev => ({ ...prev, [type]: !prev[type] })); }, []);
  const handleTogglePanelVisibility = useCallback((id: PanelId) => { setPanelStates(prevStates => prevStates.map(p => { if (p.id === id) { const newVisibility = !p.isVisible; return { ...p, isVisible: newVisibility, zIndex: newVisibility ? Math.max(0,...prevStates.map(ps => ps.zIndex)) + 1 : p.zIndex }; } return p; })); }, []);
  const handleSetArchitecturalScaleDenominator = useCallback((denominator: number) => { if (!canvasRef.current || denominator <= 0) return; const targetTransformScale = REFERENCE_ARCH_SCALE_DENOMINATOR / denominator; const newScale = Math.max( REFERENCE_ARCH_SCALE_DENOMINATOR / ARCHITECTURAL_SCALES[ARCHITECTURAL_SCALES.length - 1], Math.min(targetTransformScale, REFERENCE_ARCH_SCALE_DENOMINATOR / ARCHITECTURAL_SCALES[0]) ); const canvas = canvasRef.current; if (canvas.width === 0 || canvas.height === 0) { console.warn("Cannot set architectural scale, canvas dimensions are zero."); return; } const canvasCenterX = canvas.width / 2; const canvasCenterY = canvas.height / 2; setTransform(prevTransform => { const worldCenterX_at_canvas_center = (canvasCenterX / prevTransform.scale) - prevTransform.panX; const worldCenterY_at_canvas_center = (canvasCenterY / prevTransform.scale) - prevTransform.panY; const newPanX = (canvasCenterX / newScale) - worldCenterX_at_canvas_center; const newPanY = (canvasCenterY / newScale) - worldCenterY_at_canvas_center; return { scale: newScale, panX: newPanX, panY: newPanY }; }); setArchitecturalScale(denominator); }, [canvasRef]); 

  const toScreen = useCallback((worldPoint: Point): Point => { if (!canvasRef.current || transform.scale <= 0) return { x: 0, y: 0 }; return { x: (worldPoint.x + transform.panX) * transform.scale, y: (worldPoint.y + transform.panY) * transform.scale }; }, [transform]);
  const toWorld = useCallback((screenPoint: Point): Point => { const canvas = canvasRef.current; if (!canvas || canvas.width === 0 || canvas.height === 0 || transform.scale <= 0) return { x: 0, y: 0 }; const rect = canvas.getBoundingClientRect(); return { x: (screenPoint.x - rect.left) / transform.scale - transform.panX, y: (screenPoint.y - rect.top) / transform.scale - transform.panY }; }, [transform, canvasRef]);
  const snapToGrid = useCallback((worldX: number, worldY: number): Point => { if (!isGridSnapActive || userGridSpacing <= 0) return { x: worldX, y: worldY }; return { x: Math.round(worldX / userGridSpacing) * userGridSpacing, y: Math.round(worldY / userGridSpacing) * userGridSpacing }; }, [isGridSnapActive, userGridSpacing]);

  const resetDimensionState = useCallback(() => {
    setExtendingDimensionInfo(null);
    setCurrentDimensionStartPoint(null);
    setCurrentDimensionPreviewEndPoint(null);
    lockedOrthoAxisRef.current = null;
  }, []);

  // Callbacks with dependencies on basic utilities
  const deselectAll = useCallback(() => {
    if (editingRoomNameInfo) setEditingRoomNameInfo(null);
    if (editingDimensionOffsetInfo) setEditingDimensionOffsetInfo(null);
    
    if (selectedElementInfo) {
      if (selectedElementInfo.elementType === 'room') {
        updateLayerById(selectedElementInfo.layerId, layer => ({
          ...layer,
          rooms: (layer.rooms || []).map((room) => 
             room.id === selectedElementInfo.elementId ? { ...room, isSelected: false } : room
          )
        }));
      } else if (selectedElementInfo.elementType === 'dimension') {
         updateLayerById(selectedElementInfo.layerId, layer => ({
          ...layer,
          dimensionLines: (layer.dimensionLines || []).map((dl) => 
            dl.id === selectedElementInfo.elementId ? { ...dl, isSelected: false } : dl
          )
        }));
      } else if (selectedElementInfo.elementType === 'door') {
         updateLayerById(selectedElementInfo.layerId, layer => ({
          ...layer,
          doors: (layer.doors || []).map((door) => 
            door.id === selectedElementInfo.elementId ? { ...door, isSelected: false } : door
          )
        }));
      }
    }
    setSelectedElementInfo(null);

    setIsSplittingAttemptActive(false); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); 
    hideStatusMessage(); setDistanceInputState(p => ({ ...p, show: false })); 
    setContextMenuState(p => ({ ...p, show: false })); 
    lockedOrthoAxisRef.current = null;
    setIsDraggingEntireDimensionLine(false); setDraggedEntireDimensionLineInfo(null);
    setCurrentSnapInfo(null); 
    setSelectedOpeningWallInfo(null); setOpeningFirstPoint(null); setOpeningPreviewLine(null);
    setDrawingGuidelineStartPoint(null);
    resetDimensionState();
  }, [editingRoomNameInfo, editingDimensionOffsetInfo, selectedElementInfo, updateLayerById, hideStatusMessage, resetDimensionState]);

  const addStateToHistory = useCallback((
    currentLayers: LayerData[],
    currentActiveLayerId: string | null,
    currentWallAlignmentState: WallAlignment,
    currentUserGridSpacing: number,
    currentOsnapSettings: Record<OsnapType, boolean>,
    currentIsMultiGuideMode: boolean,
    currentMultiGuideCount: number,
    currentMultiGuideDistance: number
  ) => {
    setHistoryStack(prevStack => {
      const snapshot: AppStateSnapshot = {
        layers: currentLayers.map(layer => ({ 
          ...layer, 
          rooms: (layer.rooms || []).map(room => ({ 
              ...room, 
              points: (room.points || []).map(p => ({ ...p })),
              innerPoints: (room.innerPoints || [])?.map(p => ({ ...p })),
            })),
          dimensionLines: (layer.dimensionLines || []).map(dl => ({ ...dl, points: (dl.points || []).map(p => ({...p})) })),
          guidelines: (layer.guidelines || []).map(g => ({ ...g, points: [{...g.points[0]}, {...g.points[1]}] })),
          doors: (layer.doors || []).map(d => ({ ...d, center: {...d.center}, wallVector: {...d.wallVector} })),
        })),
        activeLayerId: currentActiveLayerId,
        currentWallAlignment: currentWallAlignmentState, 
        userGridSpacing: currentUserGridSpacing,
        osnapSettings: {...currentOsnapSettings},
        isMultiGuideMode: currentIsMultiGuideMode,
        multiGuideCount: currentMultiGuideCount,
        multiGuideDistance: currentMultiGuideDistance,
      };
      if (prevStack.length > 0) {
        const lastSnapshotForComparison = prevStack[prevStack.length - 1];
        if (lastSnapshotForComparison.layers.length === snapshot.layers.length &&
            lastSnapshotForComparison.activeLayerId === snapshot.activeLayerId &&
            JSON.stringify(lastSnapshotForComparison) === JSON.stringify(snapshot)) { 
          return prevStack;
        }
      }
      const newStack = [...prevStack, snapshot];
      return newStack.length > MAX_HISTORY_SIZE ? newStack.slice(1) : newStack;
    });
    setRedoStack([]);
  }, []);

  const restoreStateFromSnapshot = useCallback((snapshot: AppStateSnapshot) => {
    setLayers(snapshot.layers.map(layer => ({
        ...layer,
        rooms: (layer.rooms || []).map(room => ({ 
            ...room, 
            points: (room.points || []).map(p => ({ ...p })),
            innerPoints: (room.innerPoints || [])?.map(p => ({ ...p })),
        })),
        dimensionLines: (layer.dimensionLines || []).map(dl => ({ ...dl, points: (dl.points || []).map(p => ({...p})) })),
        guidelines: (layer.guidelines || []).map(g => ({ ...g, points: [{...g.points[0]}, {...g.points[1]}] })),
        doors: (layer.doors || []).map(d => ({ ...d, center: {...d.center}, wallVector: {...d.wallVector} })),
    })));
    setActiveLayerId(snapshot.activeLayerId || (initialLayers.length > 0 ? initialLayers[0].id : null)); 
    setCurrentWallAlignment(snapshot.currentWallAlignment); 
    setUserGridSpacing(snapshot.userGridSpacing);
    if(snapshot.osnapSettings) setOsnapSettings(snapshot.osnapSettings);
    setIsMultiGuideMode(snapshot.isMultiGuideMode ?? false);
    setMultiGuideCount(snapshot.multiGuideCount ?? DEFAULT_GUIDELINE_COUNT);
    setMultiGuideDistance(snapshot.multiGuideDistance ?? DEFAULT_GUIDELINE_DISTANCE_WORLD_UNITS);
    
    setSelectedElementInfo(null);
    setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null);
    setCurrentDimensionStartPoint(null); setCurrentDimensionPreviewEndPoint(null);
    setDistanceInputState(p => ({ ...p, show: false })); setIsSplittingAttemptActive(false);
    setEditingRoomNameInfo(null); setEditingDimensionOffsetInfo(null); hideStatusMessage(); 
    lockedOrthoAxisRef.current = null;
    setIsDraggingEntireDimensionLine(false); setDraggedEntireDimensionLineInfo(null);
    setCurrentSnapInfo(null); 
    setSelectedOpeningWallInfo(null); setOpeningFirstPoint(null); setOpeningPreviewLine(null);
    setDrawingGuidelineStartPoint(null);
    resetDimensionState();
  }, [ hideStatusMessage, resetDimensionState ]); 

  const undo = useCallback(() => { if (historyStack.length > 1) { const currentState = historyStack[historyStack.length - 1]; setRedoStack(prev => [currentState, ...prev]); const previousState = historyStack[historyStack.length - 2]; restoreStateFromSnapshot(previousState); setHistoryStack(prev => prev.slice(0, -1)); } }, [historyStack, restoreStateFromSnapshot]);
  const redo = useCallback(() => { if (redoStack.length > 0) { const nextState = redoStack[0]; setHistoryStack(prev => [...prev, nextState]); restoreStateFromSnapshot(nextState); setRedoStack(prev => prev.slice(1)); } }, [redoStack, restoreStateFromSnapshot]);

  // Core interaction logic callbacks
  const handleSetMode = useCallback((requestedMode: Mode, buttonElement?: HTMLElement) => {
    if (buttonElement) {
        setActiveToolPanelAnchorRect(buttonElement.getBoundingClientRect());
    } else if (currentMode === requestedMode) {
        setActiveToolPanelAnchorRect(null);
    }
    
    if (currentMode === requestedMode) {
        if (requestedMode !== Mode.Idle && requestedMode !== Mode.Edit && requestedMode !== Mode.Opening && requestedMode !== Mode.Door) {
            setCurrentMode(Mode.Idle);
            displayStatusMessage("Mode: Idle");
        } else {
            displayStatusMessage(`Mode: ${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}`);
        }
    } else {
       setCurrentMode(requestedMode);
       displayStatusMessage(`Mode set to: ${requestedMode.charAt(0).toUpperCase() + requestedMode.slice(1)}`);
    }

    if (currentMode !== requestedMode || (currentMode === requestedMode && requestedMode !== Mode.Idle && requestedMode !== Mode.Edit && requestedMode !== Mode.Opening && requestedMode !== Mode.Door) ) {
        if (isDrawing) { setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null); }
        if (currentDimensionStartPoint) { resetDimensionState(); }
        if (drawingGuidelineStartPoint) { setDrawingGuidelineStartPoint(null); }
        if (isSplittingAttemptActive) { setIsSplittingAttemptActive(false); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); }
        
        setSelectedOpeningWallInfo(null);
        setOpeningFirstPoint(null);
        setOpeningPreviewLine(null);
        setDistanceInputState(p => ({ ...p, show: false, value:'' }));
        lockedOrthoAxisRef.current = null;

        if (requestedMode !== Mode.Edit) {
            deselectAll();
        } else {
            hideStatusMessage();
        }
    }
  }, [
      currentMode, isDrawing, currentDimensionStartPoint, selectedElementInfo, 
      isSplittingAttemptActive, drawingGuidelineStartPoint,
      deselectAll, 
      hideStatusMessage, displayStatusMessage,
      setIsDrawing, setCurrentPolygonPoints, setPreviewLineEndPoint, 
      resetDimensionState,
      setCurrentMode, setDistanceInputState,
      setIsSplittingAttemptActive, setDivisionLinePoints, setDivisionPreviewLineEndPoint,
      setSelectedOpeningWallInfo, setOpeningFirstPoint, setOpeningPreviewLine
  ]);

  const handleSetMultiGuideMode = useCallback((value: boolean, buttonElement?: HTMLElement) => {
    setIsMultiGuideMode(value);
    if (buttonElement) {
        setActiveToolPanelAnchorRect(buttonElement.getBoundingClientRect());
    }
  }, []);
  
  const handleLayerAction = useCallback((
    action: 'add' | 'delete' | 'setActive' | 'toggleVisibility' | 'toggleLock' | 'rename' | 'reorder',
    payload?: any
  ) => {
    const currentLayersSnapshot = layers; 
    const currentActiveLayerIdSnapshot = activeLayerId; 

    let nextLayersState = currentLayersSnapshot;
    let nextActiveLayerIdState = currentActiveLayerIdSnapshot;

    switch (action) {
      case 'add': {
        const newLayerId = generateId();
        let newLayerName = `Layer ${currentLayersSnapshot.length + 1}`;
        let count = currentLayersSnapshot.length + 1;
        while (currentLayersSnapshot.some(l => l.name === newLayerName)) {
            count++;
            newLayerName = `Layer ${count}`;
        }
        const newLayer: LayerData = {
          id: newLayerId,
          name: newLayerName,
          rooms: [],
          dimensionLines: [],
          guidelines: [],
          doors: [],
          nextRoomId: 1,
          nextDimensionId: 1,
          nextGuidelineId: 1,
          nextDoorId: 1,
          isVisible: true,
          isLocked: false,
          opacity: 1.0,
        };
        nextLayersState = [newLayer, ...currentLayersSnapshot]; 
        nextActiveLayerIdState = newLayerId;
        break;
      }
      case 'delete': {
        const layerIdToDelete = payload.layerId;
        if (!layerIdToDelete) {
            console.error("Layer delete action called without layerId payload.");
            return; 
        }

        const newLayersArray = currentLayersSnapshot.filter(l => l.id !== layerIdToDelete);
        nextLayersState = newLayersArray;

        if (currentActiveLayerIdSnapshot === layerIdToDelete) {
          nextActiveLayerIdState = newLayersArray.length > 0 ? newLayersArray[0].id : null;
        } else {
          if (newLayersArray.length > 0 && !newLayersArray.find(l => l.id === currentActiveLayerIdSnapshot)) {
            nextActiveLayerIdState = newLayersArray[0].id; 
          } else if (newLayersArray.length === 0) {
            nextActiveLayerIdState = null;
          }
        }
        
        if (selectedElementInfo?.layerId === layerIdToDelete) {
          deselectAll(); 
        }
        if (selectedOpeningWallInfo?.layerId === layerIdToDelete) {
            setSelectedOpeningWallInfo(null);
            setOpeningFirstPoint(null);
            setOpeningPreviewLine(null);
        }
        break;
      }
      case 'setActive': {
        if (payload.layerId !== currentActiveLayerIdSnapshot) {
          nextActiveLayerIdState = payload.layerId;
           if (selectedElementInfo) deselectAll(); 
           if (selectedOpeningWallInfo) {
               setSelectedOpeningWallInfo(null);
               setOpeningFirstPoint(null);
               setOpeningPreviewLine(null);
           }
        } else {
            return; 
        }
        break; 
      }
      case 'toggleVisibility': {
        nextLayersState = currentLayersSnapshot.map(l =>
          l.id === payload.layerId ? { ...l, isVisible: !l.isVisible } : l
        );
        break;
      }
      case 'toggleLock': {
        nextLayersState = currentLayersSnapshot.map(l =>
          l.id === payload.layerId ? { ...l, isLocked: !l.isLocked } : l
        );
        const toggledLayer = nextLayersState.find(l => l.id === payload.layerId);
        if (payload.layerId === currentActiveLayerIdSnapshot && toggledLayer?.isLocked) {
           if (isDrawing) {
               setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null);
               setDistanceInputState(p => ({ ...p, show: false, value:'' }));
           }
           if (currentDimensionStartPoint) {
               resetDimensionState();
               setDistanceInputState(p => ({ ...p, show: false, value:'' }));
           }
           if (selectedOpeningWallInfo || openingFirstPoint) {
                setSelectedOpeningWallInfo(null);
                setOpeningFirstPoint(null);
                setOpeningPreviewLine(null);
           }
           if (drawingGuidelineStartPoint) {
                setDrawingGuidelineStartPoint(null);
           }
           deselectAll();
           if (currentMode !== Mode.Idle && currentMode !== Mode.Edit) {
                handleSetMode(Mode.Idle); 
           }
        }
        break;
      }
      case 'rename': {
        nextLayersState = currentLayersSnapshot.map(l =>
          l.id === payload.layerId ? { ...l, name: payload.newName } : l
        );
        break;
      }
      case 'reorder': {
        const { oldIndex, newIndex } = payload;
        if (oldIndex >= 0 && oldIndex < currentLayersSnapshot.length && newIndex >= 0 && newIndex < currentLayersSnapshot.length) {
            const reorderedLayers = [...currentLayersSnapshot];
            const [itemToMove] = reorderedLayers.splice(oldIndex, 1);
            reorderedLayers.splice(newIndex, 0, itemToMove);
            nextLayersState = reorderedLayers;
        } else {
            console.error("Invalid indices for layer reorder:", oldIndex, newIndex);
            return; 
        }
        break;
      }
      default:
        return; 
    }
    
    let stateChanged = false;
    if (nextLayersState !== currentLayersSnapshot) {
        setLayers(nextLayersState);
        stateChanged = true;
    }
    if (nextActiveLayerIdState !== currentActiveLayerIdSnapshot) {
      setActiveLayerId(nextActiveLayerIdState);
      stateChanged = true;
    }

    if (stateChanged) {
         addStateToHistory(nextLayersState, nextActiveLayerIdState, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
  }, [layers, activeLayerId, setLayers, setActiveLayerId, selectedElementInfo, deselectAll, addStateToHistory, currentWallAlignment, userGridSpacing, osnapSettings, isDrawing, setIsDrawing, setCurrentPolygonPoints, setPreviewLineEndPoint, setDistanceInputState, currentDimensionStartPoint, resetDimensionState, currentMode, handleSetMode, selectedOpeningWallInfo, openingFirstPoint, drawingGuidelineStartPoint, isMultiGuideMode, multiGuideCount, multiGuideDistance]);


  const handleToggleGridSnap = useCallback(() => setIsGridSnapActive(p => !p), []);
  const handleToggleGridVisible = useCallback(() => setIsGridVisible(p => !p), []);
  const handleToggleOrthogonalMode = useCallback(() => {
    setIsOrthogonalMode(p => !p);
    lockedOrthoAxisRef.current = null;
  }, []);
  const handleToggleAngleSnap = useCallback(() => setIsAngleSnapActive(p => !p), []);

  const handleUpdateDoor = useCallback((doorId: number, newSwing: Door['swing']) => {
    let nextLayersState: LayerData[] | null = null;
    setLayers(prevLayers => {
        const updatedLayers = prevLayers.map(layer => {
            const doorIndex = (layer.doors || []).findIndex(d => d.id === doorId);
            if (doorIndex !== -1) {
                const newDoors = [...layer.doors];
                newDoors[doorIndex] = { ...newDoors[doorIndex], swing: newSwing };
                return { ...layer, doors: newDoors };
            }
            return layer;
        });
        nextLayersState = updatedLayers;
        return updatedLayers;
    });

    if (nextLayersState) {
        addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
  }, [addStateToHistory, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance]);


  // Panel state and its update effect
  const initialPanelDefinitions = useMemo<FloatingPanelConfig[]>(() => {
    const defaultZ = 10;
    
    // For Layers Panel (top-right)
    const layersPanelBaseX = 15; 
    const layersPanelBaseY = 50; 

    // For Wall Panels (bottom, right of left toolbar)
    const leftBarWidthPx = 64; 
    const panelSidePaddingPx = 10;
    
    return [
      { 
        id: 'layers_panel', 
        title: 'Layers', 
        initialPosition: { x: window.innerWidth - 280 - layersPanelBaseX, y: layersPanelBaseY }, 
        isPinned: false, 
        isVisible: true, 
        zIndex: defaultZ, 
        canClose: false,
        contentRenderer: (props) => <LayerPanel {...props} />, 
        minWidth: '280px', 
        initialSize: { width: '280px', height: '300px'},
        hideFrameControls: true, 
      },
      { 
        id: 'wall_thickness_panel', 
        title: 'Wall Thickness', 
        initialPosition: { x: leftBarWidthPx + panelSidePaddingPx, y: 100 },
        isPinned: false, 
        isVisible: false, 
        zIndex: defaultZ, 
        contentRenderer: (props: WallThicknessPanelProps) => <WallThicknessControl {...props} />, 
        minWidth: `180px`,
        hideFrameControls: true,
      },
      { 
        id: 'wall_alignment_panel', 
        title: 'Wall Alignment', 
        initialPosition: { x: leftBarWidthPx + panelSidePaddingPx, y: 155 },
        isPinned: false, 
        isVisible: false, 
        zIndex: defaultZ, 
        contentRenderer: (props: WallAlignmentPanelProps) => <WallAlignmentButtons {...props} />, 
        minWidth: '200px',
        hideFrameControls: true,
      },
      { 
        id: 'guideline_settings_panel', 
        title: 'Guideline Settings', 
        initialPosition: { x: leftBarWidthPx + panelSidePaddingPx, y: 210 },
        isPinned: false, 
        isVisible: false, 
        zIndex: defaultZ, 
        contentRenderer: (props: GuidelineSettingsPanelProps) => <GuidelineSettingsControl {...props} />, 
        minWidth: '200px',
        hideFrameControls: true,
      },
      { 
        id: 'door_properties_panel', 
        title: 'Door Properties', 
        initialPosition: { x: leftBarWidthPx + panelSidePaddingPx, y: 265 },
        isPinned: false, 
        isVisible: false, 
        zIndex: defaultZ, 
        contentRenderer: (props: DoorPropertiesPanelProps) => <DoorPropertiesControl {...props} />, 
        minWidth: '150px',
        hideFrameControls: true,
      },
    ];
  }, []); 

  const [panelStates, setPanelStates] = useState<FloatingPanelState[]>(() =>
    initialPanelDefinitions.map(def => ({
      ...def,
      currentPosition: def.initialPosition,
    }))
  );
  
  const selectRoomInLayer = useCallback((layerId: string, roomIndexInLayer: number, preserveSplitState: boolean = false) => {
    deselectAll(); 
    const targetLayer = layers.find(l => l.id === layerId);
    if (!targetLayer || !(targetLayer.rooms || [])[roomIndexInLayer]) return;
    
    const roomId = (targetLayer.rooms || [])[roomIndexInLayer].id;
    updateLayerById(layerId, layer => ({
      ...layer,
      rooms: (layer.rooms || []).map((room, index) => 
        index === roomIndexInLayer ? { ...room, isSelected: true } : room
      )
    }));
    setSelectedElementInfo({layerId, elementId: roomId, elementType: 'room' });
    if (layerId !== activeLayerId) setActiveLayerId(layerId);

    if (!preserveSplitState) { setIsSplittingAttemptActive(false); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); hideStatusMessage(); }
    lockedOrthoAxisRef.current = null;
  }, [deselectAll, layers, activeLayerId, updateLayerById, hideStatusMessage]);

  const selectDimensionLineInLayer = useCallback((layerId: string, dimLineIndexInLayer: number) => {
    deselectAll(); 
    const targetLayer = layers.find(l => l.id === layerId);
    if (!targetLayer || !(targetLayer.dimensionLines || [])[dimLineIndexInLayer]) return;

    const dimLineId = (targetLayer.dimensionLines || [])[dimLineIndexInLayer].id;
    updateLayerById(layerId, layer => ({
      ...layer,
      dimensionLines: (layer.dimensionLines || []).map((dl, index) => 
        index === dimLineIndexInLayer ? { ...dl, isSelected: true } : dl
      )
    }));
    setSelectedElementInfo({layerId, elementId: dimLineId, elementType: 'dimension'});
    if (layerId !== activeLayerId) setActiveLayerId(layerId);
    lockedOrthoAxisRef.current = null;
  }, [deselectAll, layers, activeLayerId, updateLayerById]);
  
  const selectDoorInLayer = useCallback((layerId: string, doorIndexInLayer: number) => {
    deselectAll();
    const targetLayer = layers.find(l => l.id === layerId);
    if (!targetLayer || !targetLayer.doors?.[doorIndexInLayer]) return;

    const doorId = targetLayer.doors[doorIndexInLayer].id;
    updateLayerById(layerId, layer => ({
        ...layer,
        doors: (layer.doors || []).map((door, index) => 
            index === doorIndexInLayer ? { ...door, isSelected: true } : { ...door, isSelected: false }
        )
    }));
    setSelectedElementInfo({ layerId, elementId: doorId, elementType: 'door' });
    if (layerId !== activeLayerId) setActiveLayerId(layerId);
  }, [deselectAll, layers, activeLayerId, updateLayerById]);


  const centerViewOnElement = useCallback((layerId: string, elementId: number, elementType: 'room' | 'dimension' | 'door') => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;

      let elementPoints: Point[] | undefined;
      if (elementType === 'room') {
          const room = layer.rooms.find(r => r.id === elementId);
          elementPoints = room?.points;
      } else if (elementType === 'dimension') {
          const dim = layer.dimensionLines.find(d => d.id === elementId);
          elementPoints = dim?.points;
      } else if (elementType === 'door') {
          const door = layer.doors.find(d => d.id === elementId);
          if (door) elementPoints = [door.center];
      }

      if (!elementPoints || elementPoints.length === 0) return;

      const bbox = getRoomBoundingBox(elementPoints);
      if (!bbox) return;

      const PADDING_FACTOR = 1.8;
      let bboxWidth = bbox.maxX - bbox.minX;
      let bboxHeight = bbox.maxY - bbox.minY;

      if (bboxWidth < 1e-6 && bboxHeight < 1e-6) {
          bboxWidth = userGridSpacing * 5;
          bboxHeight = userGridSpacing * 5;
      }
      if (bboxWidth < 1e-6) bboxWidth = bboxHeight;
      if (bboxHeight < 1e-6) bboxHeight = bboxWidth;
      
      const scaleX = canvas.width / (bboxWidth * PADDING_FACTOR);
      const scaleY = canvas.height / (bboxHeight * PADDING_FACTOR);
      const newScale = Math.min(scaleX, scaleY);

      const newPanX = (canvas.width / (2 * newScale)) - bbox.centerX;
      const newPanY = (canvas.height / (2 * newScale)) - bbox.centerY;
      
      setTransform({ scale: newScale, panX: newPanX, panY: newPanY });
  }, [layers, canvasRef, userGridSpacing]);

  const handleSelectElementFromPanel = useCallback((layerId: string, elementId: number, elementType: 'room' | 'dimension' | 'door') => {
      handleSetMode(Mode.Edit);
      
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;

      if (elementType === 'room') {
          const roomIndex = layer.rooms.findIndex(r => r.id === elementId);
          if (roomIndex !== -1) {
              selectRoomInLayer(layerId, roomIndex);
          }
      } else if (elementType === 'dimension') {
          const dimIndex = layer.dimensionLines.findIndex(d => d.id === elementId);
          if (dimIndex !== -1) {
              selectDimensionLineInLayer(layerId, dimIndex);
          }
      } else if (elementType === 'door') {
          const doorIndex = layer.doors.findIndex(d => d.id === elementId);
          if (doorIndex !== -1) {
              selectDoorInLayer(layerId, doorIndex);
          }
      }
      
      setTimeout(() => {
          centerViewOnElement(layerId, elementId, elementType);
      }, 50);

  }, [layers, handleSetMode, selectRoomInLayer, selectDimensionLineInLayer, selectDoorInLayer, centerViewOnElement]);
  
  useEffect(() => {
    setPanelStates(currentPanelStates =>
      currentPanelStates.map(panelState => {
        const definition = initialPanelDefinitions.find(d => d.id === panelState.id);
        if (!definition) {
          console.warn(`Panel definition not found for ID: ${panelState.id}`);
          return panelState;
        }

        let newIsVisible = panelState.isVisible;
        let newPosition = panelState.currentPosition;
        let rendererProps: any = {};
        const panelGap = 8;
        const panelHeightEstimate = 45;

        switch (definition.id) {
          case 'wall_thickness_panel':
            rendererProps = {
              currentWallThickness,
              onSetWallThickness: setCurrentWallThickness,
              currentUnit,
              convertWorldUnitsToDisplayUnit,
              convertValueToWorldUnits,
            };
            newIsVisible = currentMode === Mode.Wall || currentMode === Mode.Opening;
            if (newIsVisible && !panelState.isVisible && activeToolPanelAnchorRect) {
                const rect = activeToolPanelAnchorRect;
                newPosition = { x: rect.right + panelGap, y: rect.top };
            }
            break;
          case 'wall_alignment_panel':
            rendererProps = {
              currentWallAlignment,
              onSetWallAlignment: setCurrentWallAlignment,
            };
            newIsVisible = currentMode === Mode.Wall;
            if (newIsVisible && !panelState.isVisible && activeToolPanelAnchorRect) {
                const rect = activeToolPanelAnchorRect;
                newPosition = { x: rect.right + panelGap, y: rect.top + panelHeightEstimate + panelGap };
            }
            break;
          case 'layers_panel':
            rendererProps = {
              layers,
              activeLayerId,
              onLayerAction: handleLayerAction,
              selectedElementInfo,
              onSelectElement: handleSelectElementFromPanel,
            };
            break;
          case 'guideline_settings_panel':
            rendererProps = {
              isMultiGuideMode,
              multiGuideCount,
              onSetMultiGuideCount: setMultiGuideCount,
              multiGuideDistance,
              onSetMultiGuideDistance: setMultiGuideDistance,
              currentUnit,
              convertWorldUnitsToDisplayUnit,
              convertValueToWorldUnits,
            };
            newIsVisible = currentMode === Mode.Guideline && isMultiGuideMode;
            if (newIsVisible && !panelState.isVisible && activeToolPanelAnchorRect) {
                const rect = activeToolPanelAnchorRect;
                newPosition = { x: rect.right + panelGap, y: rect.top };
            }
            break;
          case 'door_properties_panel':
            const selectedDoor = selectedElementInfo?.elementType === 'door' 
                ? layers.find(l => l.id === selectedElementInfo.layerId)?.doors.find(d => d.id === selectedElementInfo.elementId)
                : null;
            newIsVisible = !!selectedDoor;
            rendererProps = {
              selectedDoor: selectedDoor || null,
              onUpdateDoor: handleUpdateDoor,
            };
            if (newIsVisible && !panelState.isVisible && selectedDoor) {
                const doorScreenPos = toScreen(selectedDoor.center);
                newPosition = { x: doorScreenPos.x + 40, y: doorScreenPos.y - 40 };
            }
            break;
        }

        return {
          ...panelState,
          isVisible: newIsVisible,
          currentPosition: newPosition,
          contentRenderer: (wrapperProps = {}) => definition.contentRenderer({ ...rendererProps, ...wrapperProps }),
        };
      })
    );
  }, [
    currentMode,
    currentWallThickness, setCurrentWallThickness, currentUnit,
    currentWallAlignment, setCurrentWallAlignment,
    layers, activeLayerId, handleLayerAction,
    initialPanelDefinitions, selectedElementInfo, handleSelectElementFromPanel,
    isMultiGuideMode, multiGuideCount, setMultiGuideCount,
    multiGuideDistance, setMultiGuideDistance,
    activeToolPanelAnchorRect,
    handleUpdateDoor, toScreen
  ]);


  const handlePanelPositionChange = useCallback((id: PanelId, newPos: Point) => {
    setPanelStates(prevStates => prevStates.map(p => p.id === id ? { ...p, currentPosition: newPos } : p));
  }, []);
  
  const handleBringToFront = useCallback((id: PanelId) => {
    setPanelStates(prevStates => {
      const maxZ = Math.max(0, ...prevStates.map(p => p.zIndex));
      return prevStates.map(p => p.id === id ? { ...p, zIndex: maxZ + 1 } : p);
    });
  }, []);

  // Constants for snap thresholds, dependent on userGridSpacing
  const currentPointSnapThreshold = userGridSpacing * POINT_SNAP_THRESHOLD_GRID_FACTOR;
  const currentLineExtensionSnapThreshold = userGridSpacing * LINE_EXTENSION_SNAP_THRESHOLD_FACTOR;
  const currentParallelAngleThresholdRad = toRadians(PARALLEL_ANGLE_THRESHOLD_DEGREES);
  const currentPerpendicularSnapThreshold = userGridSpacing * PERPENDICULAR_SNAP_THRESHOLD_FACTOR;


  const findEndpointSnaps = useCallback((targetPoint: Point, snapThreshold: number, layersToSearch: LayerData[]): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;
    layersToSearch.forEach(layer => {
      if (!layer.isVisible || layer.isLocked) return;
      (layer.rooms || []).forEach(room => {
        // NEW: Handle final wall geometry for snapping
        if (room.isWall) {
            const allVertices = [...(room.points || []), ...(room.innerPoints || [])];
            allVertices.forEach(vertex => {
                const dist = calculateDistance(targetPoint, vertex);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestSnap = {
                        point: { ...vertex },
                        layerId: layer.id,
                        type: SnapType.ENDPOINT_ROOM,
                        displayText: "On Wall Vertex",
                        relatedElements: { elementId: room.id, elementType: 'wall' }
                    };
                }
            });
        } else {
          // Original logic for rooms
          (room.points || []).forEach(vertex => {
            const dist = calculateDistance(targetPoint, vertex);
            if (dist < minDistance) {
              minDistance = dist;
              closestSnap = { 
                point: { ...vertex }, 
                layerId: layer.id, 
                type: SnapType.ENDPOINT_ROOM, 
                displayText: "On Room Vertex", 
                relatedElements: {elementId: room.id, elementType: 'room'} 
              };
            }
          });
        }
      });
      (layer.dimensionLines || []).forEach(dl => (dl.points || []).forEach(vertex => {
        const dist = calculateDistance(targetPoint, vertex);
        if (dist < minDistance) {
          minDistance = dist;
          closestSnap = { 
            point: { ...vertex }, 
            layerId: layer.id, 
            type: SnapType.ENDPOINT_DIM, 
            displayText: "Dimension Point", 
            relatedElements: {elementId: dl.id, elementType: 'dimension'} 
          };
        }
      }));
    });
    return closestSnap;
  }, []);

  const findMidpointSnaps = useCallback((targetPoint: Point, snapThreshold: number, layersToSearch: LayerData[]): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;
    layersToSearch.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;
        (layer.rooms || []).forEach(room => {
            const processMidpointsForPath = (points: Point[] | undefined, isPathOpen: boolean) => {
                if (!points || points.length < 2) return;
                const limit = isPathOpen ? points.length - 1 : points.length;
                for (let i = 0; i < limit; i++) {
                    const p1 = points[i];
                    const p2 = isPathOpen ? points[i + 1] : points[(i + 1) % points.length];
                    const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        
                    const dist = calculateDistance(targetPoint, midpoint);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestSnap = { point: { ...midpoint }, layerId: layer.id, type: SnapType.MIDPOINT_ROOM, displayText: "Midpoint", relatedElements: { elementId: room.id, elementType: room.isWall ? 'wall' : 'room' } };
                    }
                }
            };

            const isMainPathOpen = !!(room.isWall && !room.innerPoints && room.points && room.points.length > 4);
            processMidpointsForPath(room.points, isMainPathOpen || !!room.isSegment);
            if (room.innerPoints) {
                processMidpointsForPath(room.innerPoints, false);
            }
        });
    });
    return closestSnap;
}, []);

  const findGeometricCenterSnaps = useCallback((targetPoint: Point, snapThreshold: number, layersToSearch: LayerData[]): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;
    layersToSearch.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;
        (layer.rooms || []).forEach(room => {
            if (!room.isSegment && room.labelPosition && (room.points || []).length >= 3) { 
                const dist = calculateDistance(targetPoint, room.labelPosition);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestSnap = { point: { ...room.labelPosition }, layerId: layer.id, type: SnapType.GEOMETRIC_CENTER, displayText: "Center", relatedElements: {elementId: room.id, elementType: room.isWall ? 'wall' : 'room'} };
                }
            }
        });
    });
    return closestSnap;
  }, []);

  const findIntersectionSnaps = useCallback((targetPoint: Point, snapThreshold: number, layersToSearch: LayerData[]): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold * 1.5;

    const allSegments: { p1: Point, p2: Point, layerId: string, elementId: number | string, elementType: 'room' | 'wall' | 'dimension' }[] = [];
    layersToSearch.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;

        const addSegmentsFromPath = (points: Point[] | undefined, isOpen: boolean, elementId: number, elementType: 'room' | 'wall') => {
            if (!points || points.length < 2) return;
            const limit = isOpen ? points.length - 1 : points.length;
            for (let i = 0; i < limit; i++) {
                const p1 = points[i];
                const p2 = isOpen ? points[i + 1] : points[(i + 1) % points.length];
                allSegments.push({ p1, p2, layerId: layer.id, elementId, elementType });
            }
        };

        (layer.rooms || []).forEach(room => {
            const isMainPathOpen = !!(room.isWall && !room.innerPoints && room.points && room.points.length > 4);
            addSegmentsFromPath(room.points, isMainPathOpen || !!room.isSegment, room.id, room.isWall ? 'wall' : 'room');
            if (room.innerPoints) {
                addSegmentsFromPath(room.innerPoints, false, room.id, 'wall');
            }
        });

        (layer.dimensionLines || []).forEach(dl => {
            const dlPoints = dl.points || [];
            if (dlPoints.length >= 2) {
                allSegments.push({ p1: dlPoints[0], p2: dlPoints[dlPoints.length - 1], layerId: layer.id, elementId: dl.id, elementType: 'dimension' });
            }
        });
    });

    for (let i = 0; i < allSegments.length; i++) {
        for (let j = i + 1; j < allSegments.length; j++) {
            const seg1 = allSegments[i];
            const seg2 = allSegments[j];
            if (seg1.elementId === seg2.elementId && seg1.elementType === seg2.elementType && seg1.elementType !== 'dimension') continue;

            const intersection = getLineIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2);
            if (intersection) {
                if (isPointOnLineSegment(intersection, seg1.p1, seg1.p2, 1e-3) &&
                    isPointOnLineSegment(intersection, seg2.p1, seg2.p2, 1e-3)) {
                    const dist = calculateDistance(targetPoint, intersection);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestSnap = {
                            point: intersection,
                            type: SnapType.INTERSECTION_POINT,
                            layerId: seg1.layerId,
                            displayText: "Intersection",
                            relatedElements: { p1: seg1.p1, p2: seg1.p2, p3: seg2.p1, p4: seg2.p2 }
                        };
                    }
                }
            }
        }
    }
    return closestSnap;
}, []);
  
  const findPerpendicularSnaps = useCallback((cursorOriginalPos: Point, segmentStartPoint: Point | null, snapThreshold: number, layersToSearch: LayerData[]): CurrentSnapInfo | null => {
    if (!segmentStartPoint) return null;
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;

    const processSegments = (points: Point[] | undefined, isPathOpen: boolean, elementId: number | string, elementType: 'room' | 'wall' | 'dimension') => {
        const elementPoints = points || [];
        if (elementPoints.length < 2) return;
        const limit = isPathOpen ? elementPoints.length - 1 : elementPoints.length;
        for (let i = 0; i < limit; i++) {
            const p1 = elementPoints[i];
            const p2 = isPathOpen ? elementPoints[i + 1] : elementPoints[(i + 1) % elementPoints.length];

            if (calculateDistance(p1, p2) < 1e-6) continue;
            const projectedStart = closestPointOnInfiniteLine(segmentStartPoint, p1, p2);
            if (isPointOnLineSegment(projectedStart, p1, p2, snapThreshold * 0.1)) {
                const distToProjected = calculateDistance(cursorOriginalPos, projectedStart);
                if (distToProjected < minDistance) {
                    minDistance = distToProjected;
                    closestSnap = {
                        point: projectedStart,
                        type: SnapType.PERPENDICULAR_POINT,
                        layerId: layersToSearch.find(l => (l.rooms || []).some(r => r.id === elementId) || (l.dimensionLines || []).some(d => d.id === elementId))!.id,
                        displayText: "Perpendicular",
                        relatedElements: { p1, p2, elementId, elementType }
                    };
                }
            }
        }
    };

    layersToSearch.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;
        (layer.rooms || []).forEach(room => {
            const isMainPathOpen = !!(room.isWall && !room.innerPoints && room.points && room.points.length > 4);
            processSegments(room.points, isMainPathOpen || !!room.isSegment, room.id, room.isWall ? 'wall' : 'room');
            if (room.innerPoints) {
                processSegments(room.innerPoints, false, room.id, 'wall');
            }
        });
        (layer.dimensionLines || []).forEach(dl => {
            if ((dl.points || []).length >= 2) processSegments(dl.points, true, dl.id, 'dimension');
        });
    });
    return closestSnap;
}, []);

  const findNearestSnaps = useCallback((targetPoint: Point, snapThreshold: number, layersToSearch: LayerData[], currentEdgeForOpening?: { p1: Point, p2: Point }): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;

    if (currentEdgeForOpening) {
        const { dist, closestPoint } = distancePointToSegment(targetPoint, currentEdgeForOpening.p1, currentEdgeForOpening.p2);
        if (dist < minDistance) {
            minDistance = dist;
            closestSnap = { point: closestPoint, layerId: activeLayerId!, type: SnapType.ON_SELECTED_EDGE, displayText: "On Edge", relatedElements: { p1: currentEdgeForOpening.p1, p2: currentEdgeForOpening.p2 } };
        }
    }

    const processSegments = (points: Point[] | undefined, isPathOpen: boolean, elementId: number | string, elementType: 'room' | 'wall' | 'dimension', layerId: string, displayText: string = "Nearest") => {
        const elementPoints = points || [];
        if (elementPoints.length < 2) return;

        const limit = isPathOpen ? elementPoints.length - 1 : elementPoints.length;
        for (let i = 0; i < limit; i++) {
            const p1 = elementPoints[i];
            const p2 = isPathOpen ? elementPoints[i + 1] : elementPoints[(i + 1) % elementPoints.length];

            if (currentEdgeForOpening &&
                ((p1.x === currentEdgeForOpening.p1.x && p1.y === currentEdgeForOpening.p1.y && p2.x === currentEdgeForOpening.p2.x && p2.y === currentEdgeForOpening.p2.y) ||
                 (p1.x === currentEdgeForOpening.p2.x && p1.y === currentEdgeForOpening.p2.y && p2.x === currentEdgeForOpening.p1.x && p2.y === currentEdgeForOpening.p1.y))) {
                continue;
            }

            const { dist, closestPoint } = distancePointToSegment(targetPoint, p1, p2);
            if (dist < minDistance) {
                minDistance = dist;
                closestSnap = { point: closestPoint, layerId: layerId, type: SnapType.ON_LINE, displayText: displayText, relatedElements: { p1, p2, elementId, elementType } };
            }
        }
    };

    layersToSearch.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;

        (layer.rooms || []).forEach(room => {
            const isMainPathOpen = !!(room.isWall && !room.innerPoints && room.points && room.points.length > 4);
            processSegments(room.points, isMainPathOpen || !!room.isSegment, room.id, room.isWall ? 'wall' : 'room', layer.id, "On Wall Face");
            if (room.innerPoints) {
                processSegments(room.innerPoints, false, room.id, 'wall', layer.id, 'On Wall Face');
            }
        });
        (layer.dimensionLines || []).forEach(dl => {
            if ((dl.points || []).length >= 2) processSegments(dl.points, true, dl.id, 'dimension', layer.id);
        });
    });
    return closestSnap;
}, [activeLayerId]);


  const findLineExtensionSnaps = useCallback((
    targetPoint: Point,
    snapThreshold: number
  ): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;

    layers.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;

        (layer.rooms || []).forEach(room => {
            const roomPoints = room.points || [];
            const limit = room.isSegment ? roomPoints.length - 1 : roomPoints.length;
            for (let i = 0; i < limit; i++) {
                const p1 = roomPoints[i];
                const p2 = roomPoints[(i + 1) % roomPoints.length];
                if (calculateDistance(p1,p2) < 1e-6) continue;

                const projected = closestPointOnInfiniteLine(targetPoint, p1, p2);
                const distToProjected = calculateDistance(targetPoint, projected);

                if (distToProjected < minDistance) {
                    const onSegment = isPointOnLineSegment(projected, p1, p2, snapThreshold * 0.1);
                    if (!onSegment) { 
                        minDistance = distToProjected;
                        closestSnap = { point: projected, layerId: layer.id, type: SnapType.LINE_EXTENSION_ROOM_WALL, displayText: "Extension", relatedElements: { p1, p2, elementId: room.id, elementType: room.isWall ? 'wall' : 'room' } };
                    }
                }
            }
        });
        (layer.dimensionLines || []).forEach(dl => {
            const dlPoints = dl.points || [];
            if (dlPoints.length < 2) return;
            const p1 = dlPoints[0];
            const p2 = dlPoints[dlPoints.length - 1];
            if (calculateDistance(p1,p2) < 1e-6) return;
            
            const projected = closestPointOnInfiniteLine(targetPoint, p1, p2);
            const distToProjected = calculateDistance(targetPoint, projected);

            if (distToProjected < minDistance) {
                const onSegment = isPointOnLineSegment(projected, p1, p2, snapThreshold * 0.1);
                if (!onSegment) {
                    minDistance = distToProjected;
                    closestSnap = { point: projected, layerId: layer.id, type: SnapType.LINE_EXTENSION_DIM, displayText: "Extension", relatedElements: { p1, p2, elementId: dl.id, elementType: 'dimension' } };
                }
            }
        });
    });
    return closestSnap;
  }, [layers]); 

  const findRoomPerimeterSnaps = useCallback((
    targetPoint: Point,
    snapThreshold: number,
    layersToSearch: LayerData[]
  ): CurrentSnapInfo | null => {
    let closestSnap: CurrentSnapInfo | null = null;
    let minDistance = snapThreshold;

    layersToSearch.forEach(layer => {
        if (!layer.isVisible || layer.isLocked) return;

        (layer.rooms || []).forEach(room => {
            // Only snap to perimeters of actual rooms (not walls/segments themselves)
            if (room.isWall || room.isSegment || !room.points || room.points.length < 3) return;

            const roomPoints = room.points;
            for (let i = 0; i < roomPoints.length; i++) {
                const p1 = roomPoints[i];
                const p2 = roomPoints[(i + 1) % roomPoints.length]; // Closed polygon

                const { dist, closestPoint } = distancePointToSegment(targetPoint, p1, p2);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestSnap = {
                        point: closestPoint,
                        type: SnapType.ON_ROOM_PERIMETER,
                        layerId: layer.id,
                        relatedElements: { p1, p2, elementId: room.id, elementType: 'room' },
                        displayText: "On Room Edge",
                    };
                }
            }
        });
    });
    return closestSnap;
  }, []);

  const updateArchitecturalScaleDisplay = useCallback(() => { const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale; let closestScale = ARCHITECTURAL_SCALES[0]; let minDiff = Infinity; ARCHITECTURAL_SCALES.forEach(scale => { const diff = Math.abs(currentArchScaleDenom - scale); if (diff < minDiff) { minDiff = diff; closestScale = scale; } }); setArchitecturalScale(closestScale); setCurrentScaleDisplayText(`Scale: 1:${closestScale}`); }, [transform.scale]);
  useEffect(() => { updateArchitecturalScaleDisplay(); }, [transform.scale, updateArchitecturalScaleDisplay]);

  

  const finishCurrentPolygon = useCallback((pointsToFinalize: Point[]) => {
    const activeLyr = getActiveLayer();
    if (!activeLyr) { 
        setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null); 
        return; 
    }

    const isWallMode = currentMode === Mode.Wall;
    let newElements: Room[] = [];
    let nextRoomIdCounter = activeLyr.nextRoomId;
    
    if (isWallMode) {
        const isClosing = pointsToFinalize.length > 2 && calculateDistance(pointsToFinalize[0], pointsToFinalize[pointsToFinalize.length - 1]) < 1e-6;
        let guideline = isClosing ? pointsToFinalize.slice(0, -1) : [...pointsToFinalize];

        if (isClosing && guideline.length >= 3) {
            // Ensure the guideline is counter-clockwise before offsetting to standardize behavior.
            if (calculateSignedPolygonAreaTwice(guideline) < 0) {
                guideline.reverse();
            }
        }
        
        if (guideline.length < 2) {
            setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null); return;
        }
        
        const wallThickness = currentWallThickness > 0 ? currentWallThickness : DEFAULT_WALL_THICKNESS_WORLD_UNITS;
        const wallAlignment = currentWallAlignment;
        
        let outerFace: Point[];
        let innerFace: Point[];

        switch (wallAlignment) {
            case WallAlignment.Exterior:
                outerFace = guideline;
                innerFace = offsetPath(guideline, -wallThickness, isClosing);
                break;
            case WallAlignment.Interior:
                innerFace = guideline;
                outerFace = offsetPath(guideline, wallThickness, isClosing);
                break;
            case WallAlignment.Centered:
            default:
                outerFace = offsetPath(guideline, wallThickness / 2, isClosing);
                innerFace = offsetPath(guideline, -wallThickness / 2, isClosing);
                break;
        }


        const newWallId = nextRoomIdCounter++;
        
        if (isClosing) {
            // Finalize and create the wall object itself.
            if (calculateSignedPolygonAreaTwice(outerFace) < 0) outerFace.reverse();
            if (calculateSignedPolygonAreaTwice(innerFace) > 0) innerFace.reverse();

            const wallElementToAdd: Room = {
                id: newWallId,
                points: outerFace,
                innerPoints: innerFace,
                name: `Wall ${newWallId}`,
                area: calculatePolygonArea(outerFace) - calculatePolygonArea(innerFace),
                labelPosition: null, isSelected: false, isWall: true, isSegment: false,
                wallThickness: wallThickness, wallAlignment: wallAlignment
            };
            newElements.push(wallElementToAdd);
        } else { // Open wall
            const finalPolygonPoints = [...outerFace, ...[...innerFace].reverse()];
            const wallElementToAdd: Room = {
                id: newWallId, points: finalPolygonPoints,
                name: `Wall ${newWallId}`, area: calculatePolygonArea(finalPolygonPoints),
                labelPosition: null, isSelected: false, isWall: true, isSegment: false,
                wallThickness: wallThickness, wallAlignment: wallAlignment
            };
            newElements.push(wallElementToAdd);
        }
    } else { // Room Mode
      if (pointsToFinalize.length < 3) {
        setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null);
        setDistanceInputState(p => ({ ...p, show: false })); lockedOrthoAxisRef.current = null; 
        return;
      }
      let roomPoints = [...pointsToFinalize];
      if (roomPoints.length > 3 && roomPoints[0].x === roomPoints[roomPoints.length - 1].x && roomPoints[0].y === roomPoints[roomPoints.length - 1].y) {
          roomPoints = roomPoints.slice(0, -1);
      }
      const newRoomElement: Room = { 
          id: nextRoomIdCounter++, 
          points: roomPoints, 
          name: `Room ${(activeLyr.rooms || []).filter(r => !r.isWall).length + 1}`, 
          area: calculatePolygonArea(roomPoints), 
          labelPosition: calculateCentroid(roomPoints), 
          isSelected: false, 
          isWall: false, 
          isSegment: false,
      };
      newElements.push(newRoomElement);
    }
    
    const newLayers = layers.map(l => {
      if (l.id === activeLyr.id) {
        return {
          ...l,
          rooms: [...(l.rooms || []), ...newElements],
          nextRoomId: nextRoomIdCounter
        };
      }
      return l;
    });
    setLayers(newLayers);
    
    addStateToHistory(newLayers, activeLyr.id, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null);
    setDistanceInputState(p => ({ ...p, show: false })); lockedOrthoAxisRef.current = null;
    
    const wallElementToSelect = newElements.find(e => e.isWall);
    if (wallElementToSelect) {
      const finalLayerForSelection = newLayers.find(l => l.id === activeLyr.id)!;
      const newElementIndexInFinalLayer = (finalLayerForSelection.rooms || []).findIndex(r => r.id === wallElementToSelect.id);
      if (newElementIndexInFinalLayer !== -1) {
         setTimeout(() => selectRoomInLayer(activeLyr.id, newElementIndexInFinalLayer), 0);
      }
    }
  }, [
      layers, getActiveLayer, selectRoomInLayer, addStateToHistory, 
      currentMode, currentWallThickness, currentWallAlignment, userGridSpacing, osnapSettings,
      isMultiGuideMode, multiGuideCount, multiGuideDistance
  ]);

  const performRoomSplit = useCallback((targetLayerId: string, originalRoomId: number) => {
    let newLayersState: LayerData[] | null = null;
    setLayers(prevLayers => {
        const targetLayerIndex = prevLayers.findIndex(l => l.id === targetLayerId);
        if (targetLayerIndex === -1) { showSimpleAlert("Target layer not found for split."); return prevLayers; }
        
        const originalRoomIndex = (prevLayers[targetLayerIndex].rooms || []).findIndex(r => r.id === originalRoomId);
        if (originalRoomIndex === -1) { showSimpleAlert("Target room not found for split."); return prevLayers; }
        const originalRoom = (prevLayers[targetLayerIndex].rooms || [])[originalRoomIndex];

        if (!originalRoom || (originalRoom.points || []).length < 3 || originalRoom.isWall || divisionLinePoints.length !== 2) {
          showSimpleAlert(originalRoom?.isWall ? "Cannot split a wall." : "Invalid split conditions.");
          setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); displayStatusMessage("Invalid split.", 0); return prevLayers;
        }
        const [divPoint1, divPoint2] = divisionLinePoints;
        const originalPoints = originalRoom.points || [];
        const idx1 = originalPoints.findIndex(p => p.x === divPoint1.x && p.y === divPoint1.y);
        const idx2 = originalPoints.findIndex(p => p.x === divPoint2.x && p.y === divPoint2.y);
        if (idx1 === -1 || idx2 === -1 || idx1 === idx2 || Math.abs(idx1 - idx2) === 1 || (idx1 === 0 && idx2 === originalPoints.length - 1) || (idx2 === 0 && idx1 === originalPoints.length - 1)) {
          showSimpleAlert("Invalid division points. Choose two non-adjacent vertices.");
          setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); displayStatusMessage("Invalid split.", 0); return prevLayers;
        }
        const newPoly1Points: Point[] = []; let current = idx1; do { newPoly1Points.push({ ...originalPoints[current] }); if (current === idx2) break; current = (current + 1) % originalPoints.length; } while (current !== idx1 || newPoly1Points.length <= originalPoints.length);
        const newPoly2Points: Point[] = []; current = idx2; do { newPoly2Points.push({ ...originalPoints[current] }); if (current === idx1) break; current = (current + 1) % originalPoints.length; } while (current !== idx2 || newPoly2Points.length <= originalPoints.length);
        if (newPoly1Points.length < 3 || newPoly2Points.length < 3) { showSimpleAlert("The split would result in invalid polygons."); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); displayStatusMessage("Invalid split.", 0); return prevLayers; }
        
        const updatedLayers = prevLayers.map((layer, lIdx) => {
            if (lIdx === targetLayerIndex) {
                const newRoom1Id = layer.nextRoomId;
                const newRoom2Id = layer.nextRoomId + 1;
                const room1: Room = { id: newRoom1Id, points: newPoly1Points, name: `${originalRoom.name} A`, area: calculatePolygonArea(newPoly1Points), labelPosition: calculateCentroid(newPoly1Points), isSelected: false, isWall: false, isSegment: false };
                const room2: Room = { id: newRoom2Id, points: newPoly2Points, name: `${originalRoom.name} B`, area: calculatePolygonArea(newPoly2Points), labelPosition: calculateCentroid(newPoly2Points), isSelected: false, isWall: false, isSegment: false };
                
                const finalRoomsArray = [...(layer.rooms || [])];
                finalRoomsArray.splice(originalRoomIndex, 1, room1, room2);
                return { ...layer, rooms: finalRoomsArray, nextRoomId: layer.nextRoomId + 2 };
            }
            return layer;
        });
        newLayersState = updatedLayers;
        return updatedLayers;
    });
    if (newLayersState) {
        addStateToHistory(newLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
    deselectAll(); hideStatusMessage();
  }, [divisionLinePoints, showSimpleAlert, displayStatusMessage, hideStatusMessage, deselectAll, addStateToHistory, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance]);

    const performWallCut = (
        currentLayers: LayerData[],
        wallInfo: SelectedOpeningWallInfo,
        p1: Point,
        p2: Point
    ): { nextLayers: LayerData[], newOrModifiedWallIds: number[] } | null => {
        const { layerId, wallElementId } = wallInfo;

        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return null;

        const originalLayer = currentLayers[layerIndex];
        const wall = originalLayer.rooms.find(r => r.id === wallElementId);
        if (!wall || !wall.isWall) {
            showSimpleAlert("This tool can only be used on walls.");
            return null;
        }

        let updatedRooms = [...originalLayer.rooms];
        let nextRoomIdCounter = originalLayer.nextRoomId;
        const newOrModifiedWallIds: number[] = [];

        if (wallInfo.isClosedWall) {
            const { pathIndex, edgeIndex } = wallInfo;
            const operatingPath = pathIndex === 0 ? wall.points! : wall.innerPoints!;
            const oppositePath = pathIndex === 0 ? wall.innerPoints! : wall.points!;
            const wallThickness = wall.wallThickness || DEFAULT_WALL_THICKNESS_WORLD_UNITS;
            
            const oppositeEdgeResult = findOppositeEdgeAndIndex(operatingPath, edgeIndex, oppositePath, wallThickness);
            if (!oppositeEdgeResult) {
                showSimpleAlert("Could not create opening. Inner wall face not found directly opposite.");
                return null;
            }
            const { index: oppositeEdgeIndex } = oppositeEdgeResult;

            const [openingP1, openingP2] = calculateDistance(wallInfo.edgeP1, p1) < calculateDistance(wallInfo.edgeP1, p2) ? [p1, p2] : [p2, p1];
            
            const oppositeLineP1 = oppositePath[oppositeEdgeIndex];
            const oppositeLineP2 = oppositePath[(oppositeEdgeIndex + 1) % oppositePath.length];
            const openingP1_opposite = projectPointToLine(openingP1, oppositeLineP1, oppositeLineP2);
            const openingP2_opposite = projectPointToLine(openingP2, oppositeLineP1, oppositeLineP2);

            const newPolygonPoints: Point[] = [];
            newPolygonPoints.push(openingP2);
            let currIdx = (edgeIndex + 1) % operatingPath.length;
            while (currIdx !== edgeIndex) {
                newPolygonPoints.push(operatingPath[currIdx]);
                currIdx = (currIdx + 1) % operatingPath.length;
            }
            newPolygonPoints.push(operatingPath[edgeIndex]);
            newPolygonPoints.push(openingP1);
            newPolygonPoints.push(openingP1_opposite);

            let opp_curr_idx = (oppositeEdgeIndex + 1) % oppositePath.length;
            
            while (opp_curr_idx !== oppositeEdgeIndex) {
                newPolygonPoints.push(oppositePath[opp_curr_idx]);
                opp_curr_idx = (opp_curr_idx + 1) % oppositePath.length;
            }
            newPolygonPoints.push(oppositePath[oppositeEdgeIndex]);

            newPolygonPoints.push(openingP2_opposite);

            const newWall: Room = { 
                ...wall, 
                points: newPolygonPoints, 
                innerPoints: undefined,
                area: calculatePolygonArea(newPolygonPoints), 
                labelPosition: null,
                isSelected: false 
            };
            
            const oldWallIndex = updatedRooms.findIndex(r => r.id === wallElementId);
            if (oldWallIndex !== -1) {
                updatedRooms.splice(oldWallIndex, 1, newWall);
                newOrModifiedWallIds.push(newWall.id);
            }
        
        } else { // Open wall segment
            const wallPoints = wall.points || [];
            const n = wallPoints.length / 2;

            if (wallPoints.length < 4 || n !== Math.floor(n)) {
                showSimpleAlert("Cannot create opening in this wall segment. It has an invalid geometry.");
                return null;
            }

            const { edgeIndex: wallPointsEdgeIndex } = wallInfo;
            if (wallPointsEdgeIndex === n - 1 || wallPointsEdgeIndex === wallPoints.length - 1) {
                showSimpleAlert("Please select a main wall face for the opening, not an end cap.");
                return null;
            }
            
            const outerPath = wallPoints.slice(0, n);
            const innerPath = wallPoints.slice(n).reverse(); // In drawing order
            const isOuterFaceClicked = wallPointsEdgeIndex < n;
            const sourcePath = isOuterFaceClicked ? outerPath : innerPath;
            const targetPath = isOuterFaceClicked ? innerPath : outerPath;

            const findClosestPointAndSegmentIndexOnPath = (point: Point, path: Point[]): { closestPoint: Point; segmentIndex: number } => {
                let minDistanceSq = Infinity;
                let closestPointOnPath: Point | null = null;
                let segmentIndex = -1;
                if (path.length < 2) return { closestPoint: point, segmentIndex: -1 };
                for (let i = 0; i < path.length - 1; i++) {
                    const p1 = path[i]; const p2 = path[i + 1];
                    const { dist, closestPoint } = distancePointToSegment(point, p1, p2);
                    if (dist * dist < minDistanceSq) { minDistanceSq = dist * dist; closestPointOnPath = closestPoint; segmentIndex = i; }
                }
                return { closestPoint: closestPointOnPath!, segmentIndex };
            };

            const { closestPoint: p1_opposite, segmentIndex: p1_targetSegmentIdx } = findClosestPointAndSegmentIndexOnPath(p1, targetPath);
            const { closestPoint: p2_opposite, segmentIndex: p2_targetSegmentIdx } = findClosestPointAndSegmentIndexOnPath(p2, targetPath);
            const targetSegmentIdx = p1_targetSegmentIdx;
            if (targetSegmentIdx === -1) { showSimpleAlert("Could not determine opposite wall face for the opening."); return null; }
            
            let sourceSegmentIdx = isOuterFaceClicked ? wallPointsEdgeIndex : (2 * n - 2) - wallPointsEdgeIndex;
            const segStart = sourcePath[sourceSegmentIdx];
            const op1_is_first = calculateDistance(segStart, p1) < calculateDistance(segStart, p2);
            const firstOp = op1_is_first ? p1 : p2;
            const secondOp = op1_is_first ? p2 : p1;
            const firstOp_opposite = op1_is_first ? p1_opposite : p2_opposite;
            const secondOp_opposite = op1_is_first ? p2_opposite : p1_opposite;

            const wall1_source_path = [...sourcePath.slice(0, sourceSegmentIdx + 1), firstOp];
            const wall2_source_path = [secondOp, ...sourcePath.slice(sourceSegmentIdx + 1)];
            const wall1_target_path = [...targetPath.slice(0, targetSegmentIdx + 1), firstOp_opposite];
            const wall2_target_path = [secondOp_opposite, ...targetPath.slice(targetSegmentIdx + 1)];

            const wall1_outer = isOuterFaceClicked ? wall1_source_path : wall1_target_path;
            const wall1_inner = isOuterFaceClicked ? wall1_target_path : wall1_source_path;
            const wall2_outer = isOuterFaceClicked ? wall2_source_path : wall2_target_path;
            const wall2_inner = isOuterFaceClicked ? wall2_target_path : wall2_source_path;

            const wall1_pts = [...wall1_outer, ...[...wall1_inner].reverse()];
            const wall2_pts = [...wall2_outer, ...[...wall2_inner].reverse()];
            
            if (wall1_pts.length < 4 || wall2_pts.length < 4) { showSimpleAlert("The opening would create an invalid wall shape. Please try a different location."); return null; }

            const newWall1Id = nextRoomIdCounter++;
            const newWall2Id = nextRoomIdCounter++;
            const newWall1: Room = { ...wall, id: newWall1Id, name: `${wall.name} A`, points: wall1_pts, area: calculatePolygonArea(wall1_pts), isSelected: false };
            const newWall2: Room = { ...wall, id: newWall2Id, name: `${wall.name} B`, points: wall2_pts, area: calculatePolygonArea(wall2_pts), isSelected: false };

            updatedRooms = updatedRooms.filter(r => r.id !== wallElementId);
            updatedRooms.push(newWall1, newWall2);
            newOrModifiedWallIds.push(newWall1Id, newWall2Id);
        }

        const updatedLayers = [...currentLayers];
        updatedLayers[layerIndex] = { ...originalLayer, rooms: updatedRooms, nextRoomId: nextRoomIdCounter };
        return { nextLayers: updatedLayers, newOrModifiedWallIds };
    };

  const centerViewOnLoadOrClear = useCallback(() => { const canvas = canvasRef.current; if (canvas) { if (canvas.width === 0 || canvas.height === 0) { console.warn("Canvas dimensions are zero during centerViewOnLoadOrClear. Deferring or using defaults."); return; } const canvasWidth = canvas.width; const canvasHeight = canvas.height; const visibleCanvasHeight = canvasHeight; const initialDenominator = ARCHITECTURAL_SCALES.includes(100) ? 100 : ARCHITECTURAL_SCALES[Math.floor(ARCHITECTURAL_SCALES.length / 2)] || 100; const initialScale = REFERENCE_ARCH_SCALE_DENOMINATOR / initialDenominator; const panX_to_center = canvasWidth / (2 * initialScale); const panY_to_center = visibleCanvasHeight / (2 * initialScale); setTransform({ scale: initialScale, panX: panX_to_center, panY: panY_to_center }); setArchitecturalScale(initialDenominator); } }, [canvasRef]);
  
  const handleCanvasResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (canvas && container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      const activeLyr = getActiveLayer();
      const totalElements = layers.reduce((sum, l) => sum + (l.rooms || []).length + (l.dimensionLines || []).length, 0);
      if (!viewInitializedOnLoad && canvas.width > 0 && canvas.height > 0 && totalElements === 0 && currentPolygonPoints.length === 0 && historyStack.length <= 1) {
        centerViewOnLoadOrClear();
        setViewInitializedOnLoad(true);
      }
      if (distanceInputState.show && currentPolygonPoints.length > 0) {
        const lastVertexScreen = toScreen(currentPolygonPoints[currentPolygonPoints.length - 1]);
        setDistanceInputState(p => ({ ...p, x: lastVertexScreen.x + 15, y: lastVertexScreen.y - 40 }));
      }
      setContextMenuState(p => ({ ...p, show: false }));
    }
  }, [viewInitializedOnLoad, layers, getActiveLayer, currentPolygonPoints.length, historyStack.length, centerViewOnLoadOrClear, distanceInputState.show, toScreen, canvasRef, canvasContainerRef]);


  useEffect(() => { handleCanvasResize(); window.addEventListener('resize', handleCanvasResize); return () => window.removeEventListener('resize', handleCanvasResize); }, [handleCanvasResize]);
  useEffect(() => { const canvas = canvasRef.current; const activeLyr = getActiveLayer(); const totalElements = layers.reduce((sum, l) => sum + (l.rooms || []).length + (l.dimensionLines || []).length, 0); if (!viewInitializedOnLoad && canvas && canvas.width > 0 && canvas.height > 0 && totalElements === 0 && currentPolygonPoints.length === 0 && historyStack.length <= 1) { const timer = setTimeout(() => { centerViewOnLoadOrClear(); setViewInitializedOnLoad(true); }, 50); return () => clearTimeout(timer); } }, [viewInitializedOnLoad, layers, getActiveLayer, currentPolygonPoints.length, historyStack.length, centerViewOnLoadOrClear, canvasRef]);

  const getLabelWorldBoundingBox = useCallback((room: Room, roomList: Room[], roomIdx: number, layerId: string): RoomBoundingBox | null => {
    if (!room || !room.labelPosition || room.isWall) return null;
    const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;
    if (currentArchScaleDenom > ANNOTATION_VISIBILITY_THRESHOLD_SCALE && !(editingRoomNameInfo && editingRoomNameInfo.layerId === layerId && editingRoomNameInfo.roomIndexInLayer === roomIdx)) return null;
    const scaledLabelFontSize = getScaledScreenValue(BASE_LABEL_FONT_SIZE_PX, transform.scale, BASE_LABEL_FONT_SIZE_PX);
    const nameLength = room.name ? room.name.length : 10; const areaLength = 10;
    const charWidthWorld = (scaledLabelFontSize * 0.6) / transform.scale;
    const lineHeightWorld = (scaledLabelFontSize + getScaledScreenValue(4, transform.scale, 4)) / transform.scale;
    const textBlockWidthWorld = Math.max(nameLength, areaLength) * charWidthWorld;
    const textBlockHeightWorld = lineHeightWorld * 2;
    return { minX: room.labelPosition.x - textBlockWidthWorld / 2, minY: room.labelPosition.y - textBlockHeightWorld / 2, maxX: room.labelPosition.x + textBlockWidthWorld / 2, maxY: room.labelPosition.y + textBlockHeightWorld / 2, centerX: room.labelPosition.x, centerY: room.labelPosition.y };
  }, [transform.scale, editingRoomNameInfo]);

  const filterNearbyDimLines = useCallback((dls: DimensionLine[], currentWorldPos: Point): DimensionLine[] => {
    return dls.filter(dl => {
        if (!dl.points || dl.points.length < 2) return false;
        const vertexClose = dl.points.some(p => calculateDistance(currentWorldPos, p) < DRAWING_SEARCH_RADIUS_WORLD);
        if (vertexClose) return true;
        if (dl.points.length >= 2) {
            const { dist: segmentDist } = distancePointToSegment(currentWorldPos, dl.points[0], dl.points[dl.points.length - 1]);
            if (segmentDist < DRAWING_SEARCH_RADIUS_WORLD) return true;
        }
        return false;
    });
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[role="dialog"]')) {
        return;
    }

    const worldPosOriginal = toWorld({ x: event.clientX, y: event.clientY }); 
    setLastMouseWorldPos({ ...worldPosOriginal, screenX: event.clientX, screenY: event.clientY });
    
    let tempPos = { ...worldPosOriginal };
    let isObjectDragWithAnchorSnap = false;

    if (isDraggingRoom && selectedElementInfo?.elementType === 'room' && selectedElementInfo.originalPoints && selectedElementInfo.initialMouseWorldPos) {
        const { originalPoints, initialMouseWorldPos } = selectedElementInfo;
        const handleOffsetX = initialMouseWorldPos.x - originalPoints[0].x;
        const handleOffsetY = initialMouseWorldPos.y - originalPoints[0].y;
        tempPos = {
            x: worldPosOriginal.x - handleOffsetX,
            y: worldPosOriginal.y - handleOffsetY
        };
        isObjectDragWithAnchorSnap = true;
    } else if (isDraggingEntireDimensionLine && draggedEntireDimensionLineInfo) {
        const { originalPoints, initialMouseWorldPos } = draggedEntireDimensionLineInfo;
        const handleOffsetX = initialMouseWorldPos.x - originalPoints[0].x;
        const handleOffsetY = initialMouseWorldPos.y - originalPoints[0].y;
        tempPos = {
            x: worldPosOriginal.x - handleOffsetX,
            y: worldPosOriginal.y - handleOffsetY
        };
        isObjectDragWithAnchorSnap = true;
    }

    let finalSnapInfo: CurrentSnapInfo | null = null;
    let hardPositionalSnapOccurred = false;
    let angleFixedByParallelOrPerp = false;

    const isToolActiveForInitialSnap = 
      ( (currentMode === Mode.Room || currentMode === Mode.Wall) && !isDrawing && currentPolygonPoints.length === 0 ) ||
      ( currentMode === Mode.Dimension && !currentDimensionStartPoint ) ||
      ( currentMode === Mode.Guideline && !drawingGuidelineStartPoint ) ||
      ( (currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo && !openingFirstPoint ) || // Phase 2 Opening/Door
      ( (currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo && openingFirstPoint ) ||   // Phase 3 Opening
      ( extendingDimensionInfo ); // Dimension extension mode

    if (isPanning) {
        const dx = event.clientX - lastPanPosition.x;
        const dy = event.clientY - lastPanPosition.y;
        setTransform(prev => ({
            ...prev,
            panX: prev.panX + dx / prev.scale,
            panY: prev.panY + dy / prev.scale
        }));
        setLastPanPosition({ x: event.clientX, y: event.clientY });
        return; 
    }

    setHoveredVertexInfo(null); 
    setHoveredEdgeInfo(null);   
    setHoveredRoomIndexInActiveLayer(null); 
    setHoveredLabelRoomIndexInActiveLayer(null); 
    setHoveredDimensionLineInfo(null); 
    setHoveredDimensionVertexInfo(null); 
    setCurrentSnapInfo(null); 
    setOpeningPreviewLine(null); // Clear opening preview
    
    const activeLyr = getActiveLayer();
    if (!activeLyr) { setVisualCursorWorldPos(worldPosOriginal); return; }
    const activeLayerIdConst = activeLyr.id;

    if (((currentMode === Mode.Edit) || ((currentMode === Mode.Opening || currentMode === Mode.Door) && !selectedOpeningWallInfo)) && 
        !isDrawing && !draggingVertex && !isDraggingEdge && 
        !isDraggingDimensionLineOffset && !draggingDimensionVertex && !isDraggingEntireDimensionLine && !isDraggingRoom && !extendingDimensionInfo) {
      let foundActiveHover = false;
      const layersToSearchForHover = layers.filter(l => l.isVisible && !l.isLocked);
      for (const layer of layersToSearchForHover) {
          if (foundActiveHover) break; 
          for (let rIdx = 0; rIdx < (layer.rooms || []).length; rIdx++) {
              const room = (layer.rooms || [])[rIdx];
              if ((currentMode === Mode.Opening || currentMode === Mode.Door) && !room.isWall) continue; // Only hover wall edges in Opening/Door mode phase 1

              const checkVertices = (points: Point[], pathIdx: 0 | 1) => {
                if (foundActiveHover || currentMode === Mode.Opening || currentMode === Mode.Door) return;
                for (let vIdx = 0; vIdx < points.length; vIdx++) {
                    const vertex = points[vIdx];
                    if (calculateDistance(worldPosOriginal, vertex) < VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale * 1.5) {
                        setHoveredVertexInfo({ layerId: layer.id, roomIndexInLayer: rIdx, vertexIndex: vIdx, pathIndex: pathIdx });
                        foundActiveHover = true; break;
                    }
                }
              };
              checkVertices(room.points || [], 0);
              if (room.innerPoints) checkVertices(room.innerPoints, 1);
              
              if (foundActiveHover) break;
          }
          if (foundActiveHover && currentMode !== Mode.Opening && currentMode !== Mode.Door) continue; 
          
          for (let rIdx = 0; rIdx < (layer.rooms || []).length; rIdx++) {
              if (foundActiveHover) break;
              const room = (layer.rooms || [])[rIdx];
              if ((currentMode === Mode.Opening || currentMode === Mode.Door) && !room.isWall) continue;
              
              const checkEdgesOnPath = (points: Point[] | undefined, pathIdx: 0 | 1, isPathConsideredOpen: boolean) => {
                  if (foundActiveHover || !points || points.length < 2) return;
                  const limit = isPathConsideredOpen ? points.length - 1 : points.length;
                  for (let eIdx = 0; eIdx < limit; eIdx++) {
                      const p1 = points[eIdx];
                      const p2 = isPathConsideredOpen ? points[eIdx + 1] : points[(eIdx + 1) % points.length];
                      const { dist, closestPoint } = distancePointToSegment(worldPosOriginal, p1, p2);
                      if (dist < EDGE_HOVER_THRESHOLD_SCREEN_PX / transform.scale) {
                          setHoveredEdgeInfo({ layerId: layer.id, roomIndexInLayer: rIdx, edgeIndex: eIdx, pathIndex: pathIdx, closestPointOnEdge: closestPoint, isWall: room.isWall });
                          foundActiveHover = true;
                          break;
                      }
                  }
              };

              const isMainPathOpen = !!(room.isWall && !room.innerPoints && room.points && room.points.length > 4);
              
              checkEdgesOnPath(room.points, 0, isMainPathOpen || !!room.isSegment);
              
              if (room.innerPoints) {
                  checkEdgesOnPath(room.innerPoints, 1, false);
              }

              if (foundActiveHover) break;
          }
           if (foundActiveHover) continue; 
      }
    }

    // Dimension hover logic for Edit mode
    if (
        (currentMode === Mode.Edit && !hoveredVertexInfo && !hoveredEdgeInfo && !extendingDimensionInfo) &&
        !draggingVertex && !isDraggingRoom && !isDraggingEdge &&
        !isDraggingDimensionLineOffset && !draggingDimensionVertex && !isDraggingEntireDimensionLine
    ) {
        let foundDimVertexHover = false;
        let minDistanceToDimLine = EDGE_HOVER_THRESHOLD_SCREEN_PX / transform.scale;
        let currentHoveredDimLine: HoveredDimensionLineInfo | null = null;
        const layersToSearchForHover = layers.filter(l => l.isVisible && !l.isLocked);

        for (const layer of layersToSearchForHover) {
            if (foundDimVertexHover) break;

            for (const [dlIdx, dl] of (layer.dimensionLines || []).entries()) {
                if (foundDimVertexHover) break;
                for (const [vIdx, vertex] of (dl.points || []).entries()) {
                    if (calculateDistance(worldPosOriginal, vertex) < VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale * 1.5) {
                        setHoveredDimensionVertexInfo({ layerId: layer.id, dimensionLineIndexInLayer: dlIdx, vertexIndex: vIdx, visualPoint: vertex });
                        foundDimVertexHover = true;
                        break;
                    }
                }
            }
        }
        
        if (!foundDimVertexHover) {
            for (const layer of layersToSearchForHover) {
                for (const [dlIdx, dl] of (layer.dimensionLines || []).entries()) {
                    if ((dl.points || []).length < 2) continue;
                    
                    const p1 = dl.points[0];
                    const pN = dl.points[dl.points.length - 1];

                    const scaledTextOffset = getScaledScreenValue(BASE_DIMENSION_TEXT_OFFSET_SCREEN_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX) / transform.scale;
                    const offset = dl.customOffset !== undefined ? dl.customOffset : scaledTextOffset;

                    let dx = pN.x - p1.x;
                    let dy = pN.y - p1.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    let nx = 0, ny = 0;
                    if (len > 0) { nx = -dy / len; ny = dx / len; } else { nx = 0; ny = -1; }
                    
                    const finalNx = nx * dl.offsetSide;
                    const finalNy = ny * dl.offsetSide;

                    const visualP1 = { x: p1.x + finalNx * offset, y: p1.y + finalNy * offset };
                    const visualPN = { x: pN.x + finalNx * offset, y: pN.y + finalNy * offset };
                    
                    const { dist, closestPoint } = distancePointToSegment(worldPosOriginal, visualP1, visualPN);
                    
                    if(dist < minDistanceToDimLine) {
                        minDistanceToDimLine = dist;
                        currentHoveredDimLine = {layerId: layer.id, dimensionLineIndexInLayer: dlIdx, hoverPointOnVisualLine: closestPoint};
                    }
                }
            }
            if (currentHoveredDimLine) {
                setHoveredDimensionLineInfo(currentHoveredDimLine);
            }
        }
    }


    if (isToolActiveForInitialSnap || isDrawing || currentDimensionStartPoint || drawingGuidelineStartPoint || draggingVertex || isDraggingEdge || isDraggingDimensionLineOffset || draggingDimensionVertex || isDraggingEntireDimensionLine) {
        let segmentStartPointForSnapping: Point | null = null;
        if (isDrawing && currentPolygonPoints.length > 0) segmentStartPointForSnapping = currentPolygonPoints[currentPolygonPoints.length - 1];
        else if (currentDimensionStartPoint) segmentStartPointForSnapping = currentDimensionStartPoint;
        else if (drawingGuidelineStartPoint) segmentStartPointForSnapping = drawingGuidelineStartPoint;
        else if (draggingVertex && selectedElementInfo?.elementType === 'room') segmentStartPointForSnapping = {x: selectedElementInfo.originalX!, y: selectedElementInfo.originalY!};
        else if ((currentMode === Mode.Opening || currentMode === Mode.Door) && openingFirstPoint) segmentStartPointForSnapping = openingFirstPoint;
        
        // Handle specific snapping for Opening/Door tool phases
        if ((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo) {
            const { edgeP1, edgeP2 } = selectedOpeningWallInfo;
            
            let osnapOnEdge: CurrentSnapInfo | null = null;
    
            if (osnapSettings[OsnapType.ENDPOINT]) {
                [edgeP1, edgeP2].forEach(edgeVertex => {
                    const dist = calculateDistance(worldPosOriginal, edgeVertex);
                    if (dist < currentPointSnapThreshold) {
                        if (!osnapOnEdge || dist < calculateDistance(worldPosOriginal, osnapOnEdge.point)) {
                             osnapOnEdge = {point: {...edgeVertex}, type: SnapType.ENDPOINT_ROOM, layerId: selectedOpeningWallInfo.layerId, displayText: "Edge Vertex"};
                        }
                    }
                });
            }
            
            const midEdge = {x: (edgeP1.x + edgeP2.x)/2, y: (edgeP1.y + edgeP2.y)/2};
            if (osnapSettings[OsnapType.MIDPOINT]) {
                const dist = calculateDistance(worldPosOriginal, midEdge);
                if (dist < currentPointSnapThreshold) {
                    if (!osnapOnEdge || dist < calculateDistance(worldPosOriginal, osnapOnEdge.point)) {
                         osnapOnEdge = {point: {...midEdge}, type: SnapType.MIDPOINT_ROOM, layerId: selectedOpeningWallInfo.layerId, displayText: "Edge Midpoint"};
                    }
                }
            }
    
            if (osnapOnEdge) {
                tempPos = osnapOnEdge.point;
                finalSnapInfo = osnapOnEdge;
            } else {
                let pointToConstrain = worldPosOriginal;
                
                if (isGridSnapActive) {
                    pointToConstrain = snapToGrid(pointToConstrain.x, pointToConstrain.y);
                }
    
                tempPos = closestPointOnSegment(pointToConstrain, edgeP1, edgeP2);
    
                if (isGridSnapActive) {
                    finalSnapInfo = { point: tempPos, type: SnapType.GRID, layerId: selectedOpeningWallInfo.layerId, displayText: "Grid on Edge" };
                } else {
                    finalSnapInfo = { point: tempPos, type: SnapType.ON_SELECTED_EDGE, layerId: selectedOpeningWallInfo.layerId, displayText: "On Wall Edge" };
                }
            }
            
            hardPositionalSnapOccurred = true;
    
            if (openingFirstPoint) {
                setOpeningPreviewLine({ p1: openingFirstPoint, p2: tempPos });
            } else {
                 setPreviewLineEndPoint(tempPos); // Show cursor on edge for first point
            }
        }
        
        // Prioritize explicit close snap. If it triggers, skip all other osnaps.
        let explicitCloseSnapTriggered = false;
        if (!hardPositionalSnapOccurred && isDrawing && (currentMode === Mode.Room || currentMode === Mode.Wall)) {
            const minPointsForClose = currentMode === Mode.Room ? 2 : 2; // A wall also needs at least 2 points to be able to close.
            if (currentPolygonPoints.length >= minPointsForClose) {
                const firstPoint = currentPolygonPoints[0];
                // Use a generous threshold for closing to make it easier to hit
                if (calculateDistance(worldPosOriginal, firstPoint) < currentPointSnapThreshold * 2.5) { 
                    const closeSnap: CurrentSnapInfo = { 
                        point: {...firstPoint}, 
                        type: SnapType.ENDPOINT_ROOM,
                        layerId: activeLayerIdConst, 
                        displayText: currentMode === Mode.Wall ? "Close Wall" : "Close Room" 
                    };
                    tempPos = closeSnap.point;
                    finalSnapInfo = closeSnap;
                    hardPositionalSnapOccurred = true;
                    explicitCloseSnapTriggered = true;
                }
            }
        }
        
        // Only run other osnaps if the close snap didn't happen.
        if (!explicitCloseSnapTriggered) {
            let osnapFoundThisCycle = false;
    
            if (!hardPositionalSnapOccurred && osnapSettings[OsnapType.INTERSECTION]) {
                const intSnap = findIntersectionSnaps(tempPos, currentPointSnapThreshold, layers);
                if (intSnap) { tempPos = intSnap.point; finalSnapInfo = intSnap; osnapFoundThisCycle = true; hardPositionalSnapOccurred = true; }
            }
            if (!osnapFoundThisCycle && !hardPositionalSnapOccurred && osnapSettings[OsnapType.ENDPOINT]) {
                const epSnap = findEndpointSnaps(tempPos, currentPointSnapThreshold, layers);
                if (epSnap) { tempPos = epSnap.point; finalSnapInfo = epSnap; osnapFoundThisCycle = true; hardPositionalSnapOccurred = true; }
            }
            if (!osnapFoundThisCycle && !hardPositionalSnapOccurred && osnapSettings[OsnapType.MIDPOINT]) {
                const midSnap = findMidpointSnaps(tempPos, currentPointSnapThreshold, layers);
                if (midSnap) { tempPos = midSnap.point; finalSnapInfo = midSnap; osnapFoundThisCycle = true; hardPositionalSnapOccurred = true; }
            }
            if (!osnapFoundThisCycle && !hardPositionalSnapOccurred && osnapSettings[OsnapType.PERPENDICULAR] && segmentStartPointForSnapping) {
                const perpSnap = findPerpendicularSnaps(tempPos, segmentStartPointForSnapping, currentPerpendicularSnapThreshold, layers);
                if (perpSnap) { tempPos = perpSnap.point; finalSnapInfo = perpSnap; osnapFoundThisCycle = true; hardPositionalSnapOccurred = true; angleFixedByParallelOrPerp = true;
                             }
            }
            if (!osnapFoundThisCycle && !hardPositionalSnapOccurred && osnapSettings[OsnapType.CENTER]) {
                const centerSnap = findGeometricCenterSnaps(tempPos, currentPointSnapThreshold, layers);
                if (centerSnap) { tempPos = centerSnap.point; finalSnapInfo = centerSnap; osnapFoundThisCycle = true; hardPositionalSnapOccurred = true; }
            }
    
            if (!osnapFoundThisCycle && !hardPositionalSnapOccurred && currentMode === Mode.Wall) {
                const roomPerimeterSnap = findRoomPerimeterSnaps(tempPos, currentPointSnapThreshold, layers);
                if (roomPerimeterSnap) {
                    tempPos = roomPerimeterSnap.point;
                    finalSnapInfo = roomPerimeterSnap;
                    hardPositionalSnapOccurred = true;
                    osnapFoundThisCycle = true; 
                }
            }
            
            let parallelSnapResult: CurrentSnapInfo | null = null;
            if (osnapSettings[OsnapType.PARALLEL] && segmentStartPointForSnapping && (isDrawing || currentDimensionStartPoint || drawingGuidelineStartPoint) && !angleFixedByParallelOrPerp && !((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo)) { // Disable parallel for opening points on edge
                parallelSnapResult = findParallelSnap(worldPosOriginal, segmentStartPointForSnapping, layers, currentParallelAngleThresholdRad, activeLayerIdConst);
                if (parallelSnapResult) {
                    tempPos = parallelSnapResult.point; 
                    angleFixedByParallelOrPerp = true;
                    if (!hardPositionalSnapOccurred || (finalSnapInfo && finalSnapInfo.type === SnapType.GRID) || !osnapFoundThisCycle) { 
                        finalSnapInfo = parallelSnapResult; 
                        osnapFoundThisCycle = true; 
                    }
                }
            }
    
            if (!osnapFoundThisCycle && osnapSettings[OsnapType.EXTENSION] && !hardPositionalSnapOccurred && !angleFixedByParallelOrPerp && !((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo)) { // Disable extension for opening points
                const extensionSnap = findLineExtensionSnaps(tempPos, currentLineExtensionSnapThreshold);
                if (extensionSnap) {
                    tempPos = extensionSnap.point;
                     if (!finalSnapInfo || finalSnapInfo.type === SnapType.GRID) { finalSnapInfo = extensionSnap; }
                    hardPositionalSnapOccurred = true; 
                    osnapFoundThisCycle = true; 
                }
            }
            
            if (!osnapFoundThisCycle && !hardPositionalSnapOccurred && osnapSettings[OsnapType.NEAREST]) {
                 const currentEdgeForOpeningSnap = ((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo) ? {p1: selectedOpeningWallInfo.edgeP1, p2: selectedOpeningWallInfo.edgeP2} : undefined;
                const nearestSnap = findNearestSnaps(tempPos, currentPointSnapThreshold * 0.75, layers, currentEdgeForOpeningSnap);
                if (nearestSnap) { tempPos = nearestSnap.point; finalSnapInfo = nearestSnap; hardPositionalSnapOccurred = true; }
            }
        }

        if (isGridSnapActive && !hardPositionalSnapOccurred && !angleFixedByParallelOrPerp && !((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo)) { // Disable grid snap if already on selected edge
            const gridSnappedPoint = snapToGrid(tempPos.x, tempPos.y);
            if (calculateDistance(tempPos, gridSnappedPoint) > 1e-6) { tempPos = gridSnappedPoint; }
            if (!finalSnapInfo) { finalSnapInfo = { point: tempPos, type: SnapType.GRID, layerId: activeLayerIdConst, displayText: "Grid" }; }
        }
        

        if (extendingDimensionInfo && currentDimensionStartPoint) {
            const { layerId, elementId, fromVertexIndex } = extendingDimensionInfo;
            const layer = layers.find(l => l.id === layerId);
            const dl = layer?.dimensionLines.find(d => d.id === elementId);
        
            if (dl && dl.points && dl.points.length >= 2) {
                let angle: number;
                if (fromVertexIndex === 0) {
                    const p0 = dl.points[0];
                    const p1 = dl.points[1];
                    angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
                } else {
                    const pLast = dl.points[dl.points.length - 1];
                    const pPrev = dl.points[dl.points.length - 2];
                    angle = Math.atan2(pLast.y - pPrev.y, pLast.x - pPrev.x);
                }
                
                const origin = currentDimensionStartPoint;
                const dx = tempPos.x - origin.x;
                const dy = tempPos.y - origin.y;
                
                const projectedLength = dx * Math.cos(angle) + dy * Math.sin(angle);
                const constrainedEndPoint = {
                    x: origin.x + projectedLength * Math.cos(angle),
                    y: origin.y + projectedLength * Math.sin(angle),
                };
                tempPos = constrainedEndPoint;
                if (finalSnapInfo) { finalSnapInfo.point = constrainedEndPoint; }
            }
        }


        if (isOrthogonalMode && segmentStartPointForSnapping && !angleFixedByParallelOrPerp && !(finalSnapInfo?.displayText?.startsWith("Close")) && !((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo)) {
            const refPointOrtho = segmentStartPointForSnapping;
            const dxRaw = tempPos.x - refPointOrtho.x;
            const dyRaw = tempPos.y - refPointOrtho.y;

            if (Math.abs(dxRaw) > Math.abs(dyRaw)) {
                tempPos.y = refPointOrtho.y; 
                lockedOrthoAxisRef.current = 'H'; 
            } else if (Math.abs(dyRaw) > Math.abs(dxRaw)) {
                tempPos.x = refPointOrtho.x; 
                lockedOrthoAxisRef.current = 'V'; 
            } else {
                if (lockedOrthoAxisRef.current === 'V') {
                    tempPos.x = refPointOrtho.x;
                } else { 
                    tempPos.y = refPointOrtho.y;
                    lockedOrthoAxisRef.current = 'H'; 
                }
            }
        }

        if (isAngleSnapActive && segmentStartPointForSnapping && !angleFixedByParallelOrPerp && !isOrthogonalMode && !(finalSnapInfo?.displayText?.startsWith("Close")) && !((currentMode === Mode.Opening || currentMode === Mode.Door) && selectedOpeningWallInfo)) {
            const refPointAngle = segmentStartPointForSnapping;
            const dxAngle = tempPos.x - refPointAngle.x; const dyAngle = tempPos.y - refPointAngle.y;
            const currentAngleDeg = toDegrees(Math.atan2(dyAngle, dxAngle));
            let bestSnapAngleDiff = Infinity; let snappedAngleDeg: number | null = null;
            const customAngleNum = parseFloat(customAngle); const anglesToUse = ANGLES_TO_SNAP_DEGREES.concat(isNaN(customAngleNum) ? [] : [customAngleNum]);
            anglesToUse.forEach(snapAngle => { let diff = Math.abs(currentAngleDeg - snapAngle); if (diff > 180) diff = 360 - diff; if (diff < ANGLE_SNAP_THRESHOLD_DEGREES && diff < bestSnapAngleDiff) { bestSnapAngleDiff = diff; snappedAngleDeg = snapAngle; } });
            if (snappedAngleDeg !== null) {
                const distAngle = calculateDistance(refPointAngle, tempPos);
                tempPos.x = refPointAngle.x + Math.cos(toRadians(snappedAngleDeg)) * distAngle;
                tempPos.y = refPointAngle.y + Math.sin(toRadians(snappedAngleDeg)) * distAngle;
            }
        }
    } 

    if (isDrawing) { 
        if (justPlacedNumericallyRef.current) {
            if (previewLineEndPoint && calculateDistance(tempPos, previewLineEndPoint) > 1e-6) {
                 justPlacedNumericallyRef.current = false;
                 setPreviewLineEndPoint(tempPos);
            }
        } else {
            setPreviewLineEndPoint(tempPos);
        }
    } else if (currentMode === Mode.Guideline && drawingGuidelineStartPoint) {
        setPreviewLineEndPoint(tempPos);
    } else if ((currentMode === Mode.Dimension || extendingDimensionInfo) && currentDimensionStartPoint) {
        setCurrentDimensionPreviewEndPoint(tempPos);
        if(calculateDistance(tempPos, currentDimensionStartPoint) > 1e-6 && !extendingDimensionInfo){
            const isLeft = isPointLeftOfLine_crossProduct(worldPosOriginal, currentDimensionStartPoint, tempPos) > 0;
            setCurrentDimensionOffsetSidePreview(isLeft ? 1 : -1);
        }
    } else if (currentMode === Mode.Opening && selectedOpeningWallInfo) {
        // Preview handled by setting openingPreviewLine if openingFirstPoint exists,
        // or previewLineEndPoint if !openingFirstPoint (cursor on edge)
        // tempPos is already constrained and snapped to the edge.
    } else if (currentMode === Mode.Door && selectedOpeningWallInfo) {
        // tempPos is already constrained and snapped to the edge.
        // We set previewLineEndPoint to show the door preview at this spot.
        setPreviewLineEndPoint(tempPos);
    }
    else if (isDraggingDimensionLineOffset && draggedDimensionLineOffsetInfo) {
        const { layerId, indexInLayer, originalPoints } = draggedDimensionLineOffsetInfo;
        const targetLayer = layers.find(l=>l.id === layerId);
        if (!targetLayer || !(targetLayer.dimensionLines || [])[indexInLayer] || !originalPoints || originalPoints.length < 2) { /* tempPos = worldPosOriginal; (already set) */ }
        else {
            const originalP1 = originalPoints[0]; const originalP2 = originalPoints[originalPoints.length -1];
            const lineDirX = originalP2.x - originalP1.x; const lineDirY = originalP2.y - originalP1.y; const lineLenSq = lineDirX * lineDirX + lineDirY * lineDirY;
            let newOffsetSide: number; let newCustomOffset: number;
            if (lineLenSq > 1e-9) { const projectedPoint = closestPointOnInfiniteLine(worldPosOriginal, originalP1, originalP2); newCustomOffset = calculateDistance(worldPosOriginal, projectedPoint); const crossProduct = (originalP2.x - originalP1.x) * (worldPosOriginal.y - originalP1.y) - (originalP2.y - originalP1.y) * (worldPosOriginal.x - originalP1.x); newOffsetSide = crossProduct > 0 ? 1 : -1;
            } else { newCustomOffset = (targetLayer.dimensionLines || [])[indexInLayer].customOffset ?? (getScaledScreenValue(BASE_DIMENSION_TEXT_OFFSET_SCREEN_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX) / transform.scale); newOffsetSide = (targetLayer.dimensionLines || [])[indexInLayer].offsetSide; }
            
            updateLayerById(layerId, lyr => ({
              ...lyr,
              dimensionLines: (lyr.dimensionLines || []).map((dl, i) => i === indexInLayer ? { ...dl, customOffset: newCustomOffset, offsetSide: newOffsetSide } : dl )
            }));
        }
    } else if (draggingDimensionVertex && selectedElementInfo?.elementType === 'dimension' && selectedElementInfo.vertexIndex !== undefined) {
        const { layerId, elementId, vertexIndex } = selectedElementInfo;
        
        // The snapped position from the logic above is the final desired position.
        // No longer constrain intermediate vertices to the line defined by their neighbors.
        const finalPos = tempPos;

        updateLayerById(layerId, lyr => ({
          ...lyr,
          dimensionLines: (lyr.dimensionLines || []).map(dl => {
            if (dl.id === elementId) {
                const newPoints = [...(dl.points || [])];
                newPoints[vertexIndex] = finalPos; 
                return { ...dl, points: newPoints };
            }
            return dl;
          })
        }));
    } else if (isDraggingEntireDimensionLine && draggedEntireDimensionLineInfo) {
        const { layerId, originalPoints, dimensionLineIndexInLayer } = draggedEntireDimensionLineInfo;
        const finalP0 = tempPos; // tempPos is the snapped anchor point position
        const finalDeltaX = finalP0.x - originalPoints[0].x;
        const finalDeltaY = finalP0.y - originalPoints[0].y;

        const newPoints = originalPoints.map(p => ({ x: p.x + finalDeltaX, y: p.y + finalDeltaY }));
        updateLayerById(layerId, lyr => ({
          ...lyr,
          dimensionLines: (lyr.dimensionLines || []).map((dl, i) => i === dimensionLineIndexInLayer ? { ...dl, points: newPoints } : dl)
        }));
    }
    else if (draggingVertex && selectedElementInfo?.elementType === 'room' && selectedElementInfo.vertexIndex !== undefined) { 
        const { layerId, elementId, vertexIndex, pathIndex } = selectedElementInfo;
        updateLayerById(layerId, lyr => ({
          ...lyr,
          rooms: (lyr.rooms || []).map(room => { 
            if (room.id === elementId) { 
              let newPoints = [...(room.points || [])];
              let newInnerPoints = room.innerPoints ? [...room.innerPoints] : undefined;

              if (pathIndex === 1 && newInnerPoints) {
                newInnerPoints[vertexIndex] = tempPos;
              } else {
                newPoints[vertexIndex] = tempPos;
              }
              
              const newArea = room.isWall 
                ? calculatePolygonArea(newPoints) - calculatePolygonArea(newInnerPoints || [])
                : calculatePolygonArea(newPoints); 
              
              const newLabelPos = (room.isWall || newPoints.length < 3) ? null : calculateCentroid(newPoints); 
              return { ...room, points: newPoints, innerPoints: newInnerPoints, area: newArea, labelPosition: newLabelPos }; 
            } 
            return room; 
          })
        }));
    }
    else if (isDraggingRoom && selectedElementInfo?.elementType === 'room') {
        const { layerId, elementId, originalPoints, initialMouseWorldPos, originalLabelPos, originalInnerPoints } = selectedElementInfo;
        if (!originalPoints || !initialMouseWorldPos) { setVisualCursorWorldPos(tempPos); return; }

        const finalP0 = tempPos; // tempPos is now the snapped anchor point position
        const finalDeltaX = finalP0.x - originalPoints[0].x;
        const finalDeltaY = finalP0.y - originalPoints[0].y;
        
        const newPoints = originalPoints.map(p => ({ x: p.x + finalDeltaX, y: p.y + finalDeltaY }));
        const newInnerPoints = originalInnerPoints ? originalInnerPoints.map(p => ({ x: p.x + finalDeltaX, y: p.y + finalDeltaY })) : undefined;
        const newLabelPos = originalLabelPos ? { x: originalLabelPos.x + finalDeltaX, y: originalLabelPos.y + finalDeltaY } : null;
        
        updateLayerById(layerId, lyr => ({
          ...lyr,
          rooms: (lyr.rooms || []).map(r => r.id === elementId ? { ...r, points: newPoints, innerPoints: newInnerPoints, labelPosition: newLabelPos } : r)
        }));
    }
    else if (isDraggingEdge && selectedElementInfo?.elementType === 'room' && selectedElementInfo.edgeIndex !== undefined) {
        const { layerId, elementId, edgeIndex, originalPoints, originalInnerPoints, initialMouseWorldPos, pathIndex } = selectedElementInfo;
        if(!originalPoints || !initialMouseWorldPos) { setVisualCursorWorldPos(tempPos); return; }
        
        // Corrected drag calculation: Use the total mouse displacement since the drag started.
        // This prevents the "skating" effect by using a non-cumulative update.
        const finalEdgeDeltaX = tempPos.x - initialMouseWorldPos.x;
        const finalEdgeDeltaY = tempPos.y - initialMouseWorldPos.y;

        // Base the new positions on the saved original points, not the live state.
        const pointsToUseForBase = (pathIndex === 1 ? originalInnerPoints : originalPoints);
        if (!pointsToUseForBase) { return; } // Safety check

        const originalP1 = pointsToUseForBase[edgeIndex];
        const originalP2 = pointsToUseForBase[(edgeIndex + 1) % pointsToUseForBase.length];

        let newP1 = { x: originalP1.x + finalEdgeDeltaX, y: originalP1.y + finalEdgeDeltaY };
        let newP2 = { x: originalP2.x + finalEdgeDeltaX, y: originalP2.y + finalEdgeDeltaY };
        
        updateLayerById(layerId, lyr => ({
          ...lyr,
          rooms: (lyr.rooms || []).map(room => { 
            if (room.id === elementId) {
              const newPointsList = [...(room.points || [])]; 
              const newInnerPointsList = room.innerPoints ? [...room.innerPoints] : undefined;

              if (pathIndex === 1 && newInnerPointsList) {
                  newInnerPointsList[edgeIndex] = newP1;
                  newInnerPointsList[(edgeIndex + 1) % newInnerPointsList.length] = newP2;
              } else {
                  newPointsList[edgeIndex] = newP1;
                  newPointsList[(edgeIndex + 1) % newPointsList.length] = newP2;
              }
              const newArea = room.isWall 
                ? calculatePolygonArea(newPointsList) - calculatePolygonArea(newInnerPointsList || [])
                : calculatePolygonArea(newPointsList); 
              const newLabelPos = (room.isWall || newPointsList.length < 3) ? null : calculateCentroid(newPointsList); 
              return { ...room, points: newPointsList, innerPoints: newInnerPointsList, area: newArea, labelPosition: newLabelPos }; 
            } 
            return room; 
          })
        }));
    }
    else if (isSplittingAttemptActive && divisionLinePoints.length === 1 && selectedElementInfo?.elementType === 'room') {
      const activeLyrForSplit = layers.find(l => l.id === selectedElementInfo.layerId);
      const room = activeLyrForSplit?.rooms?.find(r => r.id === selectedElementInfo!.elementId);
      if (room && !room.isWall) {
          setDivisionPreviewLineEndPoint(tempPos); 
      }
    }

    if(finalSnapInfo) {
      setCurrentSnapInfo(finalSnapInfo);
    }

    setVisualCursorWorldPos(tempPos); 
  }, [
    toWorld, currentUnit, isPanning, lastPanPosition, transform, currentMode, isDrawing, currentPolygonPoints,
    isOrthogonalMode, isAngleSnapActive, customAngle, snapToGrid, isGridSnapActive,
    draggingVertex, selectedElementInfo, isDraggingRoom, isDraggingEdge,
    findEndpointSnaps, findMidpointSnaps, findGeometricCenterSnaps, findIntersectionSnaps, findPerpendicularSnaps, findNearestSnaps, findRoomPerimeterSnaps,
    osnapSettings, previewLineEndPoint,
    findLineExtensionSnaps, currentPointSnapThreshold, currentLineExtensionSnapThreshold, currentParallelAngleThresholdRad, currentPerpendicularSnapThreshold,
    isSplittingAttemptActive, divisionLinePoints, getLabelWorldBoundingBox,
    currentDimensionStartPoint, currentDimensionPreviewEndPoint, 
    userGridSpacing, canvasRef,
    isDraggingDimensionLineOffset, draggedDimensionLineOffsetInfo, draggingDimensionVertex, 
    isDraggingEntireDimensionLine, draggedEntireDimensionLineInfo, drawingGuidelineStartPoint,
    layers, activeLayerId, getActiveLayer, updateLayerById, LINE_EXTENSION_RENDER_FACTOR, PARALLEL_ANGLE_THRESHOLD_DEGREES, PERPENDICULAR_SNAP_THRESHOLD_FACTOR,
    selectedOpeningWallInfo, openingFirstPoint, setOpeningPreviewLine, hoveredVertexInfo, hoveredEdgeInfo,
    extendingDimensionInfo
  ]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[role="dialog"]')) {
        return;
    }

    justPlacedNumericallyRef.current = false; // Reset on any click
    const rawClickWorldPos = toWorld({ x: event.clientX, y: event.clientY });
    let finalPlacementPos = visualCursorWorldPos ? { ...visualCursorWorldPos } : { ...rawClickWorldPos };
    
    setContextMenuState({ ...contextMenuState, show: false });
    if (editingRoomNameInfo) setEditingRoomNameInfo(null);
    if (editingDimensionOffsetInfo) setEditingDimensionOffsetInfo(null);
    if (event.button === 2) { return; } 
    if (event.button === 1 || event.metaKey || event.ctrlKey) { setIsPanning(true); setLastPanPosition({ x: event.clientX, y: event.clientY }); return; }
    
    if (extendingDimensionInfo) {
        const { layerId, elementId, fromVertexIndex } = extendingDimensionInfo;
        let nextLayersState: LayerData[] | null = null;
        setLayers(prevLayers => {
            const updatedLayers = prevLayers.map(l => {
                if (l.id === layerId) {
                    return {
                        ...l,
                        dimensionLines: l.dimensionLines.map(dl => {
                            if (dl.id === elementId) {
                                const newPoints = [...dl.points];
                                if (fromVertexIndex === 0) {
                                    newPoints.unshift(finalPlacementPos);
                                } else {
                                    newPoints.push(finalPlacementPos);
                                }
                                return { ...dl, points: newPoints };
                            }
                            return dl;
                        })
                    };
                }
                return l;
            });
            nextLayersState = updatedLayers;
            return updatedLayers;
        });

        if (nextLayersState) {
            addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
        }
        
        resetDimensionState();
        hideStatusMessage();
        return;
    }

    const currentActiveLayerForDown = getActiveLayer();
    if (!currentActiveLayerForDown || currentActiveLayerForDown.isLocked) {
      const clickedLayer = layers.find(l => {
        if (l.isLocked || !l.isVisible) return false;
        if (target instanceof Element && target.closest('[role="dialog"]')) return false;
        return true; 
      });
      if(clickedLayer && clickedLayer.id !== activeLayerId){ setActiveLayerId(clickedLayer.id); } 
      else if (!clickedLayer && !(target instanceof Element && target.closest('[role="dialog"]'))) { displayStatusMessage("Active layer is locked or no unlocked layer found under cursor.", 2000); return; }
      
      const newActiveLayerAfterPotentialChange = layers.find(l => l.id === (clickedLayer ? clickedLayer.id : activeLayerId));
      if(newActiveLayerAfterPotentialChange?.isLocked) { displayStatusMessage("Active layer is locked.", 2000); return; }
    }
    const activeLayerIdConst = getActiveLayer()!.id;

    if (currentSnapInfo && currentSnapInfo.point) { 
        finalPlacementPos = currentSnapInfo.point;
    }


    if (currentMode === Mode.Room) {
        if (distanceInputState.show) { setDistanceInputState(prev => ({ ...prev, show: false, value: '' })); }
        
        if (!isDrawing) {
            if (isSplittingAttemptActive) { // Prevent room creation during split
                return;
            }

            // Always start drawing a new room from scratch
            setIsDrawing(true);
            setCurrentPolygonPoints([finalPlacementPos]);
            setPreviewLineEndPoint(finalPlacementPos);
            setVisualCursorWorldPos(finalPlacementPos);
            lockedOrthoAxisRef.current = null;

        } else { // isDrawing is true for Room mode
            const firstPoint = currentPolygonPoints[0];
            const isClosing = currentPolygonPoints.length >= 2 && currentSnapInfo && currentSnapInfo.type === SnapType.ENDPOINT_ROOM && currentSnapInfo.displayText?.startsWith("Close") && finalPlacementPos.x === firstPoint.x && finalPlacementPos.y === firstPoint.y;
            if (isClosing) {
                finishCurrentPolygon([...currentPolygonPoints, {...finalPlacementPos}]);
            } else if (calculateDistance(finalPlacementPos, currentPolygonPoints[currentPolygonPoints.length - 1]) > 1e-6) {
                setCurrentPolygonPoints(prev => [...prev, finalPlacementPos]);
                setPreviewLineEndPoint(finalPlacementPos);
                setVisualCursorWorldPos(finalPlacementPos);
            }
        }
    } else if (currentMode === Mode.Wall) {
      if (distanceInputState.show) { setDistanceInputState(prev => ({ ...prev, show: false, value: '' })); }
      
      if (!isDrawing) {
        setIsDrawing(true);
        setCurrentPolygonPoints([finalPlacementPos]);
        setPreviewLineEndPoint(finalPlacementPos);
        setVisualCursorWorldPos(finalPlacementPos); // Ensure visual cursor also starts here
        lockedOrthoAxisRef.current = null;
      } else { 
        const firstPoint = currentPolygonPoints[0];
        const canConsiderClose = currentPolygonPoints.length >= 2;
        
        let isActuallyClosing = false;
        if (canConsiderClose && currentSnapInfo && currentSnapInfo.type === SnapType.ENDPOINT_ROOM && currentSnapInfo.displayText?.startsWith("Close") && finalPlacementPos.x === firstPoint.x && finalPlacementPos.y === firstPoint.y) {
            isActuallyClosing = true;
        }

        if (isActuallyClosing) {
          const pointsToFinalize = [...currentPolygonPoints, {...finalPlacementPos}];
          finishCurrentPolygon(pointsToFinalize); 
        } else {
          if (currentPolygonPoints.length === 0 || calculateDistance(finalPlacementPos, currentPolygonPoints[currentPolygonPoints.length - 1]) > 1e-6) {
             setCurrentPolygonPoints(prev => [...prev, finalPlacementPos]);
             setPreviewLineEndPoint(finalPlacementPos); 
             setVisualCursorWorldPos(finalPlacementPos); 
          }
        }
      }
    } else if (currentMode === Mode.Dimension) {
        if (!currentDimensionStartPoint) {
            resetDimensionState(); // Starting a new line
            setCurrentDimensionStartPoint(finalPlacementPos);
            setCurrentDimensionPreviewEndPoint(finalPlacementPos);
            setVisualCursorWorldPos(finalPlacementPos);
            lockedOrthoAxisRef.current = null;
            if (selectedElementInfo && !hoveredDimensionLineInfo && !hoveredDimensionVertexInfo) { deselectAll(); }
        } else {
            let nextLayersForDim: LayerData[] | null = null;
            let newDimLine: DimensionLine | null = null;
            let numericallyEnteredPointForDim: Point = finalPlacementPos;

            if (distanceInputState.show && distanceInputState.angle !== undefined) {
                const distVal = parseFloat(distanceInputState.value);
                if (!isNaN(distVal) && distVal > 0) {
                    const worldDist = convertValueToWorldUnits(distVal, distanceInputState.unit);
                    numericallyEnteredPointForDim = {
                        x: currentDimensionStartPoint.x + worldDist * Math.cos(distanceInputState.angle),
                        y: currentDimensionStartPoint.y + worldDist * Math.sin(distanceInputState.angle)
                    };
                }
                setDistanceInputState(prev => ({ ...prev, show: false, value: '' }));
            }

            if (calculateDistance(numericallyEnteredPointForDim, currentDimensionStartPoint) > 1e-5) {
                setLayers(prevLayers => {
                    const updatedLayers = prevLayers.map(layer => {
                        if (layer.id === activeLayerIdConst) {
                            const newDimId = layer.nextDimensionId;
                            newDimLine = { id: newDimId, points: [currentDimensionStartPoint!, numericallyEnteredPointForDim], offsetSide: currentDimensionOffsetSidePreview, isSelected: false };
                            const newDimLines = [...(layer.dimensionLines || []), newDimLine];
                            return { ...layer, dimensionLines: newDimLines, nextDimensionId: newDimId + 1 };
                        }
                        return layer;
                    });
                    nextLayersForDim = updatedLayers;
                    return updatedLayers;
                });
                
                if (nextLayersForDim) { addStateToHistory(nextLayersForDim, activeLayerIdConst, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance); }

                resetDimensionState();

                if (newDimLine) {
                   const finalLayers = nextLayersForDim || layers;
                   const finalLayerForSelection = finalLayers.find(l => l.id === activeLayerIdConst)!;
                   const newDimIndex = (finalLayerForSelection.dimensionLines || []).findIndex(d => d.id === newDimLine!.id);
                   if (newDimIndex !== -1) {
                       setTimeout(() => selectDimensionLineInLayer(activeLayerIdConst, newDimIndex), 0);
                   }
                }
            } else {
                resetDimensionState();
            }
        }
    } else if (currentMode === Mode.Guideline) {
        if (!drawingGuidelineStartPoint) {
            setDrawingGuidelineStartPoint(finalPlacementPos);
            setPreviewLineEndPoint(finalPlacementPos);
        } else {
            let nextLayersState: LayerData[] | null = null;
            const constructorLine = { p1: drawingGuidelineStartPoint, p2: finalPlacementPos };
            
            setLayers(prevLayers => {
                const layerIndex = prevLayers.findIndex(l => l.id === activeLayerIdConst);
                if (layerIndex === -1) return prevLayers;

                const newGuides: Guideline[] = [];
                const originalLayer = prevLayers[layerIndex];
                let nextId = originalLayer.nextGuidelineId;

                if (!isMultiGuideMode) {
                    newGuides.push({ id: nextId++, points: [constructorLine.p1, constructorLine.p2] });
                } else {
                    const const_dx = constructorLine.p2.x - constructorLine.p1.x;
                    const const_dy = constructorLine.p2.y - constructorLine.p1.y;
                    const const_len = Math.sqrt(const_dx * const_dx + const_dy * const_dy);

                    if (const_len < 1e-6) {
                        newGuides.push({ id: nextId++, points: [constructorLine.p1, constructorLine.p2] });
                    } else {
                        const orientationVec = { x: const_dx / const_len, y: const_dy / const_len };
                        // This is the clockwise normal vector to the line drawn from p1 to p2.
                        const distributionVec = { x: orientationVec.y, y: -orientationVec.x };
                        
                        const numGuides = multiGuideCount > 0 ? multiGuideCount : 1;
                        const distance = multiGuideDistance;

                        for (let i = 0; i < numGuides; i++) {
                            // The array is now always generated on the clockwise side of the initial line.
                            const offsetAmount = i * distance;
                            
                            const p1_offset = {
                                x: constructorLine.p1.x + distributionVec.x * offsetAmount,
                                y: constructorLine.p1.y + distributionVec.y * offsetAmount,
                            };
                            const p2_offset = {
                                x: constructorLine.p2.x + distributionVec.x * offsetAmount,
                                y: constructorLine.p2.y + distributionVec.y * offsetAmount,
                            };

                            newGuides.push({ id: nextId++, points: [p1_offset, p2_offset] });
                        }
                    }
                }
                
                if (newGuides.length > 0) {
                    const updatedLayers = [...prevLayers];
                    updatedLayers[layerIndex] = {
                        ...originalLayer,
                        guidelines: [...originalLayer.guidelines, ...newGuides],
                        nextGuidelineId: nextId,
                    };
                    nextLayersState = updatedLayers;
                    return updatedLayers;
                }
                
                return prevLayers;
            });

            if (nextLayersState) {
                addStateToHistory(nextLayersState, activeLayerIdConst, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
            }
            setDrawingGuidelineStartPoint(null);
            setPreviewLineEndPoint(null);
        }
    } else if (currentMode === Mode.Opening) {
        if (!selectedOpeningWallInfo) {
            if (hoveredEdgeInfo && hoveredEdgeInfo.isWall) {
                const targetLayer = layers.find(l => l.id === hoveredEdgeInfo.layerId);
                const wall = targetLayer?.rooms?.[hoveredEdgeInfo.roomIndexInLayer];
                if (wall && wall.isWall && wall.points.length >=2) {
                    const wallPath = hoveredEdgeInfo.pathIndex === 1 ? wall.innerPoints! : wall.points;
                    const edgeP1 = wallPath[hoveredEdgeInfo.edgeIndex];
                    const p2Index = (hoveredEdgeInfo.edgeIndex + 1) % wallPath.length;
                    const edgeP2 = wallPath[p2Index];
                     
                    setSelectedOpeningWallInfo({
                        layerId: hoveredEdgeInfo.layerId,
                        wallElementId: wall.id,
                        edgeIndex: hoveredEdgeInfo.edgeIndex,
                        pathIndex: hoveredEdgeInfo.pathIndex || 0,
                        edgeP1: edgeP1,
                        edgeP2: edgeP2!,
                        isClosedWall: !!wall.innerPoints,
                        originalWallObject: JSON.parse(JSON.stringify(wall)) // Deep copy
                    });
                    displayStatusMessage("Selected edge. Click first point of opening.", 0);
                    setOpeningPreviewLine(null);
                    setPreviewLineEndPoint(null);
                }
            } else {
                displayStatusMessage("Click on a wall edge to select it for an opening.", 2000);
            }
        } else if (!openingFirstPoint) {
            setOpeningFirstPoint(finalPlacementPos);
            displayStatusMessage("First point set. Click second point of opening.", 0);
            setOpeningPreviewLine({p1: finalPlacementPos, p2: finalPlacementPos});
        } else {
            const result = performWallCut(layers, selectedOpeningWallInfo, openingFirstPoint, finalPlacementPos);
            if (result) {
                const { nextLayers } = result;
                setLayers(nextLayers);
                addStateToHistory(nextLayers, activeLayerIdConst, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
                displayStatusMessage("Opening created.", 3000);
            }
            setSelectedOpeningWallInfo(null);
            setOpeningFirstPoint(null);
            setOpeningPreviewLine(null);
        }
    } else if (currentMode === Mode.Door) {
        if (!selectedOpeningWallInfo) {
            if (hoveredEdgeInfo && hoveredEdgeInfo.isWall) {
                const targetLayer = layers.find(l => l.id === hoveredEdgeInfo.layerId);
                const wall = targetLayer?.rooms?.[hoveredEdgeInfo.roomIndexInLayer];
                if (wall && wall.isWall && wall.points.length >= 2) {
                    const wallPath = hoveredEdgeInfo.pathIndex === 1 ? wall.innerPoints! : wall.points;
                    const edgeP1 = wallPath[hoveredEdgeInfo.edgeIndex];
                    const p2Index = (hoveredEdgeInfo.edgeIndex + 1) % wallPath.length;
                    const edgeP2 = wallPath[p2Index];
                    
                    setSelectedOpeningWallInfo({
                        layerId: hoveredEdgeInfo.layerId,
                        wallElementId: wall.id,
                        edgeIndex: hoveredEdgeInfo.edgeIndex,
                        pathIndex: hoveredEdgeInfo.pathIndex || 0,
                        edgeP1: edgeP1,
                        edgeP2: edgeP2!,
                        isClosedWall: !!wall.innerPoints,
                        originalWallObject: JSON.parse(JSON.stringify(wall))
                    });
                    displayStatusMessage("Selected wall. Click to place door.", 0);
                }
            } else {
                displayStatusMessage("Click on a wall edge to select it for the door.", 2000);
            }
        } else {
            const { wallElementId, edgeP1, edgeP2, originalWallObject, pathIndex } = selectedOpeningWallInfo;
            const wallThickness = originalWallObject.wallThickness || DEFAULT_WALL_THICKNESS_WORLD_UNITS;
            const doorWidth = DEFAULT_DOOR_WIDTH_WORLD_UNITS;

            const edgeLen = calculateDistance(edgeP1, edgeP2);
            if(edgeLen < 1e-6) return;
            const wallVector = { x: (edgeP2.x - edgeP1.x) / edgeLen, y: (edgeP2.y - edgeP1.y) / edgeLen };

            const halfWidth = doorWidth / 2;
            let op1 = { x: finalPlacementPos.x - wallVector.x * halfWidth, y: finalPlacementPos.y - wallVector.y * halfWidth };
            let op2 = { x: finalPlacementPos.x + wallVector.x * halfWidth, y: finalPlacementPos.y + wallVector.y * halfWidth };
            op1 = closestPointOnSegment(op1, edgeP1, edgeP2);
            op2 = closestPointOnSegment(op2, edgeP1, edgeP2);

            const wallCutResult = performWallCut(layers, selectedOpeningWallInfo, op1, op2);
            if (!wallCutResult) {
                showSimpleAlert("Failed to create opening for the door.");
                return;
            }

            let { nextLayers, newOrModifiedWallIds } = wallCutResult;
            
            const oppositeEdgeResult = findOppositeEdgeAndIndex(
                pathIndex === 0 ? originalWallObject.points! : originalWallObject.innerPoints!,
                selectedOpeningWallInfo.edgeIndex,
                pathIndex === 0 ? originalWallObject.innerPoints! : originalWallObject.points!,
                wallThickness
            );

            let trueCenter = finalPlacementPos;
            if (oppositeEdgeResult) {
                const oppositeP1 = oppositeEdgeResult.edge[0];
                const oppositeP2 = oppositeEdgeResult.edge[1];
                const clickOnOpposite = projectPointToLine(finalPlacementPos, oppositeP1, oppositeP2);
                trueCenter = {
                    x: (finalPlacementPos.x + clickOnOpposite.x) / 2,
                    y: (finalPlacementPos.y + clickOnOpposite.y) / 2,
                };
            }
            
            const layerToUpdate = nextLayers.find(l => l.id === activeLayerIdConst)!;
            const newDoorId = layerToUpdate.nextDoorId;
            const newDoor: Door = {
                id: newDoorId,
                layerId: activeLayerIdConst,
                center: trueCenter,
                width: doorWidth,
                wallThickness: wallThickness,
                wallVector: wallVector,
                swing: 'right_in', // Default swing
                wallElementId: newOrModifiedWallIds.length === 1 ? newOrModifiedWallIds[0] : undefined,
            };

            layerToUpdate.doors = [...(layerToUpdate.doors || []), newDoor];
            layerToUpdate.nextDoorId = newDoorId + 1;

            setLayers(nextLayers);
            addStateToHistory(nextLayers, activeLayerIdConst, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
            displayStatusMessage("Door placed. Click to place another or Esc to change walls.", 0);
        }
    }
     else if (currentMode === Mode.Edit) {
      let interactionFound = false;
      const currentActiveLayerForEdit = getActiveLayer(); 

      if (hoveredVertexInfo) {
        const { layerId: hLayerId, roomIndexInLayer: hRoomIndex, vertexIndex: hVertexIndex, pathIndex: hPathIndex } = hoveredVertexInfo;
        const targetLayer = layers.find(l => l.id === hLayerId);
        if (targetLayer) {
            const room = (targetLayer.rooms || [])[hRoomIndex];
            if (room) {
                const targetPath = hPathIndex === 1 ? room.innerPoints! : room.points;
                if (selectedElementInfo && (selectedElementInfo.layerId !== hLayerId || selectedElementInfo.elementId !== room.id || selectedElementInfo.vertexIndex !== hVertexIndex)) {
                    deselectAll();
                } else if (!selectedElementInfo) {
                    deselectAll();
                }
                setSelectedElementInfo({
                    layerId: hLayerId,
                    elementId: room.id,
                    elementType: 'room',
                    vertexIndex: hVertexIndex,
                    pathIndex: hPathIndex,
                    originalX: targetPath[hVertexIndex].x,
                    originalY: targetPath[hVertexIndex].y,
                });
                if (hLayerId !== activeLayerIdConst) setActiveLayerId(hLayerId);
                updateLayerById(hLayerId, l => ({ ...l, rooms: (l.rooms || []).map(r => r.id === room.id ? { ...r, isSelected: true } : (r.isSelected ? { ...r, isSelected: false } : r)) }));
                setDraggingVertex(true);
                interactionFound = true;
                if (isSplittingAttemptActive) { setIsSplittingAttemptActive(false); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); hideStatusMessage(); }
                lockedOrthoAxisRef.current = null;
            }
        }
      }
      if (!interactionFound && hoveredEdgeInfo) {
        const { layerId: hLayerId, roomIndexInLayer: hRoomIndex, edgeIndex: hEdgeIndex, pathIndex: hPathIndex, closestPointOnEdge } = hoveredEdgeInfo;
        const targetLayer = layers.find(l => l.id === hLayerId);
        if (targetLayer) {
            const room = (targetLayer.rooms || [])[hRoomIndex];
            if (room) {
                if (selectedElementInfo && (selectedElementInfo.layerId !== hLayerId || selectedElementInfo.elementId !== room.id || selectedElementInfo.edgeIndex !== hEdgeIndex)) {
                    deselectAll();
                } else if (!selectedElementInfo) {
                    deselectAll();
                }
                setSelectedElementInfo({
                    layerId: hLayerId,
                    elementId: room.id,
                    elementType: 'room',
                    edgeIndex: hEdgeIndex,
                    pathIndex: hPathIndex,
                    originalPoints: (room.points || []).map(p => ({ ...p })),
                    originalInnerPoints: (room.innerPoints || [])?.map(p => ({ ...p })),
                    initialMouseWorldPos: finalPlacementPos,
                    originalEdgeMidPoint: closestPointOnEdge,
                });
                if (hLayerId !== activeLayerIdConst) setActiveLayerId(hLayerId);
                updateLayerById(hLayerId, l => ({ ...l, rooms: (l.rooms || []).map(r => r.id === room.id ? { ...r, isSelected: true } : (r.isSelected ? { ...r, isSelected: false } : r)) }));
                setIsDraggingEdge(true);
                interactionFound = true;
                if (isSplittingAttemptActive) { setIsSplittingAttemptActive(false); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); hideStatusMessage(); }
                lockedOrthoAxisRef.current = null;
            }
        }
      }
      
      if (!interactionFound && hoveredDimensionVertexInfo) {
          setDraggingDimensionVertex(true);
          const targetLayer = layers.find(l=>l.id === hoveredDimensionVertexInfo.layerId);
          const dimLine = targetLayer?.dimensionLines?.[hoveredDimensionVertexInfo.dimensionLineIndexInLayer];
          if(dimLine) {
            selectDimensionLineInLayer(hoveredDimensionVertexInfo.layerId, hoveredDimensionVertexInfo.dimensionLineIndexInLayer);
            setSelectedElementInfo({
                layerId: hoveredDimensionVertexInfo.layerId,
                elementId: dimLine.id,
                elementType: 'dimension',
                vertexIndex: hoveredDimensionVertexInfo.vertexIndex,
                originalX: hoveredDimensionVertexInfo.visualPoint.x,
                originalY: hoveredDimensionVertexInfo.visualPoint.y,
                initialOffsetVector: { x:0, y:0 } 
            });
          }
          interactionFound = true;
      }
      
      if (!interactionFound && hoveredDimensionLineInfo) {
        const { layerId, dimensionLineIndexInLayer } = hoveredDimensionLineInfo;
        const targetLayer = layers.find(l => l.id === layerId);
        const dimLine = targetLayer?.dimensionLines?.[dimensionLineIndexInLayer];
  
        if (dimLine) {
          if (selectedElementInfo?.elementType === 'dimension' && selectedElementInfo.elementId === dimLine.id) {
            // Line is selected and hovered: start whole line drag
            setIsDraggingEntireDimensionLine(true);
            setDraggedEntireDimensionLineInfo({
              layerId: layerId,
              dimensionLineIndexInLayer: dimensionLineIndexInLayer,
              originalPoints: (dimLine.points || []).map(p => ({...p})),
              initialMouseWorldPos: finalPlacementPos
            });
          } else {
            // Line is hovered but not selected: start offset drag and select it
            setIsDraggingDimensionLineOffset(true);
            setDraggedDimensionLineOffsetInfo({
              layerId: layerId,
              indexInLayer: dimensionLineIndexInLayer,
              originalPoints: (dimLine.points || []).map(p => ({...p}))
            });
            selectDimensionLineInLayer(layerId, dimensionLineIndexInLayer);
          }
          interactionFound = true;
        }
      }

      if (!interactionFound && currentActiveLayerForEdit ) { 
        let determinedRoomForInteraction: {layer: LayerData, room: Room, roomIndex: number} | null = null;
        const layersToSearchForRoomClick = [getActiveLayer(), ...layers.filter(l => l.id !== activeLayerIdConst && l.isVisible && !l.isLocked)].filter(Boolean) as LayerData[];
        for (const currentLayerForHitTest of layersToSearchForRoomClick) {
            if (determinedRoomForInteraction) break;
            if (!editingRoomNameInfo) {
                for (let roomIdx = (currentLayerForHitTest.rooms || []).length - 1; roomIdx >= 0; roomIdx--) {
                    const room = (currentLayerForHitTest.rooms || [])[roomIdx];
                    if (room.isWall) continue; 
                    const labelBB = getLabelWorldBoundingBox(room, (currentLayerForHitTest.rooms || []), roomIdx, currentLayerForHitTest.id);
                    if (labelBB && finalPlacementPos.x >= labelBB.minX && finalPlacementPos.x <= labelBB.maxX && finalPlacementPos.y >= labelBB.minY && finalPlacementPos.y <= labelBB.maxY) {
                        determinedRoomForInteraction = { layer: currentLayerForHitTest, room: room, roomIndex: roomIdx };
                        break;
                    }
                }
            }
            if (determinedRoomForInteraction) break;
            for (let roomIdx = (currentLayerForHitTest.rooms || []).length - 1; roomIdx >= 0; roomIdx--) {
                const room = (currentLayerForHitTest.rooms || [])[roomIdx];
                 let pointIsIn = false;
                if (room.isWall) {
                    if (room.innerPoints) {
                        pointIsIn = isPointInPolygon(finalPlacementPos, room.points || []) && !isPointInPolygon(finalPlacementPos, room.innerPoints);
                    } else {
                         pointIsIn = isPointInPolygon(finalPlacementPos, room.points || []);
                    }
                } else {
                    if (room.isSegment) continue;
                    pointIsIn = isPointInPolygon(finalPlacementPos, room.points || []);
                }

                if (pointIsIn) {
                    determinedRoomForInteraction = { layer: currentLayerForHitTest, room: room, roomIndex: roomIdx };
                    break;
                }
            }
        }
        if (determinedRoomForInteraction) {
          const {layer: targetLayer, room: targetRoom, roomIndex: targetRoomIndex} = determinedRoomForInteraction;
          const interactedLayerId = targetLayer.id;
          if (targetRoom.isWall) {
                selectRoomInLayer(interactedLayerId, targetRoomIndex);
                setInitialDragMousePos(finalPlacementPos); 
                setIsDraggingRoom(true);
                setSelectedElementInfo({ 
                    layerId: interactedLayerId, 
                    elementId: targetRoom.id, 
                    elementType: 'room', 
                    originalPoints: (targetRoom.points || []).map(p => ({...p})), 
                    originalInnerPoints: (targetRoom.innerPoints || [])?.map(p => ({...p})),
                    initialMouseWorldPos: finalPlacementPos, 
                    originalLabelPos: null
                });
          } else {
              const labelBB = getLabelWorldBoundingBox(targetRoom, (targetLayer.rooms || []), targetRoomIndex, targetLayer.id);
              if (labelBB && finalPlacementPos.x >= labelBB.minX && finalPlacementPos.x <= labelBB.maxX && finalPlacementPos.y >= labelBB.minY && finalPlacementPos.y <= labelBB.maxY) {
                  selectRoomInLayer(interactedLayerId, targetRoomIndex);
                  setEditingRoomNameInfo({ layerId: interactedLayerId, roomIndexInLayer: targetRoomIndex, currentValue: targetRoom.name });
              } else {
                  selectRoomInLayer(interactedLayerId, targetRoomIndex);
                  setInitialDragMousePos(finalPlacementPos); 
                  setIsDraggingRoom(true);
                  setSelectedElementInfo({ 
                      layerId: interactedLayerId, 
                      elementId: targetRoom.id, 
                      elementType: 'room', 
                      originalPoints: (targetRoom.points || []).map(p => ({...p})), 
                      initialMouseWorldPos: finalPlacementPos, 
                      originalLabelPos: targetRoom.labelPosition ? {...targetRoom.labelPosition} : null 
                  });
              }
              interactionFound = true; 
          }
        }
      }
      if (!interactionFound && selectedElementInfo && !hoveredDimensionLineInfo && !hoveredVertexInfo && !hoveredEdgeInfo && hoveredRoomIndexInActiveLayer === null && hoveredLabelRoomIndexInActiveLayer === null && !hoveredDimensionVertexInfo) {
          deselectAll();
      }
    }
    if (isSplittingAttemptActive && selectedElementInfo?.elementType === 'room') {
      const activeLyrForSplit = layers.find(l => l.id === selectedElementInfo.layerId);
      const room = activeLyrForSplit?.rooms?.find(r => r.id === selectedElementInfo!.elementId);
      if (room && !room.isWall) {
          const clickedVertexIndex = (room.points || []).findIndex(p => calculateDistance(finalPlacementPos, p) < VERTEX_RENDER_RADIUS_SCREEN_PX / transform.scale * 1.5);
          if (clickedVertexIndex !== -1) {
            const clickedVertex = (room.points || [])[clickedVertexIndex];
            if (divisionLinePoints.length === 0) {
              setDivisionLinePoints([{...clickedVertex}]);
              setDivisionPreviewLineEndPoint({...clickedVertex});
              displayStatusMessage("Select second vertex for split line.", 0);
            } else if (divisionLinePoints.length === 1) {
              const firstSplitPoint = divisionLinePoints[0];
              if (clickedVertex.x === firstSplitPoint.x && clickedVertex.y === firstSplitPoint.y) {
                 displayStatusMessage("Cannot select the same vertex twice. Choose a different second vertex.", 3000);
              } else {
                 setDivisionLinePoints(prev => [...prev, {...clickedVertex}]);
                 performRoomSplit(selectedElementInfo.layerId, selectedElementInfo.elementId);
              }
            }
          } else {
            displayStatusMessage("Click on a room vertex to define split line.", 2000);
          }
      }
    }
  }, [
    toWorld, isGridSnapActive, snapToGrid, visualCursorWorldPos, currentSnapInfo,
    currentMode, isDrawing, setCurrentPolygonPoints, finishCurrentPolygon, transform, selectedElementInfo,
    selectRoomInLayer, selectDimensionLineInLayer, deselectAll, isSplittingAttemptActive, divisionLinePoints, performRoomSplit, contextMenuState,
    editingRoomNameInfo, editingDimensionOffsetInfo, getLabelWorldBoundingBox, 
    isOrthogonalMode, distanceInputState, convertValueToWorldUnits, currentUnit, currentPolygonPoints,
    currentDimensionStartPoint, addStateToHistory, 
    currentDimensionOffsetSidePreview, displayStatusMessage, canvasRef,
    hoveredDimensionLineInfo, hoveredEdgeInfo, draggingVertex, isDraggingEdge, isDraggingRoom,
    hoveredVertexInfo, hoveredRoomIndexInActiveLayer, hoveredLabelRoomIndexInActiveLayer, hoveredDimensionVertexInfo,
    layers, activeLayerId, getActiveLayer, updateLayerById, currentWallAlignment, userGridSpacing, osnapSettings,
    hideStatusMessage, setActiveLayerId, setIsSplittingAttemptActive, setDivisionLinePoints, setDivisionPreviewLineEndPoint,
    selectedOpeningWallInfo, openingFirstPoint, 
    extendingDimensionInfo, resetDimensionState,
    drawingGuidelineStartPoint, isMultiGuideMode, multiGuideCount, multiGuideDistance
  ]);

  const handleMouseUp = useCallback(() => {
    let historyNeedsUpdate = false;
    if (isPanning) { setIsPanning(false); } 
    if (draggingVertex || isDraggingRoom || isDraggingEdge || isDraggingDimensionLineOffset || draggingDimensionVertex || isDraggingEntireDimensionLine) {
        historyNeedsUpdate = true;
    }

    if (draggingVertex) { setDraggingVertex(false); } 
    if (isDraggingRoom) { setIsDraggingRoom(false); }
    if (isDraggingEdge) { setIsDraggingEdge(false); }
    if (isDraggingDimensionLineOffset) { setIsDraggingDimensionLineOffset(false); setDraggedDimensionLineOffsetInfo(null); }
    if (draggingDimensionVertex) { setDraggingDimensionVertex(false); } 
    if (isDraggingEntireDimensionLine) { setIsDraggingEntireDimensionLine(false); setDraggedEntireDimensionLineInfo(null); }
    
    // History update for opening tool is handled in createOpening
    // History update for guidelines is handled in handleMouseDown
    if (historyNeedsUpdate && currentMode !== Mode.Opening && currentMode !== Mode.Guideline && currentMode !== Mode.Door) {
        addStateToHistory(layers, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
  }, [isPanning, draggingVertex, isDraggingRoom, isDraggingEdge, isDraggingDimensionLineOffset, draggingDimensionVertex, isDraggingEntireDimensionLine, addStateToHistory, layers, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, currentMode, isMultiGuideMode, multiGuideCount, multiGuideDistance]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[role="dialog"]')) {
        return;
    }
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Find current scale index by finding the closest match to the current transform.scale
    const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;
    let currentIndex = -1;
    let minDiff = Infinity;
    ARCHITECTURAL_SCALES.forEach((scale, index) => {
        const diff = Math.abs(currentArchScaleDenom - scale);
        if (diff < minDiff) {
            minDiff = diff;
            currentIndex = index;
        }
    });

    if (currentIndex === -1) return; // Should not happen if ARCHITECTURAL_SCALES is not empty

    // Determine next scale index based on scroll direction
    let nextIndex = currentIndex;
    if (event.deltaY < 0) { // Zoom in (smaller denominator)
        nextIndex = Math.max(0, currentIndex - 1);
    } else { // Zoom out (larger denominator)
        nextIndex = Math.min(ARCHITECTURAL_SCALES.length - 1, currentIndex + 1);
    }

    if (nextIndex === currentIndex) return; // No change in scale level

    const newArchScaleDenominator = ARCHITECTURAL_SCALES[nextIndex];
    const newScale = REFERENCE_ARCH_SCALE_DENOMINATOR / newArchScaleDenominator;
    
    const mousePos = { x: event.clientX, y: event.clientY }; 
    const worldPosBeforeZoom = toWorld(mousePos); 
    
    const rect = canvas.getBoundingClientRect();
    const screenMouseXOnCanvas = mousePos.x - rect.left;
    const screenMouseYOnCanvas = mousePos.y - rect.top;

    const newPanX = screenMouseXOnCanvas / newScale - worldPosBeforeZoom.x;
    const newPanY = screenMouseYOnCanvas / newScale - worldPosBeforeZoom.y;

    setTransform({ scale: newScale, panX: newPanX, panY: newPanY });
  }, [transform, toWorld, canvasRef]);
  
  const handleDeleteElement = useCallback((layerId: string, elementId: number) => {
    let nextLayersAfterDelete: LayerData[] | null = null;
    let found = false;

    setLayers(prevLayers => {
        const updatedLayers = prevLayers.map(layer => {
            if (layer.id === layerId) {
                const initialRoomCount = (layer.rooms || []).length;
                let newRooms = (layer.rooms || []).filter(room => room.id !== elementId);
                if (newRooms.length !== initialRoomCount) found = true;

                const initialDimCount = (layer.dimensionLines || []).length;
                const newDims = (layer.dimensionLines || []).filter(dl => dl.id !== elementId);
                if (newDims.length !== initialDimCount) found = true;
                
                const initialDoorCount = (layer.doors || []).length;
                const newDoors = (layer.doors || []).filter(d => d.id !== elementId);
                if (newDoors.length !== initialDoorCount) found = true;

                return { ...layer, rooms: newRooms, dimensionLines: newDims, doors: newDoors };
            }
            return layer;
        });
        if (found) {
            nextLayersAfterDelete = updatedLayers;
            return updatedLayers;
        }
        return prevLayers;
    });

    if (found && nextLayersAfterDelete) {
        addStateToHistory(nextLayersAfterDelete, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
    deselectAll();
  }, [layers, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, addStateToHistory, deselectAll, isMultiGuideMode, multiGuideCount, multiGuideDistance]);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const targetK = event.target;
    if (targetK && targetK instanceof Element && targetK.closest('input, textarea, select')) {
        if (
            !(editingRoomNameInfo && event.target === editingRoomNameInputRef.current) &&
            !(editingDimensionOffsetInfo && event.target === editingDimensionOffsetInputRef.current)
        ) {
           return;
        }
    }
    
    if (editingRoomNameInfo || editingDimensionOffsetInfo) return;

    const activeEl = document.activeElement;
    if (activeEl && activeEl instanceof Element && activeEl.closest('[role="dialog"]')) {
        if (event.key !== 'Escape') { 
            return;
        }
    }
    
    if (distanceInputState.show) {
        if (event.key === 'Enter') {
            const distVal = parseFloat(distanceInputState.value);
            setDistanceInputState(prev => ({ ...prev, show: false, value: '' })); 
    
            if (!isNaN(distVal) && distVal > 0) {
                const worldDist = convertValueToWorldUnits(distVal, distanceInputState.unit);
                const angle = distanceInputState.angle; 
                
                if ((currentMode === Mode.Room || currentMode === Mode.Wall)) {
                    if (currentPolygonPoints.length > 0) { 
                        const lastPoint = currentPolygonPoints[currentPolygonPoints.length - 1];
                        const numericallyEnteredPoint: Point = { 
                            x: lastPoint.x + worldDist * Math.cos(angle), 
                            y: lastPoint.y + worldDist * Math.sin(angle) 
                        };
                        
                        if (isNaN(numericallyEnteredPoint.x) || isNaN(numericallyEnteredPoint.y)) {
                            console.error("Calculated numericallyEnteredPoint has NaN coordinates.", {lastPoint, angle, worldDist});
                        } else {
                            setCurrentPolygonPoints(prev => [...prev, numericallyEnteredPoint]);
                            setPreviewLineEndPoint(numericallyEnteredPoint);
                            setVisualCursorWorldPos(numericallyEnteredPoint); 
                            justPlacedNumericallyRef.current = true;
                        }
                    } else {
                        console.warn("Could not add point from distance input for Room/Wall: No starting point in polygon.");
                    }
                } else if (currentMode === Mode.Dimension && currentDimensionStartPoint ) {
                    const numericallyEnteredPointForDim: Point = { 
                        x: currentDimensionStartPoint.x + worldDist * Math.cos(angle), 
                        y: currentDimensionStartPoint.y + worldDist * Math.sin(angle) 
                    };
                    
                    let nextLayersForDim: LayerData[] | null = null;
                    if (!isNaN(numericallyEnteredPointForDim.x) && !isNaN(numericallyEnteredPointForDim.y)) {
                        let newDimLine: DimensionLine | null = null;
                        setLayers(prevLayers => {
                            const updatedLayers = prevLayers.map(layer => {
                                if (layer.id === activeLayerId) {
                                    const newDimId = layer.nextDimensionId;
                                    newDimLine = { id: newDimId, points: [currentDimensionStartPoint!, numericallyEnteredPointForDim], offsetSide: currentDimensionOffsetSidePreview, isSelected: false };
                                    const newDimLines = [...(layer.dimensionLines || []), newDimLine];
                                    return { ...layer, dimensionLines: newDimLines, nextDimensionId: newDimId + 1 };
                                }
                                return layer;
                            });
                            nextLayersForDim = updatedLayers;
                            return updatedLayers;
                        });
                        if (nextLayersForDim) { addStateToHistory(nextLayersForDim, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance); }

                        resetDimensionState();
                        if (newDimLine) {
                            const finalLayers = nextLayersForDim || layers;
                            const finalLayerForSelection = finalLayers.find(l => l.id === activeLayerId)!;
                            const newDimIndex = (finalLayerForSelection.dimensionLines || []).findIndex(d => d.id === newDimLine!.id);
                            if(newDimIndex !== -1) setTimeout(() => selectDimensionLineInLayer(activeLayerId!, newDimIndex), 0);
                        }
                    } else {
                        console.error("Calculated point for dimension has NaN coordinates.");
                    }
                }
            }
            return; 
        } else if (event.key === 'Escape') {
            setDistanceInputState(prev => ({ ...prev, show: false, value: '' }));
        }
        return; 
    }

    if (event.key === 'Escape') { 
        if (extendingDimensionInfo) {
            resetDimensionState();
            hideStatusMessage();
        } else if (currentMode === Mode.Opening || currentMode === Mode.Door) {
            if (openingFirstPoint) { setOpeningFirstPoint(null); setOpeningPreviewLine(null); displayStatusMessage("Action cancelled. Select first point or Esc to exit mode.", 0); }
            else if (selectedOpeningWallInfo) { setSelectedOpeningWallInfo(null); displayStatusMessage("Wall selection cleared. Select wall edge or Esc to exit mode.", 0); }
            else { handleSetMode(Mode.Idle); }
        } else if (isDrawing || currentDimensionStartPoint || drawingGuidelineStartPoint) { setIsDrawing(false); setCurrentPolygonPoints([]); setPreviewLineEndPoint(null); resetDimensionState(); setDrawingGuidelineStartPoint(null); hideStatusMessage(); lockedOrthoAxisRef.current = null; } 
        else if (isSplittingAttemptActive) { setIsSplittingAttemptActive(false); setDivisionLinePoints([]); setDivisionPreviewLineEndPoint(null); hideStatusMessage(); } 
        else if (selectedElementInfo) { deselectAll(); } 
        else if (currentMode !== Mode.Idle) { handleSetMode(Mode.Idle); } 
        else { hideStatusMessage(); }
        if (contextMenuState.show) setContextMenuState(prev => ({ ...prev, show: false })); 
    } 
    else if (event.key === 'Enter' && isDrawing && (currentMode === Mode.Room || currentMode === Mode.Wall) ) {
        if (currentMode === Mode.Wall) {
            if (currentPolygonPoints.length >= 2) { 
                const pointsToFinalize = [...currentPolygonPoints]; 
                finishCurrentPolygon(pointsToFinalize);
            } else { 
                setIsDrawing(false);
                setCurrentPolygonPoints([]);
                setPreviewLineEndPoint(null);
            }
        } else if (currentMode === Mode.Room) {
            if (currentPolygonPoints.length >= 2) {
                let pointsToFinalize = [...currentPolygonPoints];
                const firstPoint = currentPolygonPoints[0];
                const lastPoint = currentPolygonPoints[currentPolygonPoints.length - 1];
        
                if (previewLineEndPoint && 
                    calculateDistance(previewLineEndPoint, lastPoint) > 1e-6 && 
                    currentPolygonPoints.length >= 2 && 
                    calculateDistance(previewLineEndPoint, firstPoint) < (currentPointSnapThreshold * 1.1) 
                ) {
                    pointsToFinalize.push(previewLineEndPoint);
                }
                finishCurrentPolygon(pointsToFinalize); 
            } else { 
                setIsDrawing(false);
                setCurrentPolygonPoints([]);
                setPreviewLineEndPoint(null);
            }
        }
    } 
    else if ((event.key === 'Delete' || event.key === 'Backspace') && currentMode === Mode.Edit && selectedElementInfo) { 
        handleDeleteElement(selectedElementInfo.layerId, selectedElementInfo.elementId)
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'z') { undo();
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'y') { redo();
    } else if (event.key.toLowerCase() === 'd') { handleSetMode(Mode.Room);
    } else if (event.key.toLowerCase() === 'w') { handleSetMode(Mode.Wall);
    } else if (event.key.toLowerCase() === 'm') { handleSetMode(Mode.Dimension);
    } else if (event.key.toLowerCase() === 'l') { handleSetMode(Mode.Guideline);
    } else if (event.key.toLowerCase() === 'o') { handleSetMode(Mode.Opening); // Shortcut for Opening
    } else if (event.key.toLowerCase() === 'e') { handleSetMode(Mode.Edit);
    } else if (event.key.toLowerCase() === 'g') { setIsGridSnapActive(prev => !prev);
    } else if (event.key === 'F8') { event.preventDefault(); setIsOrthogonalMode(prev => !prev); lockedOrthoAxisRef.current = null;}
    else if (event.key.toLowerCase() === 'a') { setIsAngleSnapActive(prev => !prev);
    } else if ( (isDrawing && (currentMode === Mode.Room || currentMode === Mode.Wall) && currentPolygonPoints.length > 0 && (!isNaN(parseFloat(event.key)) || (event.key === '.' && !distanceInputState.value.includes('.')))) || (currentMode === Mode.Dimension && currentDimensionStartPoint && (!isNaN(parseFloat(event.key)) || (event.key === '.' && !distanceInputState.value.includes('.')))) ) {
        justPlacedNumericallyRef.current = false; // Starting new numeric input, so previous "placed" state is over.
        if (!distanceInputState.show) {
            let lastVertexOrStartPoint: Point | null = null;
            let currentPreviewEndPointForAngle: Point | null = previewLineEndPoint; 

            if (currentMode === Mode.Room || currentMode === Mode.Wall) {
                 lastVertexOrStartPoint = currentPolygonPoints[currentPolygonPoints.length - 1];
            } else if (currentMode === Mode.Dimension) {
                 lastVertexOrStartPoint = currentDimensionStartPoint;
                 currentPreviewEndPointForAngle = currentDimensionPreviewEndPoint; 
            }

            if (lastVertexOrStartPoint && currentPreviewEndPointForAngle) {
                const screenPos = toScreen(lastVertexOrStartPoint);
                const angleForInput = Math.atan2(currentPreviewEndPointForAngle.y - lastVertexOrStartPoint.y, currentPreviewEndPointForAngle.x - lastVertexOrStartPoint.x);
                setDistanceInputState({
                    show: true,
                    x: screenPos.x + 15,
                    y: screenPos.y - 40,
                    value: event.key, 
                    angle: angleForInput, 
                    unit: currentUnit
                });
            }
        } else {
            setDistanceInputState(prev => ({ ...prev, value: prev.value + event.key }));
        }
    }
  }, [
    isDrawing, finishCurrentPolygon, deselectAll, undo, redo, currentMode, selectedElementInfo, addStateToHistory,
    isSplittingAttemptActive, editingRoomNameInfo, editingDimensionOffsetInfo, distanceInputState, currentPolygonPoints, convertValueToWorldUnits, currentUnit, previewLineEndPoint,
    lastMouseWorldPos, toScreen, currentPointSnapThreshold, hideStatusMessage, contextMenuState,
    currentDimensionStartPoint, handleSetMode, currentDimensionOffsetSidePreview, currentDimensionPreviewEndPoint, handleDeleteElement,
    selectDimensionLineInLayer, activeLayerId, currentWallAlignment, userGridSpacing, layers, osnapSettings,
    selectedOpeningWallInfo, openingFirstPoint, extendingDimensionInfo, resetDimensionState,
    drawingGuidelineStartPoint, isMultiGuideMode, multiGuideCount, multiGuideDistance
  ]);

  useEffect(() => { 
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    
    if (!editingRoomNameInfo && !editingDimensionOffsetInfo && !distanceInputState.show && !alertModalState.show) {
      const activeEl = document.activeElement;
      let shouldFocusCanvas = true;

      if (activeEl && activeEl instanceof Element) {
          if (activeEl.closest('[role="dialog"], input, select, textarea, button, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], .panel-frame-control-button')) {
              shouldFocusCanvas = false;
          }
      } else if (activeEl === null || activeEl === document.body) {
          // No specific element or body focused, canvas can take focus.
      } else {
          // Some other non-Element focusable element, assume canvas can take focus.
      }
      
      if (shouldFocusCanvas && document.activeElement !== canvasElement) {
          canvasElement.focus();
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, editingRoomNameInfo, editingDimensionOffsetInfo, distanceInputState.show, alertModalState.show, canvasRef]);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const target = event.target;
    if (target instanceof Element && target.closest('[role="dialog"]')) {
        return;
    }

    const currentActiveLayerForCtx = getActiveLayer();
    if (!currentActiveLayerForCtx) return;

    const clickWorldPos = toWorld({ x: event.clientX, y: event.clientY });
    let contextTarget: ContextTarget | null = null;
    
    if (currentMode === Mode.Edit) {
      const dimLine = hoveredDimensionLineInfo ? (layers.find(l => l.id === hoveredDimensionLineInfo.layerId)?.dimensionLines || [])[hoveredDimensionLineInfo.dimensionLineIndexInLayer] : null;

      if(hoveredDimensionVertexInfo && hoveredDimensionVertexInfo.layerId === currentActiveLayerForCtx.id){
          const dLine = (layers.find(l => l.id === hoveredDimensionVertexInfo.layerId)?.dimensionLines || [])[hoveredDimensionVertexInfo.dimensionLineIndexInLayer];
        if(dLine) contextTarget = { type: 'dimensionVertex', layerId: hoveredDimensionVertexInfo.layerId, elementId: dLine.id, dimLineIndexInLayer: hoveredDimensionVertexInfo.dimensionLineIndexInLayer, vertexIndex: hoveredDimensionVertexInfo.vertexIndex };
      }
      if(!contextTarget && hoveredDimensionLineInfo && hoveredDimensionLineInfo.layerId === currentActiveLayerForCtx.id && hoveredDimensionLineInfo.hoverPointOnVisualLine && dimLine){
        // Calculate visual line properties to check for text hover
        const p1_dl = dimLine.points[0];
        const pN_dl = dimLine.points[dimLine.points.length - 1];
        const scaledTextOffset = getScaledScreenValue(BASE_DIMENSION_TEXT_OFFSET_SCREEN_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX) / transform.scale;
        const offset = dimLine.customOffset !== undefined ? dimLine.customOffset : scaledTextOffset;
        let dx_dl = pN_dl.x - p1_dl.x;
        let dy_dl = pN_dl.y - p1_dl.y;
        const len_dl = Math.sqrt(dx_dl * dx_dl + dy_dl * dy_dl);
        let nx_dl = 0, ny_dl = 0;
        if (len_dl > 0) { nx_dl = -dy_dl / len_dl; ny_dl = dx_dl / len_dl; } else { nx_dl = 0; ny_dl = -1; }
        const finalNx_dl = nx_dl * dimLine.offsetSide;
        const finalNy_dl = ny_dl * dimLine.offsetSide;

        for(let i=0; i < (dimLine.points || []).length -1; i++){
          const segP1 = (dimLine.points || [])[i];
          const segP2 = (dimLine.points || [])[i+1];

          const segVisualP1 = { x: segP1.x + finalNx_dl * offset, y: segP1.y + finalNy_dl * offset };
          const segVisualP2 = { x: segP2.x + finalNx_dl * offset, y: segP2.y + finalNy_dl * offset };
          
          const textMidPoint = { x: (segVisualP1.x + segVisualP2.x) / 2, y: (segVisualP1.y + segVisualP2.y) / 2 };
          const scaledFontSize = getScaledScreenValue(BASE_DIMENSION_FONT_SIZE_PX, transform.scale, BASE_DIMENSION_FONT_SIZE_PX);
          
          const segLen = calculateDistance(segP1, segP2);
          const textToDisplay = formatDimension(segLen, currentUnit);
          const textWidthWorld = (textToDisplay.length * scaledFontSize * 0.6) / transform.scale;
          const textHeightWorld = scaledFontSize / transform.scale;
          
          const distToTextMid = calculateDistance(hoveredDimensionLineInfo.hoverPointOnVisualLine, textMidPoint);
          
          if(distToTextMid < Math.max(textWidthWorld, textHeightWorld) / 2 + (4 / transform.scale)) {
              const pointToInsert = closestPointOnSegment(clickWorldPos, segP1, segP2);
              contextTarget = { type: 'dimensionSegment', layerId: currentActiveLayerForCtx.id, elementId: dimLine.id, dimLineIndexInLayer: hoveredDimensionLineInfo.dimensionLineIndexInLayer, segmentIndex: i, pointOnSegment: pointToInsert };
              break;
          }
        }
           if(!contextTarget){ 
                contextTarget = { type: 'dimensionLine', layerId: currentActiveLayerForCtx.id, elementId: dimLine.id, dimLineIndexInLayer: hoveredDimensionLineInfo.dimensionLineIndexInLayer };
           }
      }
    }

    if(!contextTarget && currentMode === Mode.Edit){
        if (hoveredVertexInfo && hoveredVertexInfo.layerId === currentActiveLayerForCtx.id) {
            const room = (currentActiveLayerForCtx.rooms || [])[hoveredVertexInfo.roomIndexInLayer];
            contextTarget = { type: 'vertex', layerId: currentActiveLayerForCtx.id, elementId: room.id, roomIndexInLayer: hoveredVertexInfo.roomIndexInLayer, vertexIndex: hoveredVertexInfo.vertexIndex, pathIndex: hoveredVertexInfo.pathIndex, isWall: room?.isWall };
        } else if (hoveredEdgeInfo && hoveredEdgeInfo.layerId === currentActiveLayerForCtx.id) {
            const room = (currentActiveLayerForCtx.rooms || [])[hoveredEdgeInfo.roomIndexInLayer];
            contextTarget = { type: 'edge', layerId: currentActiveLayerForCtx.id, elementId: room.id, roomIndexInLayer: hoveredEdgeInfo.roomIndexInLayer, edgeIndex: hoveredEdgeInfo.edgeIndex, pathIndex: hoveredEdgeInfo.pathIndex, pointOnEdge: hoveredEdgeInfo.closestPointOnEdge, isWall: room?.isWall };
        } else {
            const roomToTest = selectedElementInfo?.elementType === 'room' && selectedElementInfo.layerId === currentActiveLayerForCtx.id ? (currentActiveLayerForCtx.rooms || []).find(r=>r.id === selectedElementInfo.elementId) : null;
            const roomIndexToTest = roomToTest ? (currentActiveLayerForCtx.rooms || []).findIndex(r=>r.id === roomToTest.id) : -1;

            if(roomToTest && roomIndexToTest !== -1 && isPointInPolygon(clickWorldPos, roomToTest.points || [])){
                 contextTarget = { type: 'room', layerId: currentActiveLayerForCtx.id, elementId: roomToTest.id, roomIndexInLayer: roomIndexToTest, isWall: roomToTest.isWall };
            } else {
                for (let i = (currentActiveLayerForCtx.rooms || []).length - 1; i >= 0; i--) {
                    const room = (currentActiveLayerForCtx.rooms || [])[i];
                    if (isPointInPolygon(clickWorldPos, room.points || [])) {
                        contextTarget = { type: 'room', layerId: currentActiveLayerForCtx.id, elementId: room.id, roomIndexInLayer: i, isWall: room.isWall };
                        break;
                    }
                }
            }
        }
    }

    if (contextTarget) {
        if (contextTarget.type === 'room' && (!selectedElementInfo || selectedElementInfo.elementType !== 'room' || selectedElementInfo.elementId !== contextTarget.elementId || selectedElementInfo.layerId !== contextTarget.layerId)) {
            selectRoomInLayer(contextTarget.layerId, contextTarget.roomIndexInLayer);
        } else if (contextTarget.type === 'dimensionLine' && (!selectedElementInfo || selectedElementInfo.elementType !== 'dimension' || selectedElementInfo.elementId !== contextTarget.elementId || selectedElementInfo.layerId !== contextTarget.layerId )) {
            selectDimensionLineInLayer(contextTarget.layerId, contextTarget.dimLineIndexInLayer);
        } else if ((contextTarget.type === 'dimensionVertex' || contextTarget.type === 'dimensionSegment') && (!selectedElementInfo || selectedElementInfo.elementType !== 'dimension' || selectedElementInfo.elementId !== contextTarget.elementId || selectedElementInfo.layerId !== contextTarget.layerId )) {
           selectDimensionLineInLayer(contextTarget.layerId, contextTarget.dimLineIndexInLayer);
        }
        setContextMenuState({ show: true, x: event.clientX, y: event.clientY, target: contextTarget });
    } else {
        setContextMenuState({ show: false, x: 0, y: 0, target: null });
        deselectAll(); 
    }
  }, [layers, activeLayerId, getActiveLayer, transform, selectRoomInLayer, selectDimensionLineInLayer, toWorld, deselectAll, canvasRef, hoveredDimensionLineInfo, selectedElementInfo, currentMode, hoveredDimensionVertexInfo, hoveredVertexInfo, hoveredEdgeInfo]);
  
  const handleRenameRoom = () => {
    if (contextMenuState.target?.type === 'room' && !contextMenuState.target.isWall) {
      const { layerId, roomIndexInLayer } = contextMenuState.target;
      const targetLayer = layers.find(l => l.id === layerId);
      if (targetLayer) {
        const room = (targetLayer.rooms || [])[roomIndexInLayer];
        if (room) {
          setEditingRoomNameInfo({ layerId, roomIndexInLayer, currentValue: room.name });
        }
      }
    }
    setContextMenuState(prev => ({ ...prev, show: false }));
  };

  const handleFinalizeRoomName = (newName: string, save: boolean) => { 
    if (editingRoomNameInfo && save) { 
      let nextLayersState: LayerData[] | null = null;
      setLayers(prevLayers => {
        const updatedLayers = prevLayers.map(layer => {
          if (layer.id === editingRoomNameInfo.layerId) {
            return {
              ...layer,
              rooms: (layer.rooms || []).map((room, index) => 
                index === editingRoomNameInfo.roomIndexInLayer ? { ...room, name: newName } : room
              )
            };
          }
          return layer;
        });
        nextLayersState = updatedLayers;
        return updatedLayers;
      });
      if (nextLayersState) {
        addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance); 
      }
    } 
    setEditingRoomNameInfo(null); 
  };
  
  const handleSetDimensionOffset = (targetLayerId: string, dimLineIndexInLayer: number) => {
    const targetLayer = layers.find(l => l.id === targetLayerId);
    if (targetLayer) {
      const dimLine = (targetLayer.dimensionLines || [])[dimLineIndexInLayer];
      if (dimLine) {
        const currentValue = dimLine.customOffset !== undefined
          ? convertWorldUnitsToDisplayUnit(dimLine.customOffset, currentUnit).toFixed(currentUnit === Unit.Meters ? 2 : (currentUnit === Unit.Centimeters ? 1: 0))
          : ''; 
        setEditingDimensionOffsetInfo({
          layerId: targetLayerId,
          dimensionLineIndexInLayer: dimLineIndexInLayer,
          currentValue: currentValue,
        });
      }
    }
    setContextMenuState(prev => ({ ...prev, show: false }));
  };

  const handleFinalizeDimensionOffset = (newOffsetValueStr: string, save: boolean) => { 
    if (editingDimensionOffsetInfo && save) { 
      let nextLayersState: LayerData[] | null = null;
      const newOffsetNum = parseFloat(newOffsetValueStr);
      setLayers(prevLayers => {
        const updatedLayers = prevLayers.map(layer => {
          if (layer.id === editingDimensionOffsetInfo.layerId) {
            return {
              ...layer,
              dimensionLines: (layer.dimensionLines || []).map((dl, index) => {
                if (index === editingDimensionOffsetInfo.dimensionLineIndexInLayer) {
                  return { ...dl, customText: undefined, customOffset: isNaN(newOffsetNum) ? undefined : convertValueToWorldUnits(newOffsetNum, currentUnit) };
                }
                return dl;
              })
            };
          }
          return layer;
        });
        nextLayersState = updatedLayers;
        return updatedLayers;
      });
       if (nextLayersState) {
        addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
      }
    } 
    setEditingDimensionOffsetInfo(null); 
  };

  const handleSplitRoom = () => { 
    if (contextMenuState.target?.type === 'room' && !contextMenuState.target.isWall) {
      selectRoomInLayer(contextMenuState.target.layerId, contextMenuState.target.roomIndexInLayer, true); 
      setIsSplittingAttemptActive(true); 
      displayStatusMessage("Select first vertex for split line.", 0);
    } 
    setContextMenuState(prev => ({ ...prev, show: false })); 
  }; 
  const handleCreateVertexOnEdge = () => { 
      if (contextMenuState.target?.type === 'edge') {
          const { layerId, elementId, edgeIndex, pathIndex, pointOnEdge } = contextMenuState.target;
          let nextLayersState: LayerData[] | null = null;
          setLayers(prevLayers => {
              const updatedLayers = prevLayers.map(l => {
                  if (l.id === layerId) {
                      return {
                          ...l,
                          rooms: (l.rooms || []).map(r => {
                              if (r.id === elementId) {
                                  const newPoints = pathIndex === 1 ? [...(r.innerPoints || [])] : [...(r.points || [])];
                                  newPoints.splice(edgeIndex + 1, 0, pointOnEdge);
                                  const newArea = (r.isWall || newPoints.length < 3) ? 0 : calculatePolygonArea(newPoints); 
                                  const newLabelPos = (r.isWall || newPoints.length < 3) ? null : calculateCentroid(newPoints); 
                                  if (pathIndex === 1) {
                                      return { ...r, innerPoints: newPoints, area: calculatePolygonArea(r.points) - calculatePolygonArea(newPoints), labelPosition: newLabelPos };
                                  }
                                  return { ...r, points: newPoints, area: newArea, labelPosition: newLabelPos };
                              }
                              return r;
                          })
                      };
                  }
                  return l;
              });
              nextLayersState = updatedLayers;
              return updatedLayers;
          });
          if (nextLayersState) {
              addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
          }
      }
      setContextMenuState(prev => ({ ...prev, show: false }));
  };
  const handleDeleteVertex = () => {
    if (contextMenuState.target?.type === 'vertex') {
      const { layerId, elementId, vertexIndex, pathIndex } = contextMenuState.target;
      let nextLayersState: LayerData[] | null = null;
      setLayers(prevLayers => {
          const updatedLayers = prevLayers.map(l => {
              if (l.id === layerId) {
                  return {
                      ...l,
                      rooms: (l.rooms || []).map(r => {
                          if (r.id === elementId) {
                              const pointsToModify = pathIndex === 1 ? r.innerPoints : r.points;
                              if ((pointsToModify || []).length > (r.isSegment ? 2 : 3) ) {
                                  const newPoints = (pointsToModify || []).filter((_, index) => index !== vertexIndex);
                                  const newArea = (r.isWall || newPoints.length < 3) ? 0 : calculatePolygonArea(newPoints); 
                                  const newLabelPos = (r.isWall || newPoints.length < 3) ? null : calculateCentroid(newPoints);
                                  if (pathIndex === 1) {
                                      return { ...r, innerPoints: newPoints, area: calculatePolygonArea(r.points) - newArea, labelPosition: newLabelPos };
                                  }
                                  return { ...r, points: newPoints, area: newArea, labelPosition: newLabelPos };
                              }
                          }
                          return r;
                      })
                  };
              }
              return l;
          });
          nextLayersState = updatedLayers;
          return updatedLayers;
      });
      if (nextLayersState) {
        addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
      }
    }
    setContextMenuState(prev => ({ ...prev, show: false }));
  };

  const handleCreateVertexOnDimensionSegment = () => {
    if (contextMenuState.target?.type === 'dimensionSegment') {
        const { layerId, elementId, segmentIndex, pointOnSegment } = contextMenuState.target;
        let nextLayersState: LayerData[] | null = null;
        setLayers(prevLayers => {
            const updatedLayers = prevLayers.map(l => {
                if (l.id === layerId) {
                    return {
                        ...l,
                        dimensionLines: (l.dimensionLines || []).map(dl => {
                            if (dl.id === elementId) {
                                const newPoints = [...(dl.points || [])];
                                newPoints.splice(segmentIndex + 1, 0, pointOnSegment);
                                return { ...dl, points: newPoints };
                            }
                            return dl;
                        })
                    };
                }
                return l;
            });
            nextLayersState = updatedLayers;
            return updatedLayers;
        });
        if(nextLayersState) addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
    setContextMenuState(prev => ({ ...prev, show: false }));
  };
  const handleDeleteDimensionVertex = () => {
    if (contextMenuState.target?.type === 'dimensionVertex') {
        const { layerId, elementId, vertexIndex } = contextMenuState.target;
        let nextLayersState: LayerData[] | null = null;
        setLayers(prevLayers => {
            const updatedLayers = prevLayers.map(l => {
                if (l.id === layerId) {
                    return {
                        ...l,
                        dimensionLines: (l.dimensionLines || []).map(dl => {
                            if (dl.id === elementId) {
                                if ((dl.points || []).length > 2) {
                                    const newPoints = (dl.points || []).filter((_, index) => index !== vertexIndex);
                                    return { ...dl, points: newPoints };
                                }
                            }
                            return dl;
                        })
                    };
                }
                return l;
            });
            nextLayersState = updatedLayers;
            return updatedLayers;
        });
        if(nextLayersState) addStateToHistory(nextLayersState, activeLayerId, currentWallAlignment, userGridSpacing, osnapSettings, isMultiGuideMode, multiGuideCount, multiGuideDistance);
    }
    setContextMenuState(prev => ({ ...prev, show: false }));
  };
  
  const handleExtendDimensionLine = () => {
    if (contextMenuState.target?.type === 'dimensionVertex') {
      const { layerId, elementId, dimLineIndexInLayer, vertexIndex } = contextMenuState.target;
      const layer = layers.find(l => l.id === layerId);
      const dl = layer?.dimensionLines[dimLineIndexInLayer];
      if (dl && dl.points) {
        const vertexPoint = dl.points[vertexIndex];
        setExtendingDimensionInfo({ layerId, elementId, fromVertexIndex: vertexIndex });
        setCurrentDimensionStartPoint({ ...vertexPoint });
        setCurrentDimensionPreviewEndPoint({ ...vertexPoint });
        setVisualCursorWorldPos({ ...vertexPoint });
        displayStatusMessage("Extend dimension: Click to set new endpoint.", 0);
      }
    }
    setContextMenuState(prev => ({ ...prev, show: false }));
  };

  const canExtendDimensionLine = useMemo(() => {
    if (contextMenuState.target?.type === 'dimensionVertex') {
        const { layerId, elementId, vertexIndex } = contextMenuState.target;
        const layer = layers.find(l => l.id === layerId);
        const dl = layer?.dimensionLines.find(d => d.id === elementId);
        if (dl && dl.points) {
            return vertexIndex === 0 || vertexIndex === dl.points.length - 1;
        }
    }
    return false;
  }, [contextMenuState.target, layers]);

  
  return (
    <div ref={canvasContainerRef} className="w-screen h-screen bg-gray-100 overflow-hidden relative font-sans flex flex-col">
      <TopRightControls 
        onUndo={undo}
        onRedo={redo}
        canUndo={historyStack.length > 1}
        canRedo={redoStack.length > 0}
        onToggleLayersPanel={() => handleTogglePanelVisibility('layers_panel')}
      />
      <LeftBarFixed 
        currentMode={currentMode}
        onSetMode={handleSetMode}
        isMultiGuideMode={isMultiGuideMode}
        onSetMultiGuideMode={handleSetMultiGuideMode}
      />
      <BottomBarFixed 
        currentUnit={currentUnit}
        onSetUnit={setCurrentUnit}
        architecturalScale={architecturalScale}
        onSetArchitecturalScale={handleSetArchitecturalScaleDenominator}
        isGridVisible={isGridVisible}
        onToggleGridVisible={handleToggleGridVisible}
        isGridSnapActive={isGridSnapActive}
        onToggleGridSnap={handleToggleGridSnap}
        userGridSpacing={userGridSpacing}
        onSetUserGridSpacing={setUserGridSpacing}
        convertWorldUnitsToDisplayUnit={convertWorldUnitsToDisplayUnit}
        convertValueToWorldUnits={convertValueToWorldUnits}
        isAngleSnapActive={isAngleSnapActive}
        onToggleAngleSnap={handleToggleAngleSnap}
        customAngle={customAngle}
        onSetCustomAngle={setCustomAngle}
        isOrthogonalMode={isOrthogonalMode}
        onToggleOrthogonalMode={handleToggleOrthogonalMode}
        osnapSettings={osnapSettings}
        onToggleOsnap={handleToggleOsnap}
      />
       <main className="flex-grow w-full h-full relative">
        <CanvasComponent
          ref={canvasRef}
          layers={layers}
          activeLayerId={activeLayerId}
          currentPolygonPoints={currentPolygonPoints}
          previewLineEndPoint={previewLineEndPoint}
          currentDimensionStartPoint={currentDimensionStartPoint}
          currentDimensionPreviewEndPoint={currentDimensionPreviewEndPoint}
          currentDimensionOffsetSidePreview={currentDimensionOffsetSidePreview}
          transform={transform}
          isDrawing={isDrawing}
          isGridVisible={isGridVisible}
          userGridSpacing={userGridSpacing}
          isEditModeActive={currentMode === Mode.Edit}
          selectedElementInfo={selectedElementInfo}
          currentSnapInfo={currentSnapInfo}
          hoveredVertexInfo={hoveredVertexInfo}
          hoveredEdgeInfo={hoveredEdgeInfo}
          hoveredRoomIndexInActiveLayer={hoveredRoomIndexInActiveLayer}
          contextMenuState={contextMenuState}
          draggingVertex={draggingVertex}
          isDraggingEdge={isDraggingEdge}
          isSplittingAttemptActive={isSplittingAttemptActive}
          divisionLinePoints={divisionLinePoints}
          divisionPreviewLineEndPoint={divisionPreviewLineEndPoint}
          currentUnit={currentUnit}
          editingRoomNameInfo={editingRoomNameInfo}
          currentMode={currentMode}
          currentWallThickness={currentWallThickness}
          currentWallAlignment={currentWallAlignment}
          visualCursorWorldPos={visualCursorWorldPos}
          extendingDimensionInfo={extendingDimensionInfo}
          hoveredDimensionLineInfo={hoveredDimensionLineInfo}
          hoveredDimensionVertexInfo={hoveredDimensionVertexInfo}
          isDraggingDimensionLineOffset={isDraggingDimensionLineOffset}
          draggedDimensionLineOffsetInfo={draggedDimensionLineOffsetInfo}
          draggingDimensionVertex={draggingDimensionVertex}
          selectedDimensionVertexInfoInternal={selectedDimensionVertexInfoInternal}
          isDraggingEntireDimensionLine={isDraggingEntireDimensionLine}
          draggedEntireDimensionLineInfo={draggedEntireDimensionLineInfo}
          isPanning={isPanning}
          selectedOpeningWallInfo={selectedOpeningWallInfo}
          openingFirstPoint={openingFirstPoint}
          openingPreviewLine={openingPreviewLine}
          drawingGuidelineStartPoint={drawingGuidelineStartPoint}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />
      </main>

       {panelStates.map(panel => (
        <FloatingPanelWrapper 
          key={panel.id}
          {...panel}
          onPositionChange={handlePanelPositionChange}
          onBringToFront={handleBringToFront}
          onClose={panel.canClose ? () => handleTogglePanelVisibility(panel.id) : undefined}
        >
          {panel.contentRenderer({})}
        </FloatingPanelWrapper>
      ))}

      <StatusBar statusMessage={statusMessage?.text ?? null} />
      
      <DistanceInputComponent
        isVisible={distanceInputState.show}
        position={{ x: distanceInputState.x, y: distanceInputState.y }}
        unit={distanceInputState.unit}
        value={distanceInputState.value}
        onChange={(val) => setDistanceInputState(p => ({...p, value: val}))}
        onKeyDown={(key) => handleKeyDown({ key } as KeyboardEvent)}
        onBlur={() => setDistanceInputState(p => ({ ...p, show: false, value: ''}))}
      />
      
      {contextMenuState.target && (
         <ContextMenuComponent
          isVisible={contextMenuState.show}
          position={{ x: contextMenuState.x, y: contextMenuState.y }}
          target={contextMenuState.target!}
          onRename={handleRenameRoom}
          onSplit={handleSplitRoom}
          onDeleteVertex={handleDeleteVertex}
          handleCreateVertexOnEdge={handleCreateVertexOnEdge}
          canDeleteVertex={(contextMenuState.target?.type === 'vertex' && layers.find(l=>l.id===contextMenuState.target.layerId)?.rooms[contextMenuState.target.roomIndexInLayer]?.points.length > 3) ?? false}
          onSetDimensionOffset={handleSetDimensionOffset}
          onCreateVertexOnDimensionSegment={handleCreateVertexOnDimensionSegment}
          onDeleteDimensionVertex={handleDeleteDimensionVertex}
          canDeleteDimensionVertex={(contextMenuState.target?.type === 'dimensionVertex' && layers.find(l=>l.id===contextMenuState.target.layerId)?.dimensionLines[contextMenuState.target.dimLineIndexInLayer]?.points.length > 2) ?? false}
          onExtendDimensionLine={handleExtendDimensionLine}
          canExtendDimensionLine={canExtendDimensionLine}
          onDeleteElement={handleDeleteElement}
          onClose={() => setContextMenuState(prev => ({...prev, show: false}))}
        />
      )}
     
      <RoomNameInputComponent
        ref={editingRoomNameInputRef}
        isVisible={!!editingRoomNameInfo}
        room={editingRoomNameInfo ? layers.find(l => l.id === editingRoomNameInfo.layerId)?.rooms[editingRoomNameInfo.roomIndexInLayer] || null : null}
        transform={transform}
        initialValue={editingRoomNameInfo?.currentValue ?? ''}
        onFinalize={handleFinalizeRoomName}
        toScreen={toScreen}
      />

      <DimensionOffsetInputComponent
        ref={editingDimensionOffsetInputRef}
        isVisible={!!editingDimensionOffsetInfo}
        dimensionLine={editingDimensionOffsetInfo ? layers.find(l => l.id === editingDimensionOffsetInfo.layerId)?.dimensionLines[editingDimensionOffsetInfo.dimensionLineIndexInLayer] || null : null}
        transform={transform}
        initialValue={editingDimensionOffsetInfo?.currentValue ?? ''}
        unit={currentUnit}
        onFinalize={handleFinalizeDimensionOffset}
        toScreen={toScreen}
        baseOffsetScreenPx={BASE_DIMENSION_TEXT_OFFSET_SCREEN_PX}
        baseFontSizePx={BASE_DIMENSION_FONT_SIZE_PX}
      />
      
      <Modal
        isOpen={alertModalState.show}
        onClose={() => setAlertModalState({ show: false, message: '' })}
        title="Alert"
      >
        <p className="text-gray-600 mb-6">{alertModalState.message}</p>
        <button onClick={() => setAlertModalState({ show: false, message: '' })} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors">
          OK
        </button>
      </Modal>
    </div>
  );
}