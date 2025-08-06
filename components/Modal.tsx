
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = React.memo(({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000]">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg text-center max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
});

Modal.displayName = 'Modal';
export default Modal;
