
// utils/index.ts
export * from './geometry';
export * from './units';
// export * from './drawingHelpers'; // Add if drawingHelpers.ts ever exports anything

// Explicitly re-export from drawing.ts
export {
  formatDimension,
  getAbntHeightMm,
  getScaledScreenValue,
  drawGrid,
  drawRooms,
  drawDoors,
  drawDoorPreview,
  drawCurrentPolygon,
  drawDivisionLinePreview,
  drawManualDimensionLines,
  drawDimensionPreview,
  drawHighlights,
  drawOpeningPreview,
  getPaperSpaceValueInWorldUnits,
  drawGuidelines
} from './drawing';
