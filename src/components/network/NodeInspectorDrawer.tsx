import React from 'react';
import { TopologyNode } from './NetworkTopologyMap';
import {
  X,
  Cpu,
  Activity,
  ShieldAlert,
  Server,
  Zap,
  Globe,
  Database,
  Lock,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';

interface NodeInspectorDrawerProps {
  node: TopologyNode | null;
  onClose: () => void;
  onApplyAction?: (actionName: string) => void;
}

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({
  node,
  onClose,
  onApplyAction
}) => {
  if (!node) return null;

  const { cpu, bandwidth, connections, dropRate, latencyMs, status } = node.metrics;

  const getStatusBadge = () => {
    switch (status) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> CRITICAL
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1">
            <Activity className="w-3 h-3" /> DEGRADED
          </span>
        );
      case 'ISOLATED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> ISOLATED
          </span>
        );
      case 'SINKHOLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
            <Lock className="w-3 h-3" /> SINKHOLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> HEALTHY
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white/95 dark:bg-[#12151E]/95 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl backdrop-blur-xl flex flex-col justify-between animate-slideLeft transition-all font-sans text-neutral-900 dark:text-neutral-100">
      {/* Drawer Header */}
      <div>
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              {node.id === 'node-botnet' && <Globe className="w-5 h-5 text-rose-500" />}
              {node.id === 'node-clients' && <Radio className="w-5 h-5 text-sky-500" />}
              {node.id === 'node-firewall' && <ShieldAlert className="w-5 h-5 text-amber-500" />}
              {node.id === 'node-gateway' && <Zap className="w-5 h-5 text-indigo-500" />}
              {node.id === 'node-app-server' && <Server className="w-5 h-5 text-emerald-500" />}
              {node.id === 'node-db' && <Database className="w-5 h-5 text-emerald-500" />}
              {node.id === 'node-sinkhole' && <Lock className="w-5 h-5 text-cyan-500" />}
            </div>

            <div>
              <h3 className="text-base font-bold tracking-tight">{node.name}</h3>
              <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                {node.ip} • ID: {node.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Zone Banner */}
        <div className="px-5 py-2.5 bg-neutral-100/60 dark:bg-[#181C28]/60 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-500 dark:text-neutral-400">Security Zone:</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{node.zoneName}</span>
        </div>

        {/* Content Body & Live Gauges */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-220px)]">
          {/* Status & Overview Card */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#161A24] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider">
                Telemetry State
              </span>
              {getStatusBadge()}
            </div>

            <div className="text-xs text-neutral-600 dark:text-neutral-300">
              <span className="font-semibold">Role:</span> {node.role}
            </div>
          </div>

          {/* Live Telemetry Gauges */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Live Hardware & Network Metrics
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {/* CPU Metric (if available) */}
              {cpu !== undefined && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#161A24] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Cpu className="w-3.5 h-3.5 text-neutral-400" /> CPU Load
                    </span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{cpu}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        cpu > 80 ? 'bg-rose-500' : cpu > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${cpu}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bandwidth Metric */}
              {bandwidth && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#161A24] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 font-medium">Throughput</div>
                  <div className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                    {bandwidth}
                  </div>
                </div>
              )}

              {/* Connections Metric */}
              {connections !== undefined && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#161A24] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 font-medium">Active Sessions</div>
                  <div className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
                    {connections.toLocaleString()}
                  </div>
                </div>
              )}

              {/* Drop Rate Metric */}
              {dropRate !== undefined && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#161A24] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 font-medium">Drop Rate</div>
                  <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                    {dropRate}%
                  </div>
                </div>
              )}

              {/* Latency Metric */}
              {latencyMs !== undefined && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#161A24] border border-neutral-200/80 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 font-medium">DB Latency</div>
                  <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {latencyMs} ms
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Firewall Rules / BGP Ban List (If Firewall Node) */}
          {node.id === 'node-firewall' && (
            <div className="p-3.5 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase tracking-wider font-bold">
                <span>Active Edge ACL Rules</span>
                <span>Rule Engine v4</span>
              </div>
              <div className="text-[11px] text-rose-400">
                • DROP src 198.51.100.0/24 dst 10.0.2.100 (SYN Flood)
              </div>
              <div className="text-[11px] text-emerald-400">
                • ACCEPT src 172.16.0.0/16 port 443 (HTTPS Traffic)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Action Toolbar */}
      <div className="p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#10131B]/50 flex flex-col gap-2">
        <button
          onClick={() => {
            if (onApplyAction) onApplyAction(`Mitigate Node ${node.id}`);
            onClose();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold hover:bg-neutral-800 dark:hover:bg-white transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Sliders className="w-4 h-4" />
          <span>Apply Tactical Policy to {node.name}</span>
        </button>
      </div>
    </div>
  );
};
