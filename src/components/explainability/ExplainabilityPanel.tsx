import React from 'react';
import { EvidenceItem, DerivationData, ScoreTerm } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { Network, Server, Key, Zap, Info, Gauge } from 'lucide-react';

interface ExplainabilityPanelProps {
  evidence: EvidenceItem[];
  derivation?: DerivationData;
}

// Everyday wording for each weighted signal.
const TERM_PLAIN: Record<string, string> = {
  syn: 'Half-finished connections',
  traffic: 'Traffic volume',
  source: 'Machines connecting',
  conn: 'Failed connections',
  accel: 'How fast it is rising',
};

const TERM_COLOR: Record<string, string> = {
  syn: 'bg-rose-500',
  traffic: 'bg-orange-500',
  source: 'bg-amber-500',
  conn: 'bg-sky-500',
  accel: 'bg-violet-500',
};

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ evidence, derivation }) => {
  // Preferred path: show exactly how the threat score was built.
  if (derivation) return <ScoreDecomposition derivation={derivation} />;
  return <LegacyEvidence evidence={evidence} />;
};

const ScoreDecomposition: React.FC<{ derivation: DerivationData }> = ({ derivation }) => {
  const { terms, score } = derivation;
  const maxWeight = Math.max(...terms.map((t) => t.weight)); // 0.30, for bar scaling

  let statusWord = 'NORMAL';
  if (score >= 0.85) statusWord = 'DDoS';
  else if (score >= 0.70) statusWord = 'ATTACK IMMINENT';
  else if (score >= 0.45) statusWord = 'SCANNING';
  else if (score >= 0.25) statusWord = 'ANOMALY';

  return (
    <Card
      title="What made the score this high"
      subtitle="Each signal counts for a fixed share. Bigger bar = bigger reason."
      badge={
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
          share × how unusual
        </span>
      }
    >
      <div className="space-y-2.5 pt-1">
        {terms.map((t) => (
          <TermRow key={t.key} t={t} maxWeight={maxWeight} />
        ))}
      </div>

      {/* Sum → score */}
      <div className="mt-3.5 pt-3 border-t border-neutral-100 dark:border-neutral-800/70 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <Gauge className="w-3.5 h-3.5" />
          <span>Everything added together</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-mono font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {score.toFixed(2)}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            → {statusWord}
          </span>
        </div>
      </div>
    </Card>
  );
};

const TermRow: React.FC<{ t: ScoreTerm; maxWeight: number }> = ({ t, maxWeight }) => {
  // Bar length ∝ this term's contribution relative to the biggest possible
  // single contribution (maxWeight × 1.0), so the segments read comparably.
  const fillPct = Math.min(100, (t.contribution / maxWeight) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{TERM_PLAIN[t.key] ?? t.label}</span>
        <span className="font-mono text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
          {t.weight.toFixed(2)} × {t.anomaly.toFixed(2)} ={' '}
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">{t.contribution.toFixed(3)}</span>
        </span>
      </div>
      <div className="h-2 w-full bg-neutral-200/70 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${TERM_COLOR[t.key] ?? 'bg-neutral-500'}`}
          style={{ width: `${Math.max(2, fillPct)}%` }}
        />
      </div>
    </div>
  );
};

// ---- fallback for payloads with no derivation (e.g. raw live API) ----------
const LegacyEvidence: React.FC<{ evidence: EvidenceItem[] }> = ({ evidence }) => {
  const getSignalIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('syn') || lower.includes('packet') || lower.includes('accel')) return <Zap className="w-3.5 h-3.5" />;
    if (lower.includes('source') || lower.includes('ip') || lower.includes('host')) return <Network className="w-3.5 h-3.5" />;
    if (lower.includes('connection') || lower.includes('port') || lower.includes('conn')) return <Server className="w-3.5 h-3.5" />;
    if (lower.includes('cred')) return <Key className="w-3.5 h-3.5" />;
    return <Info className="w-3.5 h-3.5" />;
  };

  return (
    <Card title="Why this forecast?" subtitle="Measurable network telemetry shifts driving the model">
      <div className="space-y-3.5 pt-1">
        {evidence.map((item, index) => {
          const changePercent = Math.round(item.change * 100);
          const absChange = Math.abs(changePercent);
          let barColor = 'bg-rose-500';
          let textColor = 'text-rose-600 dark:text-rose-400';
          if (item.change < 0) { barColor = 'bg-emerald-500'; textColor = 'text-emerald-600 dark:text-emerald-400'; }
          else if (absChange < 30) { barColor = 'bg-amber-500'; textColor = 'text-amber-600 dark:text-amber-400'; }
          else if (absChange < 60) { barColor = 'bg-orange-500'; textColor = 'text-orange-600 dark:text-orange-400'; }
          return (
            <div key={index} className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-white dark:bg-[#1F2430] text-neutral-500 dark:text-neutral-400">
                    {getSignalIcon(item.name)}
                  </span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.current_value && (
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono hidden sm:inline">
                      {item.baseline_value ? `${item.baseline_value} → ` : ''}{item.current_value}
                    </span>
                  )}
                  <span className={`font-mono text-xs font-semibold tabular-nums ${textColor}`}>
                    {item.change >= 0 ? `+${changePercent}%` : `${changePercent}%`}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-neutral-200/70 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, Math.max(5, absChange))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
