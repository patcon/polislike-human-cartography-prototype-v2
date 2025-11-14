import React from 'react';

interface LoadingDisplayProps {
  message?: string;
}

export const LoadingDisplay: React.FC<LoadingDisplayProps> = ({ 
  message = "Loading HDBSCAN data..." 
}) => {
  return (
    <div className="flex items-center justify-center w-screen h-screen">
      <div className="text-lg">{message}</div>
    </div>
  );
};