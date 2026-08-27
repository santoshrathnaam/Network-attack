import React, { useState } from 'react';
import { SimulationData, InterventionAction, CyberDefenseState } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { NetworkTopologyMap } from '../network/NetworkTopologyMap';
import { Sparkles, ArrowRight, ShieldCheck, ShieldAlert, Zap, Server, Eye, Layers } from 'lucide-react';

interface FutureSimulationPanelProps {
  simulation: SimulationData;
  state?: CyberDefenseState;
  onSimulateClick: () => void;
  onSelectAction?: (action: InterventionAction) => void;
}

export const FutureSimulationPanel: React.FC<FutureSimulationPanelProps> = ({
  simulation,
  state,
  onSimulateClick,
  onSelectAction
}) => {
  const [selectedAction, setSelectedAction] = useState<InterventionAction>('ISOLATE_SERVER');
  const [showTopologyPreview, setShowTopologyPreview] = useState<boolean>(true);

  const handleActionChange = (action: InterventionAction) => {
    setSelectedAction(action);
    if (onSelectAction) onSelectAction(action);
  };

  const noActionPercent = Math.round(simulation.no_action * 100);
  const blockSourcesPercent = Math.round(simulation.block_sources * 100);
  const isolateServerPercent = Math.round(simulation.isolate_server * 100);
  const reductionPercent = Math.round(simulation.risk_reduction * 100);

  // Active projection based on selected button
  const currentSelectedRisk =
    selectedAction === 'NO_ACTION'
      ? noActionPercent
      : selectedAction === 'BLOCK_SOURCES'
      ? blockSourcesPercent
      : isolateServerPercent;

  const currentSelectedReduction =
    selectedAction === 'NO_ACTION'
      ? 0
      : selectedAction === 'BLOCK_SOURCES'
      ? 55
      : reductionPercent;

  return (
    <Card
      title="Future Simulation & Topology Matrix"
      subtitle="Counterfactual future modeling under distinct tactical interventions"
      badge={
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
          Module 3 Integration
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTopologyPreview((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all font-mono"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showTopologyPreview ? 'Hide Map' : 'Show Map'}</span>
          </button>
          <button
            onClick={onSimulateClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-white shadow-apple-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Modal</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Intervention Selection Controls */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleActionChange('NO_ACTION')}
            className={`px-3 py-2 rounded-xl border text-left transition-all ${
              selectedAction === 'NO_ACTION'
                ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-[#1C2029] ring-1 ring-neutral-900 dark:ring-neutral-100'
                : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              No Action
            </div>
            <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {noActionPercent}%
            </div>
            <div className="text-[10px] text-neutral-400">Future Risk</div>
          </button>

          <button
            onClick={() => handleActionChange('BLOCK_SOURCES')}
            className={`px-3 py-2 rounded-xl border text-left transition-all ${
              selectedAction === 'BLOCK_SOURCES'
                ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-[#1C2029] ring-1 ring-neutral-900 dark:ring-neutral-100'
                : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              Block Sources
            </div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {blockSourcesPercent}%
            </div>
            <div className="text-[10px] text-neutral-400">Future Risk</div>
          </button>

          <button
            onClick={() => handleActionChange('ISOLATE_SERVER')}
            className={`px-3 py-2 rounded-xl border text-left relative overflow-hidden transition-all ${
              selectedAction === 'ISOLATE_SERVER'
                ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-[#1C2029] ring-1 ring-neutral-900 dark:ring-neutral-100'
                : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              Isolate Server
            </div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {isolateServerPercent}%
            </div>
            <div className="text-[10px] text-neutral-400">Future Risk</div>
          </button>
        </div>

        {/* Embedded Topology View when preview toggle is enabled */}
        {showTopologyPreview && state && (
          <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <NetworkTopologyMap
              state={state}
              selectedAction={selectedAction}
              height="h-[320px]"
              compact={true}
            />
          </div>
        )}

        {/* Recommended Action Card */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                Recommended Action
              </span>
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Isolate Affected Server
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Sinkholes malicious ingress packets and isolates compromised edge node to avert saturation.
            </p>
          </div>

          <div className="flex items-center gap-4 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
                Projected Reduction
              </span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {currentSelectedReduction > 0 ? `-${currentSelectedReduction}%` : '0%'}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Comparison Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Scenario Comparison:</span>
            <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">
              {selectedAction === 'NO_ACTION'
                ? 'Status Quo (No Intervention)'
                : selectedAction === 'BLOCK_SOURCES'
                ? 'Ingress Filter Active'
                : 'Server Isolation Enforced'}
            </span>
          </div>

          <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
            {/* Safe baseline portion */}
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(10, 100 - currentSelectedRisk)}%` }}
              title="System Capacity Intact"
            />
            {/* Projected Risk portion */}
            <div
              className={`h-full transition-all duration-500 ${
                currentSelectedRisk > 70
                  ? 'bg-rose-500'
                  : currentSelectedRisk > 30
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${currentSelectedRisk}%` }}
              title="Projected Risk"
            />
          </div>

          <div className="flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
            <span>Preserved Capacity: {100 - currentSelectedRisk}%</span>
            <span>Residual Risk: {currentSelectedRisk}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

