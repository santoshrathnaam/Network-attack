import React from 'react';
import { Zap, ShieldAlert, Crosshair, Database, CheckCircle2, RefreshCw } from 'lucide-react';
import { AttackVectorType } from './NetworkTopologyMap';

interface AttackInjectorWidgetProps {
  onInjectVector: (vector: AttackVectorType, message: string) => void;
  onApplyMitigation: () => void;
  onResetTopology?: () => void;
}

export const AttackInjectorWidget: React.FC<AttackInjectorWidgetProps> = ({
  onInjectVector,
  onApplyMitigation,
  onResetTopology
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#12151E] border border-neutral-200 dark:border-neutral-800 shadow-apple-sm transition-all">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Live Attack Scenario Injector
            </h4>
            <p className="text-[11px] text-neutral-400">
              Simulate dynamic attack vectors and evaluate real-time topology response
            </p>
          </div>
        </div>

        {onResetTopology && (
          <button
            onClick={onResetTopology}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs flex items-center gap-1 font-mono"
            title="Reset Canvas Topology"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Injector Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => onInjectVector('DDOS', 'Injected 150,000 pps SYN Flood across Zone 1 Ingress')}
          className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> SYN Flood
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
              150k pps
            </span>
          </div>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1">
            Simulate 150,000 pps botnet SYN flood attack vector.
          </p>
        </button>

        <button
          onClick={() => onInjectVector('RECON', 'Injected Sonar Reconnaissance Sweep across Ports 22, 80, 443')}
          className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5" /> Port Scan
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
              Recon
            </span>
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
            Simulate sonar port sweep against DMZ Firewall.
          </p>
        </button>

        <button
          onClick={() => onInjectVector('EXFILTRATION', 'Injected Data Exfiltration stream from DB (10.0.3.200)')}
          className="p-3 rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20 hover:bg-violet-100/60 dark:hover:bg-violet-950/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-violet-700 dark:text-violet-400">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Exfiltration
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-200 dark:bg-violet-900 text-violet-800 dark:text-violet-200">
              DB Stream
            </span>
          </div>
          <p className="text-[11px] text-violet-600/80 dark:text-violet-400/80 mt-1">
            Simulate reverse DB egress transfer to external C2.
          </p>
        </button>

        <button
          onClick={onApplyMitigation}
          className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-left transition-all group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Apply Defense
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
              Isolate
            </span>
          </div>
          <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90 mt-1">
            Enforce server isolation & BGP sinkholing.
          </p>
        </button>
      </div>
    </div>
  );
};
