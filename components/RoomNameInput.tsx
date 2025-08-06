
import React, { useState, useEffect, forwardRef } from 'react';
import { Room, Transform, Point, EditingRoomNameInfo } from '../types'; // Added EditingRoomNameInfo
import { getAbntHeightMm, getScaledScreenValue } from '../utils';
import { BASE_LABEL_FONT_SIZE_PX, REFERENCE_ARCH_SCALE_DENOMINATOR, ABNT_REF_HEIGHT_MM } from '../constants';

interface RoomNameInputProps {
  isVisible: boolean;
  room: Room | null; // This will be the specific room object passed from App.tsx
  transform: Transform;
  initialValue: string;
  onFinalize: (newName: string, save: boolean) => void;
  toScreen: (worldPoint: Point) => Point;
}

const RoomNameInputComponent = React.memo(forwardRef<HTMLInputElement, RoomNameInputProps>(({
  isVisible, room, transform, initialValue, onFinalize, toScreen
}, ref) => {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    setName(initialValue);
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

  if (!isVisible || !room || !room.labelPosition) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onFinalize(name, true);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      onFinalize(initialValue, false);
      e.preventDefault();
    }
  };

  const handleBlur = () => {
    if (isVisible) {
        onFinalize(name, true);
    }
  };

  const labelCenterScreen = toScreen(room.labelPosition);

  const currentArchScaleDenom = REFERENCE_ARCH_SCALE_DENOMINATOR / transform.scale;
  const abntHeightMm = getAbntHeightMm(currentArchScaleDenom);
  const targetScreenFontSize = BASE_LABEL_FONT_SIZE_PX * (abntHeightMm / ABNT_REF_HEIGHT_MM);
  const scaledInputFontSize = getScaledScreenValue(targetScreenFontSize, transform.scale, BASE_LABEL_FONT_SIZE_PX);

  const estimatedCharWidth = scaledInputFontSize * 0.65;
  const inputWidth = Math.max(60, (name.length || initialValue.length || 5) * estimatedCharWidth + 20);
  const inputHeight = scaledInputFontSize * 1.5 + 4;

  return (
    <input
      ref={ref}
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="absolute border border-sky-500 bg-white/90 text-slate-800 px-1.5 py-0.5 z-[100] shadow-lg rounded-sm transform -translate-x-1/2 -translate-y-1/2 text-center outline-none focus:ring-1 focus:ring-sky-500"
      style={{
        left: `${labelCenterScreen.x}px`,
        top: `${labelCenterScreen.y - (scaledInputFontSize * 0.8)}px`,
        fontSize: `${scaledInputFontSize}px`,
        width: `${inputWidth}px`,
        height: `${inputHeight}px`,
        lineHeight: `${scaledInputFontSize}px`,
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        textAlign: 'center',
      }}
      aria-label="Room name"
    />
  );
}));

RoomNameInputComponent.displayName = 'RoomNameInputComponent';
export default RoomNameInputComponent;
