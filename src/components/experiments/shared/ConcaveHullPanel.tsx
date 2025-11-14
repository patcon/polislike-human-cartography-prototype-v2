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
      
      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onConfigChange({ ...config, enabled: e.target.checked })}
          />
          <span className="text-sm">Show concave hulls around clusters</span>
        </label>
        
        {config.enabled && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Concavity: {config.concavity.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.1"
                value={config.concavity}
                onChange={(e) => onConfigChange({ ...config, concavity: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-600">
                Lower values = more detailed hulls
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Length threshold: {config.lengthThreshold.toFixed(0)}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.lengthThreshold}
                onChange={(e) => onConfigChange({ ...config, lengthThreshold: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-600">
                Higher values = simpler shapes
              </p>
            </div>

            <ConcaveHullConfigModal
              config={config}
              onConfigChange={onConfigChange}
            >
              <Button variant="outline" size="sm" className="w-full mt-2">
                More Options
              </Button>
            </ConcaveHullConfigModal>
          </>
        )}
      </div>
    </div>
  );
};