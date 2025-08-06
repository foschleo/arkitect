

import React, { useState, useRef } from 'react';
// Plus icon removed
import { LayerData, SelectedElementInfo } from '../types';
import LayerItem from './LayerItem';

interface LayerPanelProps {
  layers: LayerData[];
  activeLayerId: string | null;
  selectedElementInfo: SelectedElementInfo | null;
  onLayerAction: (
    action: 'add' | 'delete' | 'setActive' | 'toggleVisibility' | 'toggleLock' | 'rename' | 'reorder',
    payload?: any
  ) => void;
  onSelectElement: (layerId: string, elementId: number, elementType: 'room' | 'dimension' | 'door') => void;
}

// LayerPanel component
const LayerPanel: React.FC<LayerPanelProps> = ({ layers, activeLayerId, selectedElementInfo, onLayerAction, onSelectElement }) => {
    const dragItemIndex = useRef<number | null>(null);
    const dragOverItemIndex = useRef<number | null>(null);
    const [isAnyItemDragging, setIsAnyItemDragging] = useState(false);

    const displayLayers = layers || [];

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        dragItemIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
        const empty = document.createElement('div');
        e.dataTransfer.setDragImage(empty, 0, 0);
        setTimeout(() => setIsAnyItemDragging(true), 0);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (dragItemIndex.current !== null && dragItemIndex.current !== index) {
            dragOverItemIndex.current = index;
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (dragItemIndex.current !== null && dragOverItemIndex.current !== null && dragItemIndex.current !== dragOverItemIndex.current) {
            onLayerAction('reorder', { oldIndex: dragItemIndex.current, newIndex: dragOverItemIndex.current });
        }
        dragItemIndex.current = null;
        dragOverItemIndex.current = null;
        setIsAnyItemDragging(false);
    };


    const handleDragEnd = () => {
        dragItemIndex.current = null;
        dragOverItemIndex.current = null;
        setIsAnyItemDragging(false);
    };

    const getLayerItemStyle = (index: number): React.CSSProperties => {
        if (isAnyItemDragging && dragItemIndex.current === index) {
            return { opacity: 0.5 };
        }
        return {};
    };

    const getDropIndicatorStyle = (index: number): React.CSSProperties => {
        if (isAnyItemDragging && dragOverItemIndex.current === index && dragItemIndex.current !== index ) {
            if (dragItemIndex.current !== null && dragItemIndex.current < index) {
                return { borderBottom: '2px solid #0ea5e9', marginBlockEnd: '-2px' };
            }
            if (dragItemIndex.current !== null && dragItemIndex.current > index) {
                return { borderTop: '2px solid #0ea5e9', marginBlockStart: '-2px'};
            }
        }
        return {};
    };


  return (
    <div
      className="flex flex-col h-full text-slate-700 bg-transparent"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-labelledby="layer-panel-heading-float"
    >
      <div className="px-1 py-1.5 flex justify-between items-center flex-shrink-0 border-b border-slate-300/50 mb-1">
        <h2 id="layer-panel-heading-float" className="text-xs font-semibold text-slate-600 ml-1">Layers</h2>
        <button
          onClick={() => onLayerAction('add')}
          className="flex items-center justify-center bg-sky-500/80 hover:bg-sky-600/90 text-white font-semibold p-0 rounded text-xl shadow-sm hover:shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white w-6 h-6 backdrop-blur-sm"
          title="Add New Layer"
          aria-label="Add new layer"
        >
          <span>+</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {displayLayers.length > 0 ? displayLayers.map((layer, index) => (
          <div
            key={layer.id}
            style={{...getLayerItemStyle(index), ...getDropIndicatorStyle(index)}}
            onDragEnter={(e) => handleDragEnter(e, index)}
          >
            <LayerItem
                layer={layer}
                isActive={layer.id === activeLayerId}
                selectedElementInfo={selectedElementInfo}
                onSelect={(id) => onLayerAction('setActive', { layerId: id })}
                onToggleVisibility={(id) => onLayerAction('toggleVisibility', { layerId: id })}
                onToggleLock={(id) => onLayerAction('toggleLock', { layerId: id })}
                onDelete={(id) => {
                    onLayerAction('delete', { layerId: id });
                }}
                onRename={(id, newName) => onLayerAction('rename', { layerId: id, newName: newName })}
                onSelectElement={onSelectElement}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                isBeingDragged={isAnyItemDragging && dragItemIndex.current === index}
            />
          </div>
        )) : (
            <p className="text-xs text-slate-400 text-center py-3">No layers yet.</p>
        )}
      </div>
    </div>
  );
};

LayerPanel.displayName = 'LayerPanel';
export default LayerPanel;
