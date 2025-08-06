
import React, { useState, useEffect, useRef } from 'react';
import { Unit, Mode, WallAlignment, OsnapType, UndoRedoPanelProps, ModeButtonPanelProps, LayersTogglePanelProps, GridSnapPanelProps, ToggleButtonPanelProps, AngleSnapPanelProps, OsnapSettingsPanelProps, WallThicknessPanelProps, WallAlignmentPanelProps, UnitsScalePanelProps, GuidelineSettingsPanelProps, Door, DoorPropertiesPanelProps } from '../types';

// --- STYLING CONSTANTS ---
export const fixedBarButtonBaseClass = "px-2.5 py-1.5 text-xs border border-slate-300/50 bg-white/75 backdrop-blur-sm text-slate-700 transition-colors duration-150 rounded shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 hover:enabled:bg-white/90 hover:enabled:border-slate-400/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center capitalize min-h-[30px]";
export const fixedBarActiveButtonClass = "!bg-sky-500/80 !border-sky-600/70 !text-white backdrop-blur-sm shadow-lg hover:enabled:!bg-sky-600/90";
export const fixedBarInputClass = "w-16 text-right px-1 py-0.5 text-xs border border-slate-300/50 rounded-sm focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white/75 backdrop-blur-sm text-slate-800 h-[28px]";
export const fixedBarLabelClass = "text-xs whitespace-nowrap text-slate-600 mr-1.5";
export const fixedBarControlGroupClass = "flex items-center gap-1.5";
const dropdownMenuClass = "absolute bottom-full left-0 mb-1 bg-white/95 backdrop-blur-lg border border-slate-300/70 rounded-md shadow-xl z-[60] py-2 px-3 space-y-3";
const dropdownItemClass = "flex items-center justify-between text-xs text-slate-700";
const dropdownButtonClass = "flex items-center text-xs text-left hover:bg-slate-100/50 focus:bg-slate-100/50 outline-none px-2.5 py-1.5 w-full rounded";
const dropdownInputClass = "w-16 text-right px-1 py-0.5 text-xs border border-slate-300/70 rounded-sm focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white/80";

// --- REUSABLE COMPONENTS FOR BARS ---

export const TopRightControls: React.FC<{ onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; onToggleLayersPanel: () => void; }> = ({ onUndo, onRedo, canUndo, canRedo, onToggleLayersPanel }) => (
  <div className="fixed top-3 right-3 z-50 pointer-events-none">
    <div className="flex items-center gap-3 pointer-events-auto">
      <UndoRedoButtons undo={onUndo} redo={onRedo} canUndo={canUndo} canRedo={canRedo} />
      <LayersToggleButton onToggleLayerPanel={onToggleLayersPanel} />
    </div>
  </div>
);
TopRightControls.displayName = 'TopRightControls';

export const UndoRedoButtons: React.FC<UndoRedoPanelProps> = ({ undo, redo, canUndo, canRedo }) => (
  <div className={fixedBarControlGroupClass}>
    <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className={`${fixedBarButtonBaseClass} min-w-[70px] lowercase`}><span className={`${!canUndo ? 'text-slate-400' : ''}`}>Undo</span></button>
    <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className={`${fixedBarButtonBaseClass} min-w-[70px] lowercase`}><span className={`${!canRedo ? 'text-slate-400' : ''}`}>Redo</span></button>
  </div>
);
UndoRedoButtons.displayName = "UndoRedoButtons";

export const ModeButton: React.FC<ModeButtonPanelProps> = ({ mode, currentMode, onSetMode, titleHint, label }) => (
  <button onClick={() => onSetMode(mode)} title={titleHint} className={`${fixedBarButtonBaseClass} ${currentMode === mode ? fixedBarActiveButtonClass : ''} lowercase w-full flex-col h-auto py-2 text-center`}>
    <span className="text-[11px] leading-tight">{label}</span>
  </button>
);
ModeButton.displayName = "ModeButton";

