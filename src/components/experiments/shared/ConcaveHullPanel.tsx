import React from 'react';
import { Button } from "@/components/ui/button";
import { ConcaveHullConfigModal } from './ConcaveHullConfigModal';
import type { ConcaveHullConfig } from './ConcaveHullConfigModal';

interface ConcaveHullPanelProps {
  config: ConcaveHullConfig;
  onConfigChange: (config: ConcaveHullConfig) => void;
}

export const ConcaveHullPanel: React.FC<ConcaveHullPanelProps> = ({
  config,
  onConfigChange
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border max-w-xs">
      <h3 className="text-lg font-semibold mb-3">Concave Hull Visualization</h3>
      
      <div className="space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onConfigChange({ ...config, enabled: e.target.checked })}
          />
          <span className="text-sm">Show concave hulls around clusters</span>
        </label>
        
        {config.enabled && (
          <ConcaveHullConfigModal
            config={config}
            onConfigChange={onConfigChange}
          >
            <Button variant="outline" size="sm" className="w-full mt-2">
              Configure Hulls
            </Button>
          </ConcaveHullConfigModal>
        )}
      </div>
    </div>
  );
};