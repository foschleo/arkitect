

import React, { useState, useRef, useEffect } from 'react';
import { LayerData, SelectedElementInfo } from '../types';

interface LayerItemProps {
  layer: LayerData;
  isActive: boolean;
  selectedElementInfo: SelectedElementInfo | null;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onSelectElement: (layerId: string, elementId: number, elementType: 'room' | 'dimension' | 'door') => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  isBeingDragged: boolean;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  isActive,
  selectedElementInfo,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onRename,
  onSelectElement,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOver,
  isBeingDragged,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [name, setName] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    if (name.trim() === '') {
      setName(layer.name);
    } else if (name.trim() !== layer.name) {
      onRename(layer.id, name.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setName(layer.name);
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
        setName(layer.name);
    }
  }, [layer.name, isEditing]);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  };

  const itemClasses = `
    flex items-center w-full pl-1 pr-1.5 py-1.5 rounded-sm transition-all duration-150
    group
    ${isActive ? 'bg-sky-500/75 text-white backdrop-blur-sm' : 'bg-transparent hover:bg-slate-200/50 text-slate-700'}
    ${!layer.isVisible ? 'opacity-50' : ''}
    ${layer.isLocked ? 'opacity-70' : ''}
    ${isBeingDragged ? 'opacity-40 border border-dashed border-sky-400' : 'border border-transparent'}
  `;
  const iconButtonClassBase = `p-1 rounded opacity-80 group-hover:opacity-100 transition-opacity text-[10px] min-w-[30px] text-center font-medium`;
  const iconButtonClassActive = `${isActive ? 'hover:bg-sky-400/50' : 'hover:bg-slate-200/50'}`;
  const iconColor = isActive ? 'text-white/90' : 'text-slate-500 group-hover:text-slate-700';
  const deleteIconColor = isActive ? 'text-white/90 hover:bg-red-400/80 hover:text-white' : 'text-slate-400 hover:bg-red-400/80 hover:text-white';


  return (
    <div onDragOver={isEditing ? undefined : onDragOver}>
        <div
            className={itemClasses}
            onClick={() => { if (!isEditing && !isActive) onSelect(layer.id); }}
            onDragStart={layer.isLocked || isEditing ? undefined : onDragStart}
            onDragEnter={isEditing ? undefined : onDragEnter}
            onDragEnd={layer.isLocked || isEditing ? undefined : onDragEnd}
            draggable={!isEditing && !layer.isLocked}
            role="listitem"
            aria-selected={isActive}
        >
            <button
              onClick={handleToggleExpand}
              className={`flex-shrink-0 w-6 text-center text-base p-1 rounded-sm ${isActive ? 'hover:bg-sky-400/50' : 'hover:bg-slate-200/50'}`}
              title={isExpanded ? "Collapse layer" : "Expand layer"}
              aria-expanded={isExpanded}
            >
              <span className={`inline-block transform transition-transform text-xs ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>▶</span>
            </button>
            <div
                className={`flex-shrink-0 w-5 text-center text-base ${layer.isLocked || isEditing ? 'cursor-not-allowed' : 'cursor-grab'} ${isActive ? 'text-white/70' : 'text-slate-400 group-hover:text-slate-500'}`}
                title={layer.isLocked ? "Layer locked" : (isEditing ? "Cannot drag while renaming" : "Drag to reorder")}
            >
                ||
            </div>

            {isEditing ? (
                <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/90 text-slate-800 border border-sky-500 rounded-sm px-1 py-0.5 flex-grow mr-1.5 outline-none text-xs backdrop-blur-sm"
                aria-label={`Rename layer ${layer.name}`}
                />
            ) : (
                <span
                    className={`flex-grow truncate text-xs cursor-pointer ${isActive ? 'font-medium': 'font-normal'}`}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!layer.isLocked) setIsEditing(true);
                    }}
                    onClick={() => onSelect(layer.id)}
                    title={layer.name}
                >
                {layer.name}
                </span>
            )}

            <div className="flex items-center space-x-0.5 pl-1.5 flex-shrink-0">
                <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                className={`${iconButtonClassBase} ${iconButtonClassActive} ${iconColor}`}
                title={layer.isVisible ? "Hide Layer" : "Show Layer"}
                aria-pressed={!layer.isVisible}
                aria-label={layer.isVisible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}
                >
                {layer.isVisible ? "Hide" : "Show"}
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                className={`${iconButtonClassBase} ${iconButtonClassActive} ${iconColor}`}
                title={layer.isLocked ? "Unlock Layer" : "Lock Layer"}
                aria-pressed={layer.isLocked}
                aria-label={layer.isLocked ? `Unlock layer ${layer.name}` : `Lock layer ${layer.name}`}
                >
                {layer.isLocked ? "Unlock" : "Lock"}
                </button>
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (layer.isLocked) {
                    alert("Unlock the layer before deleting.");
                    return;
                    }
                    onDelete(layer.id);
                }}
                className={`${iconButtonClassBase} ${deleteIconColor} ${layer.isLocked ? '!text-slate-400 cursor-not-allowed !hover:bg-transparent' : ''}`}
                title="Delete Layer"
                disabled={layer.isLocked}
                aria-label={`Delete layer ${layer.name}`}
                >
                Del
                </button>
            </div>
        </div>
        {isExpanded && (
            <div className="pl-6 pr-1 py-1 space-y-0.5 bg-slate-100/30">
                {(layer.rooms.length === 0 && layer.dimensionLines.length === 0 && layer.doors.length === 0) && (
                    <div className="px-2 py-1 text-xs text-slate-400 italic">No elements in this layer.</div>
                )}
                {layer.rooms.map((room) => {
                    const isElementSelected = selectedElementInfo?.elementType === 'room' && selectedElementInfo.elementId === room.id && selectedElementInfo.layerId === layer.id;
                    return (
                        <div
                            key={`room-${room.id}`}
                            onClick={() => onSelectElement(layer.id, room.id, 'room')}
                            className={`px-2 py-1 rounded-sm text-xs cursor-pointer flex items-center gap-2 ${isElementSelected ? 'bg-sky-200/80 font-semibold text-sky-800' : 'hover:bg-slate-200/70'}`}
                            title={`Select ${room.name}`}
                        >
                            <span className="font-mono text-sky-700">{room.isWall ? '[W]' : '[R]'}</span>
                            <span className="truncate">{room.name}</span>
                        </div>
                    );
                })}
                {layer.dimensionLines.map((dim) => {
                     const isElementSelected = selectedElementInfo?.elementType === 'dimension' && selectedElementInfo.elementId === dim.id && selectedElementInfo.layerId === layer.id;
                    return (
                        <div
                            key={`dim-${dim.id}`}
                            onClick={() => onSelectElement(layer.id, dim.id, 'dimension')}
                            className={`px-2 py-1 rounded-sm text-xs cursor-pointer flex items-center gap-2 ${isElementSelected ? 'bg-sky-200/80 font-semibold text-sky-800' : 'hover:bg-slate-200/70'}`}
                            title={`Select Dimension ${dim.id}`}
                        >
                            <span className="font-mono text-green-700">[D]</span>
                            <span className="truncate">Dimension {dim.id}</span>
                        </div>
                    );
                })}
                 {layer.doors.map((door) => {
                     const isElementSelected = selectedElementInfo?.elementType === 'door' && selectedElementInfo.elementId === door.id && selectedElementInfo.layerId === layer.id;
                    return (
                        <div
                            key={`door-${door.id}`}
                            onClick={() => onSelectElement(layer.id, door.id, 'door')}
                            className={`px-2 py-1 rounded-sm text-xs cursor-pointer flex items-center gap-2 ${isElementSelected ? 'bg-sky-200/80 font-semibold text-sky-800' : 'hover:bg-slate-200/70'}`}
                            title={`Select Door ${door.id}`}
                        >
                            <span className="font-mono text-orange-700">[DR]</span>
                            <span className="truncate">Door {door.id}</span>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
  );
};

LayerItem.displayName = 'LayerItem';
export default LayerItem;