export const LayersToggleButton: React.FC<LayersTogglePanelProps> = ({ onToggleLayerPanel }) => (
  <button onClick={onToggleLayerPanel} title="Toggle Layers Panel" className={`${fixedBarButtonBaseClass} lowercase min-w-[70px]`}>Layers</button>
);
LayersToggleButton.displayName = "LayersToggleButton";

export const GridVisibilityButton: React.FC<ToggleButtonPanelProps> = ({ isPressed, onToggle, label, titleHint }) => (
  <button onClick={onToggle} title={titleHint} className={`${fixedBarButtonBaseClass} ${isPressed ? fixedBarActiveButtonClass : ''} lowercase min-w-[60px]`}>{label}</button>
);
GridVisibilityButton.displayName = "GridVisibilityButton";

// --- UNITS AND SCALE ---

export const ArchitecturalScaleDisplay: React.FC<{ architecturalScale: number }> = ({ architecturalScale }) => (
    <div className={fixedBarControlGroupClass}>
        <span className={fixedBarLabelClass}>Scale</span>
        <span className={`${fixedBarInputClass} !w-auto px-2 text-center select-none`}>1:{architecturalScale}</span>
    </div>
);
ArchitecturalScaleDisplay.displayName = "ArchitecturalScaleDisplay";

export const UnitSelector: React.FC<{ currentUnit: Unit, onSetUnit: (unit: Unit) => void }> = ({ currentUnit, onSetUnit }) => (
    <div className={fixedBarControlGroupClass}>
        <span className={fixedBarLabelClass}>Units</span>
        <select value={currentUnit} onChange={(e) => onSetUnit(e.target.value as Unit)} className={`${fixedBarInputClass} !w-auto px-2 text-left`}>
            <option value={Unit.Meters}>Meters (m)</option>
            <option value={Unit.Centimeters}>Centimeters (cm)</option>
            <option value={Unit.Millimeters}>Millimeters (mm)</option>
        </select>
    </div>
);
UnitSelector.displayName = "UnitSelector";

export const UnitsAndScaleControls: React.FC<UnitsScalePanelProps> = (props) => (
    <div className="flex items-center gap-3">
        <UnitSelector {...props} />
        <ArchitecturalScaleDisplay {...props} />
    </div>
);
UnitsAndScaleControls.displayName = "UnitsAndScaleControls";

// --- SNAP CONTROLS (for dropdown) ---

const GridSnapControlInternal: React.FC<GridSnapPanelProps> = ({ isGridSnapActive, onToggleGridSnap, userGridSpacing, onSetUserGridSpacing, currentUnit, convertWorldUnitsToDisplayUnit, convertValueToWorldUnits }) => {
  const [localGridSpacingStr, setLocalGridSpacingStr] = useState('');
  const [isGridInputFocused, setIsGridInputFocused] = useState(false);
  const formatDisplayValue = (worldValue: number, unit: Unit): string => { const displayVal = convertWorldUnitsToDisplayUnit(worldValue, unit); if (unit === Unit.Meters) return displayVal.toFixed(2); if (unit === Unit.Centimeters) return displayVal.toFixed(1); return displayVal.toFixed(0); };
  useEffect(() => { if (!isGridInputFocused) { setLocalGridSpacingStr(formatDisplayValue(userGridSpacing, currentUnit)); } }, [userGridSpacing, currentUnit, isGridInputFocused, convertWorldUnitsToDisplayUnit]);
  const handleGridSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => { setLocalGridSpacingStr(e.target.value); };
  const handleGridSpacingBlur = () => { setIsGridInputFocused(false); const numValue = parseFloat(localGridSpacingStr); if (!isNaN(numValue) && numValue > 0) { onSetUserGridSpacing(convertValueToWorldUnits(numValue, currentUnit)); } else { setLocalGridSpacingStr(formatDisplayValue(userGridSpacing, currentUnit)); } };
  return (
    <div className={dropdownItemClass}>
      <button onClick={onToggleGridSnap} className={`${dropdownButtonClass} ${isGridSnapActive ? 'text-sky-600 font-medium' : ''}`}>Grid Snap</button>
      <input type="number" value={localGridSpacingStr} onChange={handleGridSpacingChange} onFocus={() => setIsGridInputFocused(true)} onBlur={handleGridSpacingBlur} className={dropdownInputClass} disabled={!isGridSnapActive} />
      <span className="text-xs text-slate-500 pl-1.5 w-6">{currentUnit}</span>
    </div>
  );
};
GridSnapControlInternal.displayName = "GridSnapControlInternal";

