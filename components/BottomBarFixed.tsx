

import React from 'react';
import { Unit, OsnapType } from '../types';
import { UnitsAndScaleControls, GridVisibilityButton, SnapSettingsDisplay } from './TopBar'; // Reusing components

interface BottomBarFixedProps {
  currentUnit: Unit;
  onSetUnit: (unit: Unit) => void;
  architecturalScale: number;
  onSetArchitecturalScale: (scale: number) => void;

  isGridVisible: boolean;
  onToggleGridVisible: () => void;

  isGridSnapActive: boolean;
  onToggleGridSnap: () => void;
  userGridSpacing: number;
  onSetUserGridSpacing: (spacing: number) => void;
  convertWorldUnitsToDisplayUnit: (worldValue: number, unit: Unit) => number;
  convertValueToWorldUnits: (value: number, unit: Unit) => number;

  isAngleSnapActive: boolean;
  onToggleAngleSnap: () => void;
  customAngle: string;
  onSetCustomAngle: (angle: string) => void;

  isOrthogonalMode: boolean;
  onToggleOrthogonalMode: () => void;

  osnapSettings: Record<OsnapType, boolean>;
  onToggleOsnap: (type: OsnapType) => void;
}

export const BottomBarFixed: React.FC<BottomBarFixedProps> = (props) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 px-3 flex items-center justify-between z-50 pointer-events-none">
      <div className="flex items-center gap-3 pointer-events-auto">
        <GridVisibilityButton
          isPressed={props.isGridVisible}
          onToggle={props.onToggleGridVisible}
          label="Grid"
          titleHint={`Grid Visibility (${props.isGridVisible ? "On" : "Off"})`}
        />
        <SnapSettingsDisplay
            osnapSettings={props.osnapSettings}
            onToggleOsnap={props.onToggleOsnap}
            isGridSnapActive={props.isGridSnapActive}
            onToggleGridSnap={props.onToggleGridSnap}
            userGridSpacing={props.userGridSpacing}
            onSetUserGridSpacing={props.onSetUserGridSpacing}
            currentUnit={props.currentUnit}
            convertWorldUnitsToDisplayUnit={props.convertWorldUnitsToDisplayUnit}
            convertValueToWorldUnits={props.convertValueToWorldUnits}
            isAngleSnapActive={props.isAngleSnapActive}
            onToggleAngleSnap={props.onToggleAngleSnap}
            customAngle={props.customAngle}
            onSetCustomAngle={props.onSetCustomAngle}
            isOrthogonalMode={props.isOrthogonalMode}
            onToggleOrthogonalMode={props.onToggleOrthogonalMode}
        />
      </div>
      <div className="flex items-center gap-3 pointer-events-auto">
        <UnitsAndScaleControls
          currentUnit={props.currentUnit}
          onSetUnit={props.onSetUnit}
          architecturalScale={props.architecturalScale}
        />
      </div>
    </div>
  );
};

BottomBarFixed.displayName = "BottomBarFixed";
export default BottomBarFixed;