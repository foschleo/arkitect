
import React, { useState, useRef, useEffect } from 'react';
import { Point, PanelId } from '../types';
// Lucide icons removed

interface FloatingPanelWrapperProps {
  id: PanelId;
  title: string; // Kept for potential aria-label or other non-visual uses
  children: React.ReactNode;
  initialPosition: Point;
  currentPosition: Point;
  isPinned: boolean;
  isVisible: boolean;
  zIndex: number;
  onPositionChange: (id: PanelId, newPos: Point) => void;
  onClose?: (id: PanelId) => void;
  onBringToFront: (id: PanelId) => void;
  minWidth?: string;
  initialSize?: { width: string | number; height: string | number };
  hideFrameControls?: boolean;
}

const FloatingPanelWrapper: React.FC<FloatingPanelWrapperProps> = ({
  id,
  title,
  children,
  currentPosition,
  isPinned,
  isVisible,
  zIndex,
  onPositionChange,
  onClose,
  onBringToFront,
  minWidth = 'auto',
  initialSize,
  hideFrameControls,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef<Point>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) {
      setIsDragging(false);
    }
  }, [isVisible]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || isPinned || !panelRef.current) return;

      let newX = event.clientX - dragStartOffset.current.x;
      let newY = event.clientY - dragStartOffset.current.y;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = panelRef.current.offsetWidth;
      const panelHeight = panelRef.current.offsetHeight;

      newX = Math.max(0, Math.min(newX, viewportWidth - panelWidth));
      newY = Math.max(0, Math.min(newY, viewportHeight - panelHeight));

      onPositionChange(id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging && !isPinned) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isPinned, onPositionChange, id]);


  const handlePanelMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
        // If target is not an Element, it cannot have 'closest'.
        // Still bring panel to front, but don't check for specific controls.
        onBringToFront(id);
        return;
    }

    if (target.closest('button, input, select, textarea')) {
      if (!target.closest('.panel-frame-control-button')) {
        onBringToFront(id);
      }
      return;
    }

    if (isPinned) {
      onBringToFront(id);
      return;
    }

    setIsDragging(true);
    dragStartOffset.current = {
      x: event.clientX - currentPosition.x,
      y: event.clientY - currentPosition.y,
    };
    onBringToFront(id);
  };

  if (!isVisible) return null;

  const controlButtonClass = "panel-frame-control-button absolute p-0.5 rounded-full bg-slate-200/80 hover:bg-slate-300/90 text-slate-600 hover:text-slate-800 shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 z-10 text-[10px] font-semibold flex items-center justify-center backdrop-blur-sm";

  return (
    <div
      ref={panelRef}
      className="absolute bg-slate-100/85 text-slate-800 rounded-md shadow-xl border border-slate-300/70 flex flex-col backdrop-blur-md"
      style={{
        left: `${currentPosition.x}px`,
        top: `${currentPosition.y}px`,
        zIndex,
        minWidth: minWidth,
        width: initialSize?.width,
        height: initialSize?.height,
        cursor: !isPinned ? (isDragging ? 'grabbing' : 'grab') : 'default',
        overflow: 'visible',
      }}
      onMouseDown={handlePanelMouseDown}
      role="dialog"
      aria-label={title}
      aria-grabbed={!isPinned && isDragging}
    >
      {!hideFrameControls && (
        <>
          {/* Pin button removed as per request for all panels to be free-moving like layers panel */}
          {/* The isPinned state and onPinToggle are effectively no longer used for panels where hideFrameControls=true */}

          {onClose && (
            <button
                onClick={(e) => { e.stopPropagation(); onClose(id); }}
                title="Close Panel"
                className={`${controlButtonClass} top-0.5 right-0.5`} // Adjusted position due to pin removal
                style={{ width: '18px', height: '18px' }}
                aria-label="Close panel"
            >
                X
            </button>
          )}
        </>
      )}

      <div
        className={`p-1.5 ${!hideFrameControls ? 'pt-6' : ''} overflow-auto flex-grow bg-transparent`}
        style={{ minHeight: initialSize?.height ? '0': '20px' }}
      >
        {children}
      </div>
    </div>
  );
};

FloatingPanelWrapper.displayName = 'FloatingPanelWrapper';
export default FloatingPanelWrapper;