const AngleSnapControlInternal: React.FC<AngleSnapPanelProps> = ({ isAngleSnapActive, onToggleAngleSnap, customAngle, onSetCustomAngle }) => (
    <div className={dropdownItemClass}>
        <button onClick={onToggleAngleSnap} className={`${dropdownButtonClass} ${isAngleSnapActive ? 'text-sky-600 font-medium' : ''}`}>Angle Snap</button>
        <input type="text" value={customAngle} onChange={(e) => onSetCustomAngle(e.target.value)} placeholder="45" className={dropdownInputClass} disabled={!isAngleSnapActive} />
        <span className="text-xs text-slate-500 pl-1.5 w-6">°</span>
    </div>
);
AngleSnapControlInternal.displayName = "AngleSnapControlInternal";

const OrthoModeButton: React.FC<OsnapSettingsPanelProps> = ({ isOrthogonalMode, onToggleOrthogonalMode }) => (
    <button onClick={onToggleOrthogonalMode} className={`${dropdownButtonClass} ${isOrthogonalMode ? 'text-sky-600 font-medium' : ''}`}>Ortho Mode (F8)</button>
);
OrthoModeButton.displayName = "OrthoModeButton";

const OsnapButtons: React.FC<OsnapSettingsPanelProps> = ({ osnapSettings, onToggleOsnap }) => (
  <div>
    <h3 className="text-xs font-semibold text-slate-600 mb-1.5 px-2">Object Snap</h3>
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {Object.entries(osnapSettings).map(([key, value]) => (
        <button key={key} onClick={() => onToggleOsnap(key as OsnapType)} className={`${dropdownButtonClass} capitalize ${value ? 'text-sky-600 font-medium' : ''}`}>{key.replace('osnap_', '')}</button>
      ))}
    </div>
  </div>
);
OsnapButtons.displayName = "OsnapButtons";

// Main Snap Display component for bottom bar
export const SnapSettingsDisplay: React.FC<OsnapSettingsPanelProps> = (props) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) { setIsOpen(false); } };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    return (
        <div className="relative" ref={wrapperRef}>
            <button onClick={() => setIsOpen(p => !p)} className={`${fixedBarButtonBaseClass} lowercase min-w-[70px]`}>Snaps</button>
            {isOpen && (
                <div className={dropdownMenuClass}>
                    <GridSnapControlInternal {...props} />
                    <AngleSnapControlInternal {...props} />
                    <OrthoModeButton {...props} />
                    <hr className="my-2 border-slate-200/80" />
                    <OsnapButtons {...props} />
                </div>
            )}
        </div>
    );
};
SnapSettingsDisplay.displayName = "SnapSettingsDisplay";

// --- FLOATING PANEL CONTROLS ---

const panelControlContainerClass = "p-2 bg-slate-200/50 rounded-md space-y-2";
const panelLabelClass = "text-xs font-medium text-slate-600 block mb-1";
const panelInputClass = "w-full text-right px-2 py-1 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white/90 text-slate-800";

