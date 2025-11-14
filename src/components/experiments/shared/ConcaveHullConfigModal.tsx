import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ConcaveHullConfig {
  enabled: boolean;
  concavity: number;
  lengthThreshold: number;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  showOnlySelected: boolean;
  excludeNoise: boolean;
  renderOrder: 'below' | 'above';
}

interface ConcaveHullConfigModalProps {
  config: ConcaveHullConfig;
  onConfigChange: (config: ConcaveHullConfig) => void;
  children: React.ReactNode;
}

export const ConcaveHullConfigModal: React.FC<ConcaveHullConfigModalProps> = ({
  config,
  onConfigChange,
  children
}) => {
  const handleConfigUpdate = (updates: Partial<ConcaveHullConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Concave Hull Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Fill opacity: {Math.round(config.fillOpacity * 100)}%
                </Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.fillOpacity}
                  onChange={(e) => handleConfigUpdate({ fillOpacity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Stroke opacity: {Math.round(config.strokeOpacity * 100)}%
                </Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.strokeOpacity}
                  onChange={(e) => handleConfigUpdate({ strokeOpacity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Stroke width: {config.strokeWidth}px
                </Label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={config.strokeWidth}
                  onChange={(e) => handleConfigUpdate({ strokeWidth: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.showOnlySelected}
                    onChange={(e) => handleConfigUpdate({ showOnlySelected: e.target.checked })}
                  />
                  <span className="text-sm">Show hulls only for selected clusters</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Render order</Label>
                <div className="space-y-1">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="renderOrder"
                      value="below"
                      checked={config.renderOrder === 'below'}
                      onChange={(e) => handleConfigUpdate({ renderOrder: e.target.value as 'below' | 'above' })}
                    />
                    <span className="text-sm">Below points (background)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="renderOrder"
                      value="above"
                      checked={config.renderOrder === 'above'}
                      onChange={(e) => handleConfigUpdate({ renderOrder: e.target.value as 'below' | 'above' })}
                    />
                    <span className="text-sm">Above points (foreground)</span>
                  </label>
                </div>
                <p className="text-xs text-gray-600">
                  Controls whether hulls appear behind or in front of data points.
                </p>
              </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { ConcaveHullConfig };