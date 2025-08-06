import React, { useEffect, useRef } from 'react';
import { ContextTarget } from '../types';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  target: ContextTarget;
  onRename: () => void;
  onSplit: () => void;
  onDeleteVertex: () => void;
  handleCreateVertexOnEdge: () => void;
  onSetDimensionOffset: (layerId: string, dimLineIndexInLayer: number) => void;
  onCreateVertexOnDimensionSegment: () => void;
  onDeleteDimensionVertex: () => void;
  onExtendDimensionLine: () => void;
  onDeleteElement: (layerId: string, elementId: number) => void;
  canDeleteVertex: boolean;
  canDeleteDimensionVertex: boolean;
  canExtendDimensionLine: boolean;
  onClose: () => void;
}

const ContextMenuComponentInternal: React.FC<ContextMenuProps> = ({
  isVisible, position, target, onRename, onSplit, onDeleteVertex, handleCreateVertexOnEdge,
  onSetDimensionOffset, onCreateVertexOnDimensionSegment, onDeleteDimensionVertex,
  onExtendDimensionLine, onDeleteElement,
  canDeleteVertex, canDeleteDimensionVertex, canExtendDimensionLine, onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  useEffect(() => {
    if (isVisible && menuRef.current) {
        const menuWidth = menuRef.current.offsetWidth;
        const menuHeight = menuRef.current.offsetHeight;
        let newX = position.x;
        let newY = position.y;

        if (position.x + menuWidth > window.innerWidth) {
            newX = window.innerWidth - menuWidth - 10;
        }
        if (position.y + menuHeight > window.innerHeight) {
            newY = window.innerHeight - menuHeight - 10;
        }
        if (newX < 5) newX = 5;
        if (newY < 5) newY = 5;

        menuRef.current.style.left = `${newX}px`;
        menuRef.current.style.top = `${newY}px`;
    }
  }, [isVisible, position]);

  if (!isVisible || !target) return null;

  const isVertexTarget = target.type === 'vertex';
  const isRoomTarget = target.type === 'room';
  const isEdgeTarget = target.type === 'edge';
  const isDimensionLineTarget = target.type === 'dimensionLine';
  const isDimensionVertexTarget = target.type === 'dimensionVertex';
  const isDimensionSegmentTarget = target.type === 'dimensionSegment';
  const isLayerTarget = target.type === 'layer';
  const isTargetWall = target.type === 'room' && target.isWall === true;
  const isTargetRegularRoom = target.type === 'room' && !target.isWall;


  const menuItemClass = "block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-sky-500/80 hover:text-white transition-colors duration-150 focus:outline-none focus:bg-sky-500/80 focus:text-white";
  const destructiveMenuItemClass = "block w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-500/80 hover:text-white transition-colors duration-150 focus:outline-none focus:bg-red-500/80 focus:text-white";
  const disabledMenuItemClass = "block w-full px-3.5 py-2 text-left text-sm text-slate-400 cursor-not-allowed";

  return (
    <div
      ref={menuRef}
      className="absolute bg-white/85 border border-slate-300/60 rounded-md shadow-lg z-[1001] py-1 min-w-[240px] backdrop-blur-md"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      role="menu"
    >
      {isTargetRegularRoom && (
        <button onClick={onRename} className={menuItemClass} role="menuitem">
          Rename Room
        </button>
      )}
      {isTargetRegularRoom && (
        <button onClick={onSplit} className={menuItemClass} role="menuitem">
          Split Room
        </button>
      )}
      {isVertexTarget && (
        <button
          onClick={onDeleteVertex}
          disabled={!canDeleteVertex}
          className={canDeleteVertex ? menuItemClass : disabledMenuItemClass}
          role="menuitem"
          aria-disabled={!canDeleteVertex}
        >
          Delete Vertex
        </button>
      )}
      {isEdgeTarget && (
        <>
          <button onClick={handleCreateVertexOnEdge} className={menuItemClass} role="menuitem">
            Create Vertex on Edge
          </button>
          {target.isWall && (
            <button
              onClick={() => onDeleteElement(target.layerId, target.elementId)}
              className={destructiveMenuItemClass}
              role="menuitem"
            >
              Delete Wall
            </button>
          )}
        </>
      )}
       {(isTargetRegularRoom || isTargetWall) && (
        <button
          onClick={() => onDeleteElement(target.layerId, target.elementId)}
          className={destructiveMenuItemClass}
          role="menuitem"
        >
          {isTargetWall ? 'Delete Wall' : 'Delete Room'}
        </button>
      )}
      {isDimensionLineTarget && (
        <>
          <button
            onClick={() => onSetDimensionOffset(target.layerId, target.dimLineIndexInLayer)}
            className={menuItemClass}
            role="menuitem"
          >
            Set Custom Text Offset...
          </button>
          <button
            onClick={() => onDeleteElement(target.layerId, target.elementId)}
            className={destructiveMenuItemClass}
            role="menuitem"
          >
            Delete Dimension
          </button>
        </>
      )}
      {isDimensionSegmentTarget && (
        <button onClick={onCreateVertexOnDimensionSegment} className={menuItemClass} role="menuitem">
          Add Breakpoint
        </button>
      )}
      {isDimensionVertexTarget && (
        <>
          {canExtendDimensionLine && (
            <button onClick={onExtendDimensionLine} className={menuItemClass} role="menuitem">
              Extend Dimension Line
            </button>
          )}
          <button
            onClick={onDeleteDimensionVertex}
            disabled={!canDeleteDimensionVertex}
            className={canDeleteDimensionVertex ? menuItemClass : disabledMenuItemClass}
            role="menuitem"
            aria-disabled={!canDeleteDimensionVertex}
          >
            Delete Dimension Vertex
          </button>
        </>
      )}
    </div>
  );
};

const ContextMenuComponent = React.memo(ContextMenuComponentInternal);
ContextMenuComponent.displayName = 'ContextMenuComponent';
export default ContextMenuComponent;