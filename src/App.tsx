import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CyberDefenseState, DataSourceMode, InterventionAction } from './types/cyberDefense';
import { cyberDefenseApi } from './services/cyberDefenseApi';
import { replayEngine, PlaybackMode } from './services/replayEngine';
import { TopStatusBar } from './components/header/TopStatusBar';
import { ReplayControls } from './components/header/ReplayControls';
import { ThreatSummaryCards } from './components/summary/ThreatSummaryCards';
import { PlainSummary } from './components/summary/PlainSummary';
import { NetworkActivityChart } from './components/charts/NetworkActivityChart';
import { AttackForecastPanel } from './components/forecast/AttackForecastPanel';
import { AttackTrajectoryPipeline } from './components/forecast/AttackTrajectoryPipeline';
import { ExplainabilityPanel } from './components/explainability/ExplainabilityPanel';
import { SignalMatrix } from './components/explainability/SignalMatrix';
import { SandboxPanel, SANDBOX_DEFAULTS, type SandboxInputs } from './components/sandbox/SandboxPanel';
import { applyDynamics } from './services/engine';
import { stateFromWindows } from './services/stateBuilder';
import { FutureSimulationPanel } from './components/simulation/FutureSimulationPanel';
import { ResponseSimulationModal } from './components/simulation/ResponseSimulationModal';
import { Layers, Shield, Cpu, Activity, Sparkles, CheckCircle2 } from 'lucide-react';
import { SiteView } from './components/site/SiteView';
import { ScoreTimeline } from './components/charts/ScoreTimeline';
import { ResponseCards } from './components/simulation/ResponseCards';
import { DecisionPanel } from './components/decision/DecisionPanel';
import { DerivationChain } from './components/derivation/DerivationChain';
import { buildStageState } from './mock/mockDataset';

