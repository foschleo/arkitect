
import React, { useEffect, useRef, forwardRef, useCallback } from 'react';
import { Point, Room, Transform, HoveredVertexInfo, SelectedElementInfo, Unit, EditingRoomNameInfo, ContextMenuState, HoveredEdgeInfo, Mode, DimensionLine, WallAlignment, HoveredDimensionLineInfo, SelectedDimensionVertexInfo, HoveredDimensionVertexInfo, DragEntireDimensionLineInfo, CurrentSnapInfo, LayerData, SelectedOpeningWallInfo, Guideline, Door } from '../types';
import {
  drawGrid,
  drawRooms,
  drawDoors,
  drawDoorPreview,
  drawCurrentPolygon,
  drawDivisionLinePreview,
  drawHighlights,
  drawManualDimensionLines,
  drawDimensionPreview,
  drawOpeningPreview,
  drawGuidelines,
  getAbntHeightMm,
  getScaledScreenValue
} from '../utils';
import { BALL_CURSOR_STYLE, REFERENCE_ARCH_SCALE_DENOMINATOR } from '../constants';

interface CanvasComponentProps {
  layers: LayerData[];
  activeLayerId: string | null;

  currentPolygonPoints: Point[];
  previewLineEndPoint: Point | null;
  currentDimensionStartPoint: Point | null;
  currentDimensionPreviewEndPoint: Point | null;
  currentDimensionOffsetSidePreview: number;
  transform: Transform;
  isDrawing: boolean;
  isGridVisible: boolean;
  userGridSpacing: number;
  isEditModeActive: boolean;
  selectedElementInfo: SelectedElementInfo | null;
  currentSnapInfo: CurrentSnapInfo | null;
  hoveredVertexInfo: HoveredVertexInfo | null;
  hoveredEdgeInfo: HoveredEdgeInfo | null;
  hoveredRoomIndexInActiveLayer: number | null;
  contextMenuState: ContextMenuState;
  draggingVertex: boolean;
  isDraggingEdge: boolean;
  isSplittingAttemptActive: boolean;
  divisionLinePoints: Point[];
  divisionPreviewLineEndPoint: Point | null;
  currentUnit: Unit;
  editingRoomNameInfo: EditingRoomNameInfo | null;
  currentMode: Mode;
  currentWallThickness: number;
  currentWallAlignment: WallAlignment;
  visualCursorWorldPos: Point | null;
  extendingDimensionInfo: { layerId: string; elementId: number; fromVertexIndex: number; } | null;

  hoveredDimensionLineInfo: HoveredDimensionLineInfo | null;
  hoveredDimensionVertexInfo: HoveredDimensionVertexInfo | null;
  isDraggingDimensionLineOffset: boolean;
  draggedDimensionLineOffsetInfo: { layerId: string; indexInLayer: number; originalPoints: Point[]; } | null;
  draggingDimensionVertex: boolean;
  selectedDimensionVertexInfoInternal: SelectedDimensionVertexInfo | null;
  isDraggingEntireDimensionLine: boolean;
  draggedEntireDimensionLineInfo: DragEntireDimensionLineInfo | null;
  isPanning: boolean;

  // Opening tool props
  selectedOpeningWallInfo: SelectedOpeningWallInfo | null;
  openingFirstPoint: Point | null;
  openingPreviewLine: {p1: Point, p2: Point} | null;

