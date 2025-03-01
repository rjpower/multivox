import React from "react";

interface LoadingModalProps {
  isOpen: boolean;
  message: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex flex-col items-center">
          <div className="loading loading-spinner loading-lg mb-4"></div>
          <p className="text-center">{message}</p>
        </div>
      </div>
    </div>
  );
};
