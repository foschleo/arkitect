





export interface Point {
  x: number;
  y: number;
}

export enum WallAlignment {
  Centered = 'centered',
  Exterior = 'exterior', // Drawn line is outer face, thickness goes IN
  Interior = 'interior', // Drawn line is inner face, thickness goes OUT
}

export interface Room {
  id: number; // Unique within its layer
  points: Point[];
  innerPoints?: Point[]; // For closed walls with holes
  name: string;
  area: number;
  labelPosition: Point | null;
  isSelected: boolean;
  wallThickness?: number; // Kept for info, but geometry is in points/innerPoints
  isWall?: boolean;
  isSegment?: boolean;
  wallAlignment?: WallAlignment; // Kept for info
}

export interface DimensionLine {
  id: number; // Unique within its layer
  points: Point[]; 
  offsetSide: number; 
  customText?: string;
  isSelected?: boolean; 
  customOffset?: number; 
}

export interface Guideline {
  id: number;
  points: [Point, Point];
}

export interface Door {
  id: number;
  layerId: string;
  wallElementId?: number; 
  
  center: Point; 
  width: number;
  wallThickness: number;
  
  wallVector: Point; 
  
  swing: 'left_in' | 'left_out' | 'right_in' | 'right_out';
  
  isSelected?: boolean;
}

export interface LayerData {
  id: string; // Globally unique ID for the layer
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number; // Opacity for rendering when not active (0-1)
  rooms: Room[];
  dimensionLines: DimensionLine[];
  guidelines: Guideline[];
  doors: Door[];
  nextRoomId: number; // Counter for unique room IDs within this layer
  nextDimensionId: number; // Counter for unique dimension IDs within this layer
  nextGuidelineId: number;
  nextDoorId: number;
}

export enum Unit {
  Meters = 'm',
  Centimeters = 'cm',
  Millimeters = 'mm',
}

export enum Mode {
  Room = 'room',
  Wall = 'wall',
  Edit = 'edit',
  Dimension = 'dimension',
  Opening = 'opening',
  Door = 'door',
  Guideline = 'guideline',
  Idle = 'idle',
}

export interface Transform {
  scale: number;
  panX: number;
  panY: number;
}

export enum OsnapType {
  ENDPOINT = 'osnap_endpoint',
  MIDPOINT = 'osnap_midpoint',
  CENTER = 'osnap_center', // Geometric center for now
  INTERSECTION = 'osnap_intersection',
  PERPENDICULAR = 'osnap_perpendicular',
  NEAREST = 'osnap_nearest', // Snaps to any point on an object's line
  EXTENSION = 'osnap_extension', // Kept for future direct toggle, currently global
  PARALLEL = 'osnap_parallel',   // Kept for future direct toggle, currently global
}


export enum SnapType {
  ENDPOINT_ROOM = 'endpoint_room',
  ENDPOINT_DIM = 'endpoint_dim',
  MIDPOINT_ROOM = 'midpoint_room',
  MIDPOINT_DIM = 'midpoint_dim',
  LINE_EXTENSION_ROOM_WALL = 'line_extension_room_wall',
  LINE_EXTENSION_DIM = 'line_extension_dim',
  INTERSECTION = 'intersection', // Generic intersection, more specific below
  PERPENDICULAR = 'perpendicular', // Generic perpendicular, more specific below
  GRID = 'grid',
  CENTER_ROOM = 'center_room', // Deprecated, use GEOMETRIC_CENTER
  ON_LINE = 'on_line', // Nearest point on a line segment (generic)
  ON_ROOM_PERIMETER = 'on_room_perimeter', // Specific: Nearest point on a room's edge
  PARALLEL = 'parallel',
  GEOMETRIC_CENTER = 'geometric_center', // Snaps to centroid of a closed shape
  INTERSECTION_POINT = 'intersection_point', // Specific point of two line segments intersecting
  PERPENDICULAR_POINT = 'perpendicular_point', // Point on a line forming a perpendicular with current segment
  ON_SELECTED_EDGE = 'on_selected_edge', // Specific snap for opening tool
}

export interface CurrentSnapInfo {
  point: Point;
  type: SnapType;
  layerId: string; // ID of the layer the snapped element belongs to
  relatedElements?: { 
    p1?: Point; // For line segments, extensions, perpendicular bases
    p2?: Point; // For line segments, extensions, perpendicular bases
    p3?: Point; // For intersections (second line segment)
    p4?: Point; // For intersections (second line segment)
    angle?: number; // Optional: Store the angle for parallel/perpendicular snaps
    elementId?: number | string; // ID of the element snapped to
    elementType?: 'room' | 'wall' | 'dimension';
  };
  displayText?: string; 
}


