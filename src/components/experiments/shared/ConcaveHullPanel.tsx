import React from 'react';
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { ConcaveHullConfigModal } from './ConcaveHullConfigModal';
import { ConcaveHullPerimeterChart } from './ConcaveHullPerimeterChart';
import { calculateHullPerimeter } from './hullPerimeterUtils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ConcaveHullConfig } from './ConcaveHullConfigModal';
import type { Point } from './types';

interface ConcaveHullPanelProps {
  config: ConcaveHullConfig;
  onConfigChange: (config: ConcaveHullConfig) => void;
  points?: Point[];
  labels?: number[];
  selectedPoints?: Set<string>;
}

export const ConcaveHullPanel: React.FC<ConcaveHullPanelProps> = ({
  config,
  onConfigChange,
  points = [],
  labels = [],
  selectedPoints = new Set()
}) => {
  // Create color scale (same as used in HDBSCANMap) - memoized to prevent unnecessary recalculations
  const color = React.useMemo(() => d3.scaleOrdinal(d3.schemeTableau10), []);

  // Calculate hull perimeter data
  const perimeterData = React.useMemo(() => {
    if (!points.length || !labels.length) return [];
    return calculateHullPerimeter(points, labels, selectedPoints, config, color);
  }, [points, labels, selectedPoints, config, color]);
  return (
    <div className="bg-white rounded-lg shadow-lg border w-80">
      <Accordion type="single" collapsible defaultValue="hull-panel">
        <AccordionItem value="hull-panel" className="border-none">
          <AccordionTrigger className="px-4 pt-4 pb-2 hover:no-underline [&>svg]:ml-auto [&>svg]:shrink-0">
            <h3 className="text-lg font-semibold text-left">Concave Hull Visualization</h3>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
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

              {/* Hull Perimeter Chart */}
              {config.enabled && perimeterData.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <ConcaveHullPerimeterChart data={perimeterData} />
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};