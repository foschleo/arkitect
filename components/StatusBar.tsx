
import React from 'react';

interface StatusBarProps {
  statusMessage: string | null;
}

const StatusBar: React.FC<StatusBarProps> = React.memo(({ statusMessage }) => {
  if (!statusMessage) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-slate-900/80 text-white text-xs rounded-md shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      {statusMessage}
    </div>
  );
});

StatusBar.displayName = 'StatusBar';
export default StatusBar;