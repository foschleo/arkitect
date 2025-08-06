import React from 'react';
import { InferenceTipState } from '../types';

interface InferenceTipComponentProps {
  tip: InferenceTipState;
}

const InferenceTipComponent: React.FC<InferenceTipComponentProps> = React.memo(({ tip }) => {
  if (!tip.show) {
    return null;
  }

  return (
    <div
      className="absolute bg-slate-800/80 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg pointer-events-none backdrop-blur-sm"
      style={{
        left: `${tip.screenX}px`,
        top: `${tip.screenY}px`,
        transform: 'translate(15px, 15px)', // Small offset from cursor
        zIndex: 20000, // Ensure it's on top of other UI elements
        whiteSpace: 'nowrap',
      }}
      role="tooltip"
      aria-live="polite"
    >
      {tip.text}
    </div>
  );
});

InferenceTipComponent.displayName = 'InferenceTipComponent';
export default InferenceTipComponent;