export function App() {
  const [replayState, setReplayState] = useState<CyberDefenseState>(replayEngine.getCurrentStage().state);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(replayEngine.getPlaybackMode());
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(replayEngine.getPlaybackSpeed());
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(replayEngine.getCurrentStageIndex());
  const [dataSource, setDataSource] = useState<DataSourceMode>(cyberDefenseApi.getDataSource());
  // The product committed to one light editorial language, so the dashboard and
  // the site can no longer drift apart. Kept as state purely so the existing
  // header toggle still has something to bind to.
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState<boolean>(false);
  const [isReplayDrawerOpen, setIsReplayDrawerOpen] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // Landing on the plain explainer; the operator dashboard is one click away.
  const [view, setView] = useState<'explain' | 'dashboard'>('explain');

  const [selectedTacticalAction, setSelectedTacticalAction] = useState<InterventionAction>('ISOLATE_SERVER');

  // ---- Live sandbox: operator-driven telemetry -----------------------------
  const SANDBOX_WINDOWS = 26;
  const [sandboxOn, setSandboxOn] = useState<boolean>(false);
  const [sandboxInputs, setSandboxInputs] = useState<SandboxInputs>({ ...SANDBOX_DEFAULTS });
  const [sandboxHistory, setSandboxHistory] = useState<SandboxInputs[]>(
    () => Array.from({ length: SANDBOX_WINDOWS }, () => ({ ...SANDBOX_DEFAULTS }))
  );
  const inputsRef = useRef(sandboxInputs);
  inputsRef.current = sandboxInputs;

  // While the sandbox is live it keeps sampling, so the trace scrolls and
  // acceleration/momentum stay measured from a real stream of windows.
  useEffect(() => {
    if (!sandboxOn) return;
    const id = window.setInterval(() => {
      setSandboxHistory((h) => [...h.slice(1), { ...inputsRef.current }]);
    }, 900);
    return () => window.clearInterval(id);
  }, [sandboxOn]);

  const handleToggleSandbox = (on: boolean) => {
    if (on) {
      // seed a flat history at the current dial positions
      setSandboxHistory(Array.from({ length: SANDBOX_WINDOWS }, () => ({ ...inputsRef.current })));
    }
    setSandboxOn(on);
    showNotification(on ? 'Sandbox enabled — telemetry is now operator-driven' : 'Sandbox off — back to demo timeline');
  };

  // Bumped whenever the operator edits the decision model, forcing a re-derive.
  const [settingsVersion, setSettingsVersion] = useState(0);

  // The newest window is always the live dial position, so dragging updates
  // instantly rather than waiting for the next sample.
  const sandboxState = useMemo(() => {
    if (!sandboxOn) return null;
    const raw = [...sandboxHistory.slice(1), sandboxInputs].map((i) => ({ ...i }));
    return stateFromWindows(applyDynamics(raw));
  }, [sandboxOn, sandboxHistory, sandboxInputs, settingsVersion]);

  // Demo stages are built at import time, so re-derive the current one whenever
  // the assumptions change. Live-stream mode keeps its own ticking state.
  const stageKey = replayEngine.getStages()[currentStageIndex]?.key;
  const derivedStageState = useMemo(() => {
    if (!stageKey) return null;
    try { return buildStageState(stageKey); } catch { return null; }
  }, [stageKey, settingsVersion]);

  const state: CyberDefenseState =
    sandboxState ??
    (playbackMode === 'LIVE_STREAM' ? replayState : (derivedStageState ?? replayState));

  // Sync theme with HTML document class
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Subscribe to CyberDefenseApi state updates
  useEffect(() => {
    const unsubscribeApi = cyberDefenseApi.subscribe((newState) => {
      setReplayState(newState);
    });

    const unsubscribeReplay = replayEngine.subscribe(() => {
      setPlaybackMode(replayEngine.getPlaybackMode());
      setPlaybackSpeed(replayEngine.getPlaybackSpeed());
      setCurrentStageIndex(replayEngine.getCurrentStageIndex());
    });

    return () => {
      unsubscribeApi();
      unsubscribeReplay();
    };
  }, []);

  // Handlers for media / replay actions
  const handlePlay = (fromStart?: boolean) => {
    replayEngine.startReplay(fromStart);
  };

  const handlePause = () => {
    replayEngine.pause();
  };

  const handleReset = () => {
    replayEngine.reset();
    setSelectedTacticalAction('NO_ACTION');
    showNotification('Reset to Stage 4 (Attack Imminent Scenario)');
  };

  const handleNextStage = () => {
    replayEngine.nextStage();
  };

  const handlePrevStage = () => {
    replayEngine.previousStage();
  };

  const handleJumpToStage = (index: number) => {
    replayEngine.jumpToStage(index);
    if (index === 5) {
      setSelectedTacticalAction('ISOLATE_SERVER');
    }
  };

  const handleSetSpeed = (spd: number) => {
    replayEngine.setPlaybackSpeed(spd);
  };

  const handleStartLiveStream = () => {
    replayEngine.startLiveStream();
    showNotification('Live stream streaming active');
  };

  const handleToggleDataSource = () => {
    const nextSource = dataSource === 'mock' ? 'api' : 'mock';
    cyberDefenseApi.setDataSource(nextSource);
    setDataSource(nextSource);
    showNotification(`Switched data source to: ${nextSource.toUpperCase()}`);
  };

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleApplyMitigation = () => {
    // Transition to Stage 6 (Mitigated state)
    replayEngine.jumpToStage(5);
    setSelectedTacticalAction('ISOLATE_SERVER');
    showNotification('Intervention Executed: Server Isolated. Risk reduced to 18%.');
  };

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  const stages = replayEngine.getStages();

  if (view === 'explain') {
    return <SiteView onOpenDashboard={() => setView('dashboard')} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink font-body">
      {/* Top Status Header */}
      <TopStatusBar
        state={state}
        playbackMode={playbackMode}
        currentStageIndex={currentStageIndex}
        totalStages={stages.length}
        dataSource={dataSource}
        onToggleDataSource={handleToggleDataSource}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onToggleReplayDrawer={() => setIsReplayDrawerOpen((prev) => !prev)}
        isReplayOpen={isReplayDrawerOpen}
      />

      {/* Interactive Replay / Demo Timeline Toolbar */}
      {isReplayDrawerOpen && (
        <ReplayControls
          stages={stages}
          currentStageIndex={currentStageIndex}
          playbackMode={playbackMode}
          playbackSpeed={playbackSpeed}
          onPlay={handlePlay}
          onPause={handlePause}
          onReset={handleReset}
          onNextStage={handleNextStage}
          onPrevStage={handlePrevStage}
          onJumpToStage={handleJumpToStage}
          onSetSpeed={handleSetSpeed}
          onStartLiveStream={handleStartLiveStream}
        />
      )}

      {/* Floating Action Feedback Notification */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-fadeIn border border-neutral-800 dark:border-neutral-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Command Center Layout — ordered as a story, not a wall of panels */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-5 sm:px-8 py-10 space-y-14">
        <div>
          <button
            onClick={() => setView('explain')}
            data-cursor
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-inkSoft hover:text-signal transition-colors"
          >
            ← back to the story
          </button>
          <h1 className="mt-5 font-display font-extrabold text-[2.4rem] sm:text-[3.4rem] leading-[0.98] tracking-[-0.03em]">
            The technical panel
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-inkSoft max-w-2xl leading-snug">
            The same engine, with its working shown. Everything below is measured from
            the traffic — nothing on this page was typed in.
          </p>
        </div>

        {/* 1 — the situation, in words */}
        <section aria-label="What is happening">
          <PlainSummary state={state} />
        </section>

        {/* 2 — the headline numbers */}
        <section aria-label="Key numbers">
          <ThreatSummaryCards
            threat={state.threat}
            networkStatus={state.network_status}
            confidence={state.derivation?.decision.confidence}
          />
        </section>

        {/* 3 — is this normal? */}
        <section aria-label="The four signals">
          <SectionHead
            title="The four things we watch"
            subtitle="A dot inside the green band means that measurement is behaving normally."
          />
          <SignalMatrix derivation={state.derivation} />
        </section>

        {/* 3b — the full audit trail */}
        <section aria-label="Where the numbers come from">
          <SectionHead
            title="Where every number comes from"
            subtitle="The whole calculation, start to finish, with today's figures in it."
          />
          <DerivationChain derivation={state.derivation} />
        </section>

        {/* 4 — how the score moved */}
        <section aria-label="Score over time">
          <SectionHead
            title="How the score moved"
            subtitle="The last few minutes. Hover anywhere on the line to read that moment."
          />
          <div className="bg-white dark:bg-[#12141A] border border-[#E5E5EA] dark:border-[#222733] rounded-[16px] p-5 shadow-apple dark:shadow-apple-dark">
            <ScoreTimeline derivation={state.derivation} />
          </div>
        </section>

        {/* 5 — what to do */}
        <section aria-label="What to do">
          <SectionHead
            title="What should we do?"
            subtitle="Each choice played forward five minutes. Lower is better."
          />
          <ResponseCards
            derivation={state.derivation}
            onChoose={(a) => setSelectedTacticalAction(a as InterventionAction)}
          />
        </section>

        {/* 5b — how that decision was actually reached, and its levers */}
        <section aria-label="How the decision is made">
          <SectionHead
            title="How is that decision made?"
            subtitle="The arithmetic behind each option — and the assumptions you can argue with."
          />
          <DecisionPanel
            derivation={state.derivation}
            onChange={() => setSettingsVersion((v) => v + 1)}
          />
        </section>

        {/* 6 — take the controls */}
        <section aria-label="Live Sandbox">
          <SectionHead
            title="Try it yourself"
            subtitle="Drive the network by hand and watch every number above react."
          />
          <SandboxPanel
            enabled={sandboxOn}
            inputs={sandboxInputs}
            onToggle={handleToggleSandbox}
            onChange={setSandboxInputs}
            streaming={sandboxOn}
          />
        </section>

        {/* 7 — everything technical, folded away until asked for */}
        <details className="group rounded-[16px] border border-[#E5E5EA] dark:border-[#222733] bg-white dark:bg-[#12141A] overflow-hidden">
          <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between select-none">
            <span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-100">Technical details</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                The maths, the attack classifier and the kill-chain
              </span>
            </span>
            <span className="text-xs font-mono text-neutral-400 group-open:hidden">show</span>
            <span className="text-xs font-mono text-neutral-400 hidden group-open:inline">hide</span>
          </summary>

          <div className="px-5 pb-5 space-y-6 border-t border-[#F0F0F3] dark:border-[#1E232E] pt-5">
            <ExplainabilityPanel evidence={state.evidence} derivation={state.derivation} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AttackForecastPanel forecast={state.forecast} />
              <AttackTrajectoryPipeline trajectory={state.trajectory} />
            </div>

            <NetworkActivityChart
              trafficData={state.traffic_history}
              currentStatus={state.network_status}
            />

            <FutureSimulationPanel
              simulation={state.simulation}
              state={state}
              onSimulateClick={() => setIsSimulationModalOpen(true)}
              onSelectAction={(action) => setSelectedTacticalAction(action)}
            />

          </div>
        </details>
      </main>

      {/* Counterfactual Response Simulation Modal Flow */}
      <ResponseSimulationModal
        isOpen={isSimulationModalOpen}
        onClose={() => setIsSimulationModalOpen(false)}
        state={state}
        onApplyMitigation={handleApplyMitigation}
      />

      {/* Clean Minimal Footer */}
      <footer className="border-t border-[#E5E5EA] dark:border-[#222733] bg-white/50 dark:bg-[#12141A]/50 py-4 mt-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400 dark:text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              SIH26153 • NTRO
            </span>
            <span>•</span>
            <span>AI-based Network Attack Forecasting</span>
            <span>•</span>
            <span className="font-mono text-[11px]">Module 4 (SOC Frontend)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Pipeline: M1 ➔ M2 ➔ M3 ➔ M4</span>
            <span className="text-emerald-600 dark:text-emerald-400">● Contract Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const SectionHead: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-5">
    <h2 className="font-display font-extrabold text-2xl sm:text-3xl leading-[1.05] tracking-[-0.02em] text-ink">
      {title}
    </h2>
    {subtitle && <p className="text-base text-inkSoft mt-1.5 max-w-2xl leading-snug">{subtitle}</p>}
  </div>
);

export default App;

