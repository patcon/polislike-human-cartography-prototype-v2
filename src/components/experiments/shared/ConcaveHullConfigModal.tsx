import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ConcaveHullConfig {
  enabled: boolean;
  alpha: number;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  showOnlySelected: boolean;
  excludeNoise: boolean;
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
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleConfigUpdate({ enabled: e.target.checked })}
              />
              <span className="text-sm font-medium">Enable concave hulls</span>
            </label>
          </div>

          {config.enabled && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Alpha parameter: {config.alpha.toFixed(2)}
                </Label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={config.alpha}
                  onChange={(e) => handleConfigUpdate({ alpha: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-600">
                  Controls hull tightness. Lower values create tighter hulls.
                </p>
              </div>

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
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.excludeNoise}
                    onChange={(e) => handleConfigUpdate({ excludeNoise: e.target.checked })}
                  />
                  <span className="text-sm">Exclude noise points (always enabled)</span>
                </label>
                <p className="text-xs text-gray-600">
                  Noise points (cluster ID -1) are automatically excluded from hull generation.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { ConcaveHullConfig };