export interface SelectedElementInfo {
  layerId: string;
  elementId: number; // ID of the room or dimension line
  elementType: 'room' | 'dimension' | 'door';
  vertexIndex?: number; // For vertex selection
  pathIndex?: 0 | 1; // For wall vertex selection
  edgeIndex?: number; // For edge selection
  originalX?: number; // For vertex drag
  originalY?: number; // For vertex drag
  initialOffsetVector?: Point; // For dimension vertex drag
  originalPoints?: Point[]; // For dragging entire dimension line or room
  originalInnerPoints?: Point[]; // For dragging room with a hole
  initialMouseWorldPos?: Point; // For dragging entire room or dimension line
  originalLabelPos?: Point | null; // For dragging room
  originalEdgeMidPoint?: Point; // For dragging edge
}


export interface HoveredVertexInfo { 
  layerId: string;
  roomIndexInLayer: number; 
  vertexIndex: number;
  pathIndex?: 0 | 1; // 0 for outer path (points), 1 for inner path (innerPoints)
  snapType?: SnapType; 
}

export interface HoveredEdgeInfo { 
  layerId: string;
  roomIndexInLayer: number; 
  edgeIndex: number;
  pathIndex?: 0 | 1; // 0 for outer path (points), 1 for inner path (innerPoints)
  closestPointOnEdge: Point;
  snapType?: SnapType; 
  isWall?: boolean; // Added to distinguish wall edges for opening tool
}

export interface SelectedDimensionVertexInfo { // Retain for internal state during drag maybe
  layerId: string;
  dimensionLineIndexInLayer: number;
  vertexIndex: number;
  originalX: number; 
  originalY: number; 
  initialOffsetVector: Point; 
}

export interface HoveredDimensionVertexInfo {
  layerId: string;
  dimensionLineIndexInLayer: number;
  vertexIndex: number;
  visualPoint: Point; 
  snapType?: SnapType; 
}


export interface HoveredDimensionLineInfo { 
  layerId: string;
  dimensionLineIndexInLayer: number; 
  hoverPointOnVisualLine?: Point; 
}


export interface EditingRoomNameInfo {
  layerId: string;
  roomIndexInLayer: number; 
  inputElementRef?: HTMLInputElement | null;
  currentValue: string;
}

export interface EditingDimensionOffsetInfo {
  layerId: string;
  dimensionLineIndexInLayer: number; 
  inputElementRef?: HTMLInputElement | null;
  currentValue: string;
}

export type ContextTarget =
  | { type: 'layer'; layerId: string; } // For layer panel context menu
  | { type: 'room'; layerId: string; elementId: number; roomIndexInLayer: number; isWall?: boolean; }
  | { type: 'door'; layerId: string; elementId: number; doorIndexInLayer: number; }
  | { type: 'vertex'; layerId: string; elementId: number; roomIndexInLayer: number; vertexIndex: number; pathIndex?: 0 | 1; isWall?: boolean; } 
  | { type: 'edge'; layerId: string; elementId: number; roomIndexInLayer: number; edgeIndex: number; pathIndex?: 0 | 1; pointOnEdge: Point; isWall?: boolean; } 
  | { type: 'dimensionLine'; layerId: string; elementId: number; dimLineIndexInLayer: number; } 
  | { type: 'dimensionVertex'; layerId: string; elementId: number; dimLineIndexInLayer: number; vertexIndex: number; } 
  | { type: 'dimensionSegment'; layerId: string; elementId: number; dimLineIndexInLayer: number; segmentIndex: number; pointOnSegment: Point; }; 


export interface DistanceInputState {
  show: boolean;
  x: number;
  y: number;
  value: string;
  angle: number; // Angle (in radians) for the numeric input direction
  unit: Unit;
}

export interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  target: ContextTarget | null;
}

export interface AlertModalState {
  show: boolean;
  message: string;
}

export interface InferenceTipState {
  show: boolean;
  screenX: number;
  screenY: number;
  text: string;
}

export interface RoomBoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
}

export interface AppStateSnapshot {
  layers: LayerData[]; // LayerData.rooms will now include 'openings'
  activeLayerId: string | null;
  currentWallAlignment: WallAlignment;
  userGridSpacing: number;
  osnapSettings: Record<OsnapType, boolean>;
  isMultiGuideMode: boolean;
  multiGuideCount: number;
  multiGuideDistance: number;
  // panelStates?: FloatingPanelState[]; // Optional: if we want to save panel positions in history
}

