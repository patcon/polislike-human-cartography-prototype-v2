import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Grid2x2Plus, Shrink, Group, HelpCircle } from "lucide-react";
import config from "./config.json";

export function getInitialSelections() {
  const initial: Selections = {};

  const sections = {
    imputer: config.imputers,
    reducer: config.reducers,
    clusterer: config.clusterers,
  };

  Object.entries(sections).forEach(([sectionKey, items]) => {
    initial[sectionKey] = {};
    items.forEach((item) => {
      initial[sectionKey][item.name] = {};
      item.params.forEach((param) => {
        initial[sectionKey][item.name][param.name] = param.values[0];
      });
    });
  });

  return initial;
}

export interface Selections {
  [section: string]: {
    [algo: string]: { [param: string]: any };
  };
}

interface Param {
  name: string;
  label: string;
  description: string;
  values: (number | number[] | string)[]; // covers nested arrays too
  format?: string;
}

interface ParamSelectorProps {
  params: Param[];
  selections: Selections;
  setSelections: React.Dispatch<React.SetStateAction<Selections>>;
  section: string;
  algo: string;
}

const ParamSelector: React.FC<ParamSelectorProps> = ({ params, selections, setSelections, section, algo }) => {
  return (
    <div className="grid gap-2 mt-2">
      {params.map((param) => (
        <div key={param.name} className="flex items-center gap-2">
          <Label className="min-w-[120px] flex items-center gap-1">
            {param.label}
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="whitespace-pre-line">{param.description}</p>
              </TooltipContent>
            </Tooltip>
          </Label>

          {param.values.length === 1 ? (
            <ToggleGroup variant="outline" type="single" value={String(param.values[0])} className="flex">
              <ToggleGroupItem value={String(param.values[0])} disabled className="h-9 px-3 min-w-auto">
                {param.format ? param.format.replace("{val}", String(param.values[0])) : String(param.values[0])}
              </ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <ToggleGroup
              variant="outline"
              type="single"
              value={String(selections[section]?.[algo]?.[param.name] ?? param.values[0])}
              onValueChange={(val) =>
                setSelections((prev) => ({
                  ...prev,
                  [section]: {
                    ...prev[section],
                    [algo]: {
                      ...prev[section]?.[algo],
                      [param.name]: val,
                    },
                  },
                }))
              }
              className="flex"
            >
              {param.values.map((val: number | number[] | string) => {
                const strVal = String(val);

                // disable n_components === 3
                const isDisabled =
                  param.name === "n_components" && strVal === "3";

                return (
                  <ToggleGroupItem key={strVal} value={strVal} disabled={isDisabled} className="h-9 px-3 min-w-auto">
                    {param.format ? param.format.replace("{val}", strVal) : strVal}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          )}
        </div>
      ))}
    </div>
  );
};

interface SectionItem {
  name: string;
  class: string;
  params: Param[];
}

interface SectionProps {
  label: string;
  items: SectionItem[];
  icon: React.FC<any>;
  sectionKey: string;
  selections: Selections;
  setSelections: React.Dispatch<React.SetStateAction<Selections>>;
}

const Section: React.FC<SectionProps> = ({ label, items, icon: Icon, sectionKey, selections, setSelections }) => {
  const activeAlgo = Object.keys(selections[sectionKey] ?? {})[0] ?? items[0].name;
  const [selected, setSelected] = useState(activeAlgo);

  return (
    <Card>
      <CardHeader className="flex justify-between items-center pb-2">
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5" /> {label}
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{label} step in pipeline</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <Tabs value={selected} onValueChange={(newAlgo) => {
          setSelected(newAlgo);
          setSelections(prev => ({
            ...prev,
            [sectionKey]: { [newAlgo]: prev[sectionKey]?.[newAlgo] ?? getInitialSelections()[sectionKey][newAlgo] }
          }));
        }} className="w-full">
          <TabsList className={`grid grid-cols-${items.length}`}>
            {items.map((item) => (
              <TabsTrigger key={item.name} value={item.name}>
                {item.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {items.map((item) => (
            <TabsContent key={item.name} value={item.name}>
              <ParamSelector
                params={item.params}
                selections={selections}
                setSelections={setSelections}
                section={sectionKey}
                algo={item.name}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface AppProps {
  selections: Selections;
  setSelections: React.Dispatch<React.SetStateAction<Selections>>;
}

const App: React.FC<AppProps> = ({ selections, setSelections }) => {

  return (
    <div className="p-4 grid gap-4 w-full min-w-[320px]">
      <Section
        label="Fill Missing"
        items={config.imputers}
        icon={Grid2x2Plus}
        sectionKey="imputer"
        selections={selections}
        setSelections={setSelections}
      />
      <Section
        label="Dimension Reduction"
        items={config.reducers}
        icon={Shrink}
        sectionKey="reducer"
        selections={selections}
        setSelections={setSelections}
      />
      <Section
        label="Clustering"
        items={config.clusterers}
        icon={Group}
        sectionKey="clusterer"
        selections={selections}
        setSelections={setSelections}
      />
    </div>
  );
};

export default App;
