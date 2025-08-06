



import React, { useState, useEffect, useRef } from 'react';
import { Mode } from '../types';
import { fixedBarButtonBaseClass, fixedBarActiveButtonClass } from './TopBar';

interface LeftBarFixedProps {
  currentMode: Mode;
  onSetMode: (mode: Mode, buttonElement?: HTMLElement) => void;
  isMultiGuideMode: boolean;
  onSetMultiGuideMode: (value: boolean, buttonElement?: HTMLElement) => void;
}

export const LeftBarFixed: React.FC<LeftBarFixedProps> = ({ currentMode, onSetMode, isMultiGuideMode, onSetMultiGuideMode }) => {
  const roomButtonRef = useRef<HTMLButtonElement>(null);
  const wallButtonRef = useRef<HTMLButtonElement>(null);
  const dimButtonRef = useRef<HTMLButtonElement>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const doorButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const simpleGuideButtonRef = useRef<HTMLButtonElement>(null);
  const arrayGuideButtonRef = useRef<HTMLButtonElement>(null);

  const handleSimpleGuideClick = () => {
    if (currentMode !== Mode.Guideline) {
      onSetMode(Mode.Guideline, guideButtonRef.current ?? undefined);
    }
    onSetMultiGuideMode(false, simpleGuideButtonRef.current ?? undefined);
  };

  const handleArrayGuideClick = () => {
    if (currentMode !== Mode.Guideline) {
      onSetMode(Mode.Guideline, guideButtonRef.current ?? undefined);
    }
    onSetMultiGuideMode(true, arrayGuideButtonRef.current ?? undefined);
  };

  const renderModeButton = (
      ref: React.RefObject<HTMLButtonElement>,
      mode: Mode,
      titleHint: string,
      label: string
  ) => {
      const isActive = currentMode === mode;
      return (
          <button
              ref={ref}
              onClick={() => onSetMode(mode, ref.current ?? undefined)}
              title={titleHint}
              className={`${fixedBarButtonBaseClass} ${isActive ? fixedBarActiveButtonClass : ''} lowercase w-full flex-col h-auto py-2 text-center`}
          >
              <span className="text-[11px] leading-tight">{label}</span>
          </button>
      );
  };

  return (
    <div className="fixed top-3 left-0 bottom-12 w-16 p-2 flex flex-col items-center space-y-2 z-40 pointer-events-none">
      <div className="pointer-events-auto w-full">
        {renderModeButton(roomButtonRef, Mode.Room, "Room Mode (D)", "Room")}
      </div>
      <div className="pointer-events-auto w-full">
        {renderModeButton(wallButtonRef, Mode.Wall, "Wall Mode (W)", "Wall")}
      </div>
      <div className="pointer-events-auto w-full">
        {renderModeButton(dimButtonRef, Mode.Dimension, "Dimension Mode (M)", "Dim")}
      </div>
      <div className="pointer-events-auto w-full relative">
        <button
          ref={guideButtonRef}
          onClick={() => onSetMode(Mode.Guideline, guideButtonRef.current ?? undefined)}
          title="Guideline Tools (L)"
          className={`${fixedBarButtonBaseClass} ${currentMode === Mode.Guideline ? fixedBarActiveButtonClass : ''} lowercase w-full flex-col h-auto py-2 text-center`}
        >
          <span className="text-[11px] leading-tight">Guide</span>
        </button>
        {currentMode === Mode.Guideline && (
          <div className="absolute left-full top-0 ml-2 w-max bg-transparent p-0 flex flex-col gap-1">
            <button
              ref={simpleGuideButtonRef}
              onClick={handleSimpleGuideClick}
              title="Single Guideline"
              className={`${fixedBarButtonBaseClass} ${!isMultiGuideMode ? fixedBarActiveButtonClass : ''} lowercase justify-start px-3 w-full`}
            >
              Simple
            </button>
            <button
              ref={arrayGuideButtonRef}
              onClick={handleArrayGuideClick}
              title="Guideline Array"
              className={`${fixedBarButtonBaseClass} ${isMultiGuideMode ? fixedBarActiveButtonClass : ''} lowercase justify-start px-3 w-full`}
            >
              Array
            </button>
          </div>
        )}
      </div>
      <div className="pointer-events-auto w-full">
        {renderModeButton(openButtonRef, Mode.Opening, "Opening Mode (O)", "Open")}
      </div>
       <div className="pointer-events-auto w-full">
        {renderModeButton(doorButtonRef, Mode.Door, "Door Tool", "Door")}
      </div>
      <div className="pointer-events-auto w-full">
        {renderModeButton(editButtonRef, Mode.Edit, "Edit Mode (E)", "Edit")}
      </div>
    </div>
  );
};

LeftBarFixed.displayName = "LeftBarFixed";
export default LeftBarFixed;