export interface DragEntireDimensionLineInfo { 
    layerId: string;
    dimensionLineIndexInLayer: number;
    originalPoints: Point[]; 
    initialMouseWorldPos: Point; 
}

export type PanelId = 
  | 'wall_thickness_panel'
  | 'wall_alignment_panel'
  | 'layers_panel'
  | 'guideline_settings_panel'
  | 'door_properties_panel';

export interface FloatingPanelConfig {
  id: PanelId;
  title: string;
  initialPosition: Point;
  initialSize?: { width: string | number; height: string | number };
  isPinned: boolean;
  isVisible: boolean;
  zIndex: number;
  canClose?: boolean; 
  minWidth?: string;
  contentRenderer: (props: any) => React.ReactNode; 
  hideFrameControls?: boolean;
}
export interface FloatingPanelState extends FloatingPanelConfig {
  currentPosition: Point;
}

// Props for control components (some may be used in fixed bars too)
export interface UndoRedoPanelProps { // Renamed for clarity, can be used by fixed bar
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface ModeButtonPanelProps { // Simplified for fixed bars
  mode: Mode;
  currentMode: Mode;
  onSetMode: (mode: Mode) => void;
  titleHint: string;
  label: string;
}

export interface ToggleButtonPanelProps { // Simplified for fixed bars
  isPressed: boolean;
  onToggle: () => void;
  label: string;
  titleHint: string;
}

export interface LayersTogglePanelProps { // Simplified for fixed bars
  onToggleLayerPanel: () => void;
}

export interface GridSnapPanelProps { // Can be used by fixed bar OR dropdown
  isGridSnapActive: boolean;
  onToggleGridSnap: () => void;
  userGridSpacing: number;
  onSetUserGridSpacing: (spacing: number) => void;
  currentUnit: Unit;
  convertWorldUnitsToDisplayUnit: (worldValue: number, unit: Unit) => number;
  convertValueToWorldUnits: (value: number, unit: Unit) => number;
}

export interface AngleSnapPanelProps { // Can be used by fixed bar OR dropdown
  isAngleSnapActive: boolean;
  onToggleAngleSnap: () => void;
  customAngle: string;
  onSetCustomAngle: (angle: string) => void;
}

export interface OsnapSettingsPanelProps extends GridSnapPanelProps, AngleSnapPanelProps {
  osnapSettings: Record<OsnapType, boolean>;
  onToggleOsnap: (type: OsnapType) => void;
  // Ortho mode props
  isOrthogonalMode: boolean;
  onToggleOrthogonalMode: () => void;
}

export interface WallThicknessPanelProps { // Still for floating panel
  currentWallThickness: number;
  onSetWallThickness: (thickness: number) => void;
  currentUnit: Unit;
  convertWorldUnitsToDisplayUnit: (worldValue: number, unit: Unit) => number;
  convertValueToWorldUnits: (value: number, unit: Unit) => number;
}

export interface WallAlignmentPanelProps { // Still for floating panel
  currentWallAlignment: WallAlignment;
  onSetWallAlignment: (alignment: WallAlignment) => void;
}

export interface GuidelineSettingsPanelProps {
    isMultiGuideMode: boolean;
    multiGuideCount: number;
    onSetMultiGuideCount: (count: number) => void;
    multiGuideDistance: number;
    onSetMultiGuideDistance: (distance: number) => void;
    currentUnit: Unit;
    convertWorldUnitsToDisplayUnit: (worldValue: number, unit: Unit) => number;
    convertValueToWorldUnits: (value: number, unit: Unit) => number;
}

export interface DoorPropertiesPanelProps {
    selectedDoor: Door | null;
    onUpdateDoor: (doorId: number, newSwing: Door['swing']) => void;
}

export interface UnitsScalePanelProps { // Can be used by fixed bar
  currentUnit: Unit;
  onSetUnit: (unit: Unit) => void;
  architecturalScale: number;
}

// For Opening Tool
export interface SelectedOpeningWallInfo {
  layerId: string;
  wallElementId: number;
  edgeIndex: number;
  pathIndex: 0 | 1; // 0 for outer path, 1 for inner path
  edgeP1: Point;
  edgeP2: Point;
  isClosedWall: boolean; // true if the original wall was a closed loop
  originalWallObject: Room; // Keep a copy of the original wall object
}