  drawingGuidelineStartPoint: Point | null;

  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => void;
  onContextMenu: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

const INACTIVE_LAYER_BLUR_PX = 0.5;

const CanvasComponent = React.memo(forwardRef<HTMLCanvasElement, CanvasComponentProps>((props, forwardedRef) => {
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  const { onMouseDown, onMouseMove, onMouseUp, onWheel, onContextMenu } = props;

  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | undefined>(undefined);

  const setRefs = useCallback((node: HTMLCanvasElement | null) => {
    localCanvasRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
    }
    if (node) {
      node.style.cursor = propsRef.current.isPanning ? 'grabbing' : BALL_CURSOR_STYLE;
    }
  }, [forwardedRef]);

  const renderLoop = useCallback((_timestamp: DOMHighResTimeStamp): void => {
    const canvas = localCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) { console.error("Failed to get 2D context from canvas element."); return; }

    const currentProps = propsRef.current;
    const {
      layers, activeLayerId,
      currentPolygonPoints, previewLineEndPoint, currentDimensionStartPoint, currentDimensionPreviewEndPoint, currentDimensionOffsetSidePreview,
      transform, isDrawing, isGridVisible, userGridSpacing, isEditModeActive, selectedElementInfo,
      currentSnapInfo, hoveredVertexInfo, hoveredEdgeInfo, hoveredRoomIndexInActiveLayer, contextMenuState, draggingVertex,
      isDraggingEdge, isSplittingAttemptActive,
      divisionLinePoints, divisionPreviewLineEndPoint, currentUnit, editingRoomNameInfo, currentMode,
      currentWallThickness, currentWallAlignment, visualCursorWorldPos,
      extendingDimensionInfo,
      hoveredDimensionLineInfo, hoveredDimensionVertexInfo,
      isDraggingDimensionLineOffset, draggedDimensionLineOffsetInfo, draggingDimensionVertex, selectedDimensionVertexInfoInternal,
      isDraggingEntireDimensionLine, draggedEntireDimensionLineInfo, isPanning,
      selectedOpeningWallInfo, openingFirstPoint, openingPreviewLine, drawingGuidelineStartPoint,
    } = currentProps;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const panXScaled = transform.panX * transform.scale; const panYScaled = transform.panY * transform.scale;
    ctx.translate(panXScaled, panYScaled); ctx.scale(transform.scale, transform.scale);

    drawGrid(ctx, canvas, transform, isGridVisible, userGridSpacing);

    const activeLayerIndex = activeLayerId ? layers.findIndex(l => l.id === activeLayerId) : -1;
    const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;

    layers.slice().reverse().forEach((layer, indexInReversedArray) => {
        if (!layer.isVisible) return;

        const originalGlobalAlpha = ctx.globalAlpha;
        const originalFilter = ctx.filter;

        const layerIndexInOriginalArray = layers.length - 1 - indexInReversedArray;
        const isActive = layer.id === activeLayerId;

        if (isActive) {
            ctx.globalAlpha = layer.opacity;
            ctx.filter = 'none';
        } else {
            if (activeLayerIndex !== -1) {
                const distanceFromActive = Math.abs(layerIndexInOriginalArray - activeLayerIndex);
                const opacityFactor = Math.max(0.3, 0.7 - (distanceFromActive - 1) * 0.1);
                ctx.globalAlpha = layer.opacity * opacityFactor;
                ctx.filter = `blur(${INACTIVE_LAYER_BLUR_PX}px)`;
            } else {
                ctx.globalAlpha = layer.opacity * 0.5;
                ctx.filter = `blur(${INACTIVE_LAYER_BLUR_PX}px)`;
            }
        }
        if (layer.isLocked && !isActive) {
          ctx.globalAlpha *= 0.7;
        }

        drawGuidelines(ctx, layer.guidelines, transform, canvas);

        const selectedRoomIdInLayer = (isActive && selectedElementInfo?.elementType === 'room' && selectedElementInfo.layerId === layer.id) ? selectedElementInfo.elementId : null;
        const selectedDimIdInLayer = (isActive && selectedElementInfo?.elementType === 'dimension' && selectedElementInfo.layerId === layer.id) ? selectedElementInfo.elementId : null;
        const selectedDoorIdInLayer = (isActive && selectedElementInfo?.elementType === 'door' && selectedElementInfo.layerId === layer.id) ? selectedElementInfo.elementId : null;

        const editingRoomNameInfoForThisLayer = (editingRoomNameInfo && editingRoomNameInfo.layerId === layer.id && isActive) ? editingRoomNameInfo : null;
        const hoveredRoomIndexForThisLayer = (isActive) ? hoveredRoomIndexInActiveLayer : null;

        drawRooms(
          ctx, layer.rooms, transform, currentUnit,
          isActive && isEditModeActive,
          selectedRoomIdInLayer,
          editingRoomNameInfoForThisLayer,
          isActive && isSplittingAttemptActive,
          isActive ? divisionLinePoints : [],
          hoveredRoomIndexForThisLayer,
          layer.id,
          isActive,
          getAbntHeightMm,
          getScaledScreenValue,
          REFERENCE_ARCH_SCALE_DENOMINATOR
        );

        drawDoors(ctx, layer.doors, transform, selectedDoorIdInLayer);

        let hoveredDimLineIndexInLayer = -1;
        if (hoveredDimensionLineInfo && hoveredDimensionLineInfo.layerId === layer.id && isActive) {
            hoveredDimLineIndexInLayer = hoveredDimensionLineInfo.dimensionLineIndexInLayer;
        }
        const isDimLineOffsetDragActiveLayer = isDraggingDimensionLineOffset && draggedDimensionLineOffsetInfo?.layerId === layer.id && isActive;
        const isDimVertexDragActiveLayer = draggingDimensionVertex && selectedElementInfo?.layerId === layer.id && selectedElementInfo.elementType === 'dimension' && isActive;
        const isDimEntireDragActiveLayer = isDraggingEntireDimensionLine && draggedEntireDimensionLineInfo?.layerId === layer.id && isActive;

        drawManualDimensionLines(
          ctx, layer.dimensionLines, transform, currentUnit, layer.id,
          selectedDimIdInLayer,
          isDimLineOffsetDragActiveLayer ? draggedDimensionLineOffsetInfo!.indexInLayer : null,
          isDimVertexDragActiveLayer ? layer.dimensionLines.findIndex(dl => dl.id === selectedElementInfo!.elementId) : null,
          hoveredDimLineIndexInLayer,
          isActive && isEditModeActive,
          (hoveredDimensionVertexInfo?.layerId === layer.id && isActive) ? hoveredDimensionVertexInfo : null,
          isDimEntireDragActiveLayer,
          (isDimEntireDragActiveLayer) ? draggedEntireDimensionLineInfo : null,
          currentArchScaleDenom
        );

        ctx.globalAlpha = originalGlobalAlpha;
        ctx.filter = originalFilter;
    });


    const activeLayerForPrimitives = (activeLayerIndex !== -1 && layers[activeLayerIndex].isVisible && !layers[activeLayerIndex].isLocked)
                                     ? layers[activeLayerIndex]
                                     : null;

    if (activeLayerForPrimitives) {
        if (currentMode === Mode.Room || currentMode === Mode.Wall) {
          drawCurrentPolygon(ctx, currentPolygonPoints, previewLineEndPoint, transform, currentUnit, currentMode, currentWallThickness, isDrawing, currentWallAlignment, currentSnapInfo);
        } else if (currentMode === Mode.Guideline && drawingGuidelineStartPoint && previewLineEndPoint) {
            ctx.beginPath();
            ctx.moveTo(drawingGuidelineStartPoint.x, drawingGuidelineStartPoint.y);
            ctx.lineTo(previewLineEndPoint.x, previewLineEndPoint.y);
            ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)';
            ctx.lineWidth = 1.5 / transform.scale;
            ctx.stroke();
            ctx.setLineDash([]);
        } else if ((currentMode === Mode.Dimension || extendingDimensionInfo) && currentDimensionStartPoint && currentDimensionPreviewEndPoint) {
            drawDimensionPreview(ctx, currentDimensionStartPoint, currentDimensionPreviewEndPoint, currentDimensionOffsetSidePreview, transform, currentUnit, currentArchScaleDenom);
        } else if (isSplittingAttemptActive && divisionLinePoints.length > 0 && divisionPreviewLineEndPoint) {
            const isEditModeActiveForLayer = layers.some(l => l.id === activeLayerId && isEditModeActive);
            drawDivisionLinePreview(ctx, transform, isEditModeActiveForLayer, isSplittingAttemptActive, divisionLinePoints, divisionPreviewLineEndPoint);
        } else if (currentMode === Mode.Opening) {
            drawOpeningPreview(ctx, transform, selectedOpeningWallInfo!, openingFirstPoint, openingPreviewLine, previewLineEndPoint, currentUnit, getScaledScreenValue, REFERENCE_ARCH_SCALE_DENOMINATOR);
        } else if (currentMode === Mode.Door && selectedOpeningWallInfo && previewLineEndPoint) {
            drawDoorPreview(ctx, transform, selectedOpeningWallInfo, previewLineEndPoint);
        }

        const isEditModeActiveForLayer = layers.some(l => l.id === activeLayerId && isEditModeActive);
        drawHighlights(ctx, transform, layers, activeLayerId, currentPolygonPoints, previewLineEndPoint, currentSnapInfo, hoveredVertexInfo, hoveredEdgeInfo, contextMenuState, draggingVertex, isDraggingEdge, selectedElementInfo, isEditModeActiveForLayer, isDrawing, isSplittingAttemptActive, currentMode, currentDimensionStartPoint, currentDimensionPreviewEndPoint, hoveredDimensionLineInfo, hoveredDimensionVertexInfo, draggingDimensionVertex, selectedDimensionVertexInfoInternal, selectedOpeningWallInfo, openingFirstPoint);
    }

    ctx.restore();
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
  }, []);

  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [renderLoop]);

  return (
    <canvas
      ref={setRefs}
      className="w-full h-full outline-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      tabIndex={0}
    >
      Canvas not supported.
    </canvas>
  );
}));

CanvasComponent.displayName = 'CanvasComponent';
export default CanvasComponent;
