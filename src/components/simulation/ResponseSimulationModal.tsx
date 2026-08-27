import React, { useState, useEffect } from 'react';
import { CyberDefenseState, InterventionAction } from '../../types/cyberDefense';
import { NetworkTopologyMap } from '../network/NetworkTopologyMap';
import {
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Server,
  Filter,
  X,
  Sparkles,
  Zap,
  Layers
} from 'lucide-react';

interface ResponseSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: CyberDefenseState;
  onApplyMitigation: () => void;
}

export const ResponseSimulationModal: React.FC<ResponseSimulationModalProps> = ({
  isOpen,
  onClose,
  state,
  onApplyMitigation
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [selectedIntervention, setSelectedIntervention] = useState<InterventionAction>('ISOLATE_SERVER');
  const [showTopologyCanvas, setShowTopologyCanvas] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setActiveStep(1);
      // Fast, subtle step transition
      const t1 = setTimeout(() => setActiveStep(2), 500);
      const t2 = setTimeout(() => setActiveStep(3), 1100);
      const t3 = setTimeout(() => setActiveStep(4), 1700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRisk = Math.round(state.threat.score * 100);
  const noActionRisk = Math.round(state.simulation.no_action * 100);
  const isolateRisk = Math.round(state.simulation.isolate_server * 100);
  const blockRisk = Math.round(state.simulation.block_sources * 100);
  const riskReduction = Math.round(state.simulation.risk_reduction * 100);

  const targetRisk = selectedIntervention === 'ISOLATE_SERVER' ? isolateRisk : blockRisk;
  const currentReduction = selectedIntervention === 'ISOLATE_SERVER' ? riskReduction : 55;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-[#13161C] border border-[#E5E5EA] dark:border-[#252C38] rounded-[24px] max-w-4xl w-full p-6 shadow-2xl transition-all overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Counterfactual Response Simulator
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Module 3 Future Simulator • Topology Vector Flow Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTopologyCanvas((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showTopologyCanvas ? 'Hide Topology' : 'Show Topology'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step-by-Step Transition Visualizer & Canvas Body */}
        <div className="py-4 space-y-4 overflow-y-auto">
          {/* Main Transition Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
            {/* Step 1: Current Risk */}
            <div
              className={`p-3 rounded-xl border transition-all duration-300 ${
                activeStep >= 1
                  ? 'bg-neutral-50 dark:bg-[#1A1E27] border-neutral-200 dark:border-neutral-700 opacity-100'
                  : 'border-transparent opacity-40'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500">
                1. Current Threat
              </span>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                {currentRisk}%
              </div>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Observed Risk
              </span>
            </div>

            {/* Step 2: Without Action */}
            <div
              className={`p-3 rounded-xl border transition-all duration-300 ${
                activeStep >= 2
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-100'
                  : 'border-transparent opacity-40'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500">
                2. No Action
              </span>
              <div className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300 mt-0.5">
                {noActionRisk}%
              </div>
              <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                Projected Failure
              </span>
            </div>

            {/* Step 3: With Intervention */}
            <div
              className={`p-3 rounded-xl border transition-all duration-300 ${
                activeStep >= 3
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-100'
                  : 'border-transparent opacity-40'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                3. With Isolation
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {targetRisk}%
              </div>
              <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                Post-Intervention
              </span>
            </div>

            {/* Step 4: Net Risk Reduction */}
            <div
              className={`p-3 rounded-xl border transition-all duration-300 ${
                activeStep >= 4
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100 shadow-md opacity-100 scale-105'
                  : 'border-transparent opacity-40'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-300 dark:text-neutral-600">
                4. Net Reduction
              </span>
              <div className="text-2xl font-bold font-mono mt-0.5">
                -{currentReduction}%
              </div>
              <span className="text-[11px] text-neutral-300 dark:text-neutral-600">
                Lower Future Risk
              </span>
            </div>
          </div>

          {/* Embedded Interactive Network Topology Canvas */}
          {showTopologyCanvas && (
            <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-lg">
              <NetworkTopologyMap
                state={state}
                selectedAction={selectedIntervention}
                height="h-[340px]"
                compact={true}
              />
            </div>
          )}

          {/* Intervention Selection Pill Group */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Select Defense Strategy:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => setSelectedIntervention('ISOLATE_SERVER')}
                className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                  selectedIntervention === 'ISOLATE_SERVER'
                    ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-[#1B202A] ring-2 ring-neutral-900/10'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                    <Server className="w-3.5 h-3.5" />
                    <span>Isolate Affected Server</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Isolates target host & reroutes packets into BGP Sinkhole. Projected risk drops to 18%.
                  </p>
                </div>
                <div className="text-right pl-2">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    -73%
                  </span>
                </div>
              </button>

              <button
                onClick={() => setSelectedIntervention('BLOCK_SOURCES')}
                className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                  selectedIntervention === 'BLOCK_SOURCES'
                    ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-[#1B202A] ring-2 ring-neutral-900/10'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Block Suspicious Sources</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Bans top 50 attacker IPs at Edge Firewall. Attacker may rotate IPs. Projected risk 39%.
                  </p>
                </div>
                <div className="text-right pl-2">
                  <span className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-300">
                    -55%
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            Dismiss Simulation
          </button>

          <button
            onClick={() => {
              onApplyMitigation();
              onClose();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-white shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply Defense & Mitigate (Stage 6)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