export const WallThicknessControl: React.FC<WallThicknessPanelProps> = ({ currentWallThickness, onSetWallThickness, currentUnit, convertWorldUnitsToDisplayUnit, convertValueToWorldUnits }) => {
    const [localValue, setLocalValue] = useState('');
    useEffect(() => { setLocalValue(convertWorldUnitsToDisplayUnit(currentWallThickness, currentUnit).toFixed(2)); }, [currentWallThickness, currentUnit, convertWorldUnitsToDisplayUnit]);
    const handleBlur = () => { const num = parseFloat(localValue); if (!isNaN(num)) { onSetWallThickness(convertValueToWorldUnits(num, currentUnit)); } };
    return (
        <div className={panelControlContainerClass}>
            <label htmlFor="wall-thickness-input" className={panelLabelClass}>Thickness ({currentUnit})</label>
            <input id="wall-thickness-input" type="number" value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur} className={panelInputClass} />
        </div>
    );
};
WallThicknessControl.displayName = "WallThicknessControl";

export const WallAlignmentButtons: React.FC<WallAlignmentPanelProps> = ({ currentWallAlignment, onSetWallAlignment }) => (
    <div className={`${panelControlContainerClass} !p-1 !space-y-0 flex gap-1`}>
        {(['centered', 'exterior', 'interior'] as WallAlignment[]).map(align => (
            <button key={align} onClick={() => onSetWallAlignment(align)} className={`${fixedBarButtonBaseClass} w-full ${currentWallAlignment === align ? fixedBarActiveButtonClass : ''}`}>{align}</button>
        ))}
    </div>
);
WallAlignmentButtons.displayName = "WallAlignmentButtons";

export const GuidelineSettingsControl: React.FC<GuidelineSettingsPanelProps> = ({ isMultiGuideMode, multiGuideCount, onSetMultiGuideCount, multiGuideDistance, onSetMultiGuideDistance, currentUnit, convertWorldUnitsToDisplayUnit, convertValueToWorldUnits }) => {
    const [localDist, setLocalDist] = useState('');
    useEffect(() => { setLocalDist(convertWorldUnitsToDisplayUnit(multiGuideDistance, currentUnit).toFixed(2)); }, [multiGuideDistance, currentUnit, convertWorldUnitsToDisplayUnit]);
    const handleDistBlur = () => { const num = parseFloat(localDist); if (!isNaN(num)) { onSetMultiGuideDistance(convertValueToWorldUnits(num, currentUnit)); } };
    if (!isMultiGuideMode) return null;
    return (
        <div className={panelControlContainerClass}>
            <div>
                <label htmlFor="guide-count" className={panelLabelClass}>Count</label>
                <input id="guide-count" type="number" value={multiGuideCount} onChange={e => onSetMultiGuideCount(parseInt(e.target.value, 10) || 1)} className={panelInputClass} />
            </div>
            <div>
                <label htmlFor="guide-dist" className={panelLabelClass}>Distance ({currentUnit})</label>
                <input id="guide-dist" type="number" value={localDist} onChange={e => setLocalDist(e.target.value)} onBlur={handleDistBlur} className={panelInputClass} />
            </div>
        </div>
    );
};
GuidelineSettingsControl.displayName = "GuidelineSettingsControl";

export const DoorPropertiesControl: React.FC<DoorPropertiesPanelProps> = ({ selectedDoor, onUpdateDoor }) => {
    if (!selectedDoor) return null;
    const swings: Door['swing'][] = ['left_in', 'left_out', 'right_in', 'right_out'];
    return (
        <div className={`${panelControlContainerClass} !p-1 !space-y-0 grid grid-cols-2 gap-1`}>
            {swings.map(swing => (
                <button key={swing} onClick={() => onUpdateDoor(selectedDoor.id, swing)} className={`${fixedBarButtonBaseClass} w-full ${selectedDoor.swing === swing ? fixedBarActiveButtonClass : ''}`}>{swing.replace('_', ' ')}</button>
            ))}
        </div>
    );
};
DoorPropertiesControl.displayName = "DoorPropertiesControl";
