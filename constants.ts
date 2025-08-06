





export const UNITS_PER_METER = 100.0;
export const DEFAULT_GRID_SPACING_WORLD_UNITS = 5.0; // Default, will be overridden by user setting
export const METRIC_MARKER_INTERVAL_WORLD_UNITS = UNITS_PER_METER;

// Factors for dynamic calculation based on userGridSpacing
export const POINT_SNAP_THRESHOLD_GRID_FACTOR = 1.5; 
export const LINE_EXTENSION_SNAP_THRESHOLD_FACTOR = 1.2; // New: for snapping to line extensions
export const LINE_EXTENSION_RENDER_FACTOR = UNITS_PER_METER * 0.2; // Defines padding for rendering line extensions
export const PARALLEL_ANGLE_THRESHOLD_DEGREES = 5; // Max angle diff for parallel snap
export const PERPENDICULAR_SNAP_THRESHOLD_FACTOR = 0.75; // Threshold for snapping to a perpendicular point relative to grid spacing

export const VERTEX_RENDER_RADIUS_SCREEN_PX = 5;
export const EDGE_HOVER_THRESHOLD_SCREEN_PX = 14; // Increased from 8 to 14

export const BASE_DIMENSION_FONT_SIZE_PX = 10;
export const BASE_DIMENSION_TEXT_OFFSET_SCREEN_PX = 15; // This is now a fallback, real offset is calculated from paper units
export const BASE_DIMENSION_TICK_LENGTH_SCREEN_PX = 8;
export const BASE_LABEL_FONT_SIZE_PX = 12;
export const VISIBILITY_SCALE_EXPONENT = -1.0; 
export const ABNT_REF_HEIGHT_MM = 3.5; 
export const ANGLES_TO_SNAP_DEGREES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];
export const ANGLE_SNAP_THRESHOLD_DEGREES = 4;
export const EDGE_MIDPOINT_RADIUS_SCREEN_PX = 3;
export const ARCHITECTURAL_SCALES = [1, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 1000, 2000, 2500, 3000, 5000];
export const REFERENCE_ARCH_SCALE_DENOMINATOR = 100; 
export const ANNOTATION_VISIBILITY_THRESHOLD_SCALE = 1000; 

// New constants for dimensioning based on paper measurements (ABNT standards)
export const DIM_OFFSET_MM = 9.0; // Target offset from object to dimension line (7-10mm range)
export const DIM_EXTENSION_MM = 2.0; // How far the dimension line extends past the extension lines
export const DIM_EXTENSION_LINE_GAP_MM = 1.5; // Gap between object and start of extension line

export const MAX_HISTORY_SIZE = 30;

export const BALL_CURSOR_STYLE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><circle cx='12' cy='12' r='3' fill='black'/></svg>") 12 12, auto`;

export const DEFAULT_WALL_THICKNESS_WORLD_UNITS = UNITS_PER_METER * 0.2; // 20cm default thickness
export const DEFAULT_DOOR_WIDTH_WORLD_UNITS = UNITS_PER_METER * 0.8; // 80cm default door width
export const DEFAULT_DOOR_PANEL_THICKNESS_WORLD_UNITS = 5.0; // 5cm
export const DEFAULT_DOOR_JAMB_THICKNESS_WORLD_UNITS = 5.0; // 5cm
export const DEFAULT_DOOR_HINGE_OFFSET_WORLD_UNITS = 5.0; // 5cm
export const DEFAULT_GUIDELINE_COUNT = 10;
export const DEFAULT_GUIDELINE_DISTANCE_WORLD_UNITS = UNITS_PER_METER * 1.0; // 1 meter

// Grid drawing optimization constants
export const MIN_SCREEN_PIXELS_FOR_SUB_GRID_LINES = 4;
export const MIN_SCREEN_PIXELS_FOR_USER_GRID_MARKERS = 10;

// Snap Indicator Styles
export const SNAP_INDICATOR_SIZE_SCREEN_PX = 8;
export const SNAP_ENDPOINT_COLOR = 'rgba(72, 187, 120, 0.9)'; // Green
export const SNAP_MIDPOINT_COLOR = 'rgba(66, 153, 225, 0.9)'; // Blue
export const SNAP_CENTER_COLOR = 'rgba(255, 87, 34, 0.9)'; // Deep Orange for Center
export const SNAP_INTERSECTION_COLOR = 'rgba(246, 224, 94, 0.9)'; // Yellow
export const SNAP_PERPENDICULAR_COLOR = 'rgba(245, 101, 101, 0.9)'; // Red
export const SNAP_LINE_EXTENSION_COLOR = 'rgba(213, 63, 140, 0.9)'; // Magenta
export const SNAP_ON_LINE_COLOR = 'rgba(150, 150, 150, 0.8)'; // Gray (Nearest)
export const SNAP_GRID_COLOR = 'rgba(200, 200, 200, 0.7)'; // Light Gray
export const SNAP_ON_ROOM_PERIMETER_COLOR = 'rgba(173, 163, 223, 0.9)'; // Light Purple


// Compatibility export for any remaining imports of the old name
export const GRID_SPACING_WORLD_UNITS = DEFAULT_GRID_SPACING_WORLD_UNITS;