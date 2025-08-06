
import React, { useEffect, useRef } from 'react';
import { Unit } from '../types';

interface DistanceInputProps {
  isVisible: boolean;
  position: { x: number; y: number };
  unit: Unit;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (key: string) => void;
  onBlur?: () => void;
}

const DistanceInputComponent: React.FC<DistanceInputProps> = React.memo(({
  isVisible, position, unit, value, onChange, onKeyDown, onBlur
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsVisibleRef = useRef(isVisible);

  useEffect(() => {
    const currentInput = inputRef.current;
    if (currentInput) { // Ensure the ref is populated
      if (isVisible) {
        // Only focus and select if it just became visible
        if (!prevIsVisibleRef.current) {
          currentInput.focus();
          // Select content only on initial show if it's a single digit/dot
          // (typically the character that triggered the input to appear)
          if (value.length === 1 && ((value >= '0' && value <= '9') || value === '.')) {
            currentInput.select();
          }
        }
      }
    }
    // Update prevIsVisibleRef *after* all logic in the current effect run
    prevIsVisibleRef.current = isVisible;
  }, [isVisible, value]); // `value` is needed for the conditional select logic

  if (!isVisible) return null;

  return (
    <div
      className="absolute bg-white/85 border border-sky-500/70 p-1.5 rounded-md shadow-lg z-[200] text-sm flex items-center gap-1.5 backdrop-blur-md"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      role="dialog"
      aria-labelledby="distanceInputLabel"
    >
      <label htmlFor="distanceInput" id="distanceInputLabel" className="text-slate-700">
        Distance (<span className="font-semibold">{unit}</span>):
      </label>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal" // Provides a numeric-like keyboard on mobile
        id="distanceInput"
        // step="any" // Not applicable for type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => onKeyDown(e.key)}
        onBlur={onBlur}
        className="w-24 px-1.5 py-1 border border-slate-300/70 rounded-sm focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white/80 text-slate-800"
        aria-describedby="distanceInputHint"
      />
      <small id="distanceInputHint" className="text-slate-500 text-xs">(Enter)</small>
    </div>
  );
});

DistanceInputComponent.displayName = 'DistanceInputComponent';
export default DistanceInputComponent;
