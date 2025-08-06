
import React, { useState, useEffect, forwardRef } from 'react';
import { DimensionLine, Transform, Point, Unit } from '../types';
import { getScaledScreenValue, getPaperSpaceValueInWorldUnits } from '../utils';
import { REFERENCE_ARCH_SCALE_DENOMINATOR, DIM_OFFSET_MM } from '../constants';

interface DimensionOffsetInputProps {
  isVisible: boolean;
  dimensionLine: DimensionLine | null; // Specific dimension line object
  transform: Transform;
  initialValue: string;
  unit: Unit;
  onFinalize: (newOffsetValue: string, save: boolean) => void;
  toScreen: (worldPoint: Point) => Point;
  baseOffsetScreenPx: number;
  baseFontSizePx: number;
}

const DimensionOffsetInputComponent = React.memo(forwardRef<HTMLInputElement, DimensionOffsetInputProps>(({
  isVisible, dimensionLine, transform, initialValue, unit, onFinalize, toScreen,
  baseOffsetScreenPx, baseFontSizePx
}, ref) => {
  const [offsetValue, setOffsetValue] = useState(initialValue);

  useEffect(() => {
    setOffsetValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isVisible) {
      const currentInput = (typeof ref === 'function' || !ref) ? null : ref.current;
      if (currentInput) {
        currentInput.focus();
        if (initialValue.length === 1 && ((initialValue >= '0' && initialValue <= '9') || initialValue === '.')) {
            currentInput.select();
        }
      }
    }
  }, [isVisible, initialValue, ref]);

  if (!isVisible || !dimensionLine || !dimensionLine.points || dimensionLine.points.length < 2) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onFinalize(offsetValue, true);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      onFinalize(initialValue, false);
      e.preventDefault();
    }
  };

  const handleBlur = () => {
    if (isVisible) {
        onFinalize(offsetValue, true);
    }
  };

  const p1 = dimensionLine.points[0];
  const p2 = dimensionLine.points[dimensionLine.points.length - 1];
  const { offsetSide, customOffset } = dimensionLine;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  let nx = 0, ny = 0;
  if (len > 0) { nx = -dy / len; ny = dx / len; } else { nx = 0; ny = -1;}

  const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;
  const actualOffsetWorld = customOffset !== undefined
    ? customOffset
    : getPaperSpaceValueInWorldUnits(DIM_OFFSET_MM, currentArchScaleDenom);

  const finalNx = nx * offsetSide;
  const finalNy = ny * offsetSide;
  const dimLineTextMidPointWorld = {
    x: midX + finalNx * actualOffsetWorld,
    y: midY + finalNy * actualOffsetWorld,
  };

  const inputPositionScreen = toScreen(dimLineTextMidPointWorld);

  const scaledInputFontSize = getScaledScreenValue(baseFontSizePx, transform.scale, baseFontSizePx);

  const estimatedCharWidth = scaledInputFontSize * 0.65;
  const inputWidth = Math.max(80, (offsetValue.length || initialValue.length || 5) * estimatedCharWidth + 20);
  const inputHeight = scaledInputFontSize * 1.5 + 4;

  return (
    <div
      className="absolute bg-white/85 border border-sky-500/70 p-1.5 rounded-md shadow-lg z-[100] flex items-center gap-1.5 transform -translate-x-1/2 -translate-y-1/2 backdrop-blur-md"
      style={{
        left: `${inputPositionScreen.x}px`,
        top: `${inputPositionScreen.y}px`,
        fontSize: `${scaledInputFontSize}px`,
        lineHeight: `${scaledInputFontSize}px`,
      }}
      role="dialog"
      aria-labelledby="dimOffsetInputLabel"
    >
      <label htmlFor="dimOffsetInput" id="dimOffsetInputLabel" className="text-slate-700 text-xs whitespace-nowrap">
        Offset ({unit}):
      </label>
      <input
        ref={ref}
        type="number"
        step="any"
        id="dimOffsetInput"
        value={offsetValue}
        onChange={(e) => setOffsetValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="px-1.5 py-0.5 border border-slate-300/70 rounded-sm focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white/80 text-slate-800"
        style={{
          width: `${inputWidth}px`,
          height: `${inputHeight}px`,
          fontSize: `${scaledInputFontSize}px`,
          lineHeight: `${scaledInputFontSize}px`,
          textAlign: 'left',
        }}
        aria-describedby="dimOffsetInputHint"
      />
      <small id="dimOffsetInputHint" className="text-slate-500 text-xs">(Enter)</small>
    </div>
  );
}));

DimensionOffsetInputComponent.displayName = 'DimensionOffsetInputComponent';
export default DimensionOffsetInputComponent;
