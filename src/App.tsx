import React, { useState, useEffect, useCallback } from 'react';
import { CyberDefenseState, DataSourceMode, InterventionAction } from './types/cyberDefense';
import { cyberDefenseApi } from './services/cyberDefenseApi';
import { replayEngine, PlaybackMode } from './services/replayEngine';
import { TopStatusBar } from './components/header/TopStatusBar';
import { ReplayControls } from './components/header/ReplayControls';
import { ThreatSummaryCards } from './components/summary/ThreatSummaryCards';
import { NetworkActivityChart } from './components/charts/NetworkActivityChart';
import { AttackForecastPanel } from './components/forecast/AttackForecastPanel';
import { AttackTrajectoryPipeline } from './components/forecast/AttackTrajectoryPipeline';
import { ExplainabilityPanel } from './components/explainability/ExplainabilityPanel';
import { FutureSimulationPanel } from './components/simulation/FutureSimulationPanel';
import { ResponseSimulationModal } from './components/simulation/ResponseSimulationModal';
import { NetworkTopologyMap, TopologyNode, AttackVectorType } from './components/network/NetworkTopologyMap';
import { NodeInspectorDrawer } from './components/network/NodeInspectorDrawer';
import { AttackInjectorWidget } from './components/network/AttackInjectorWidget';
import { Layers, Shield, Cpu, Activity, Sparkles, CheckCircle2 } from 'lucide-react';

export function App() {
  const [state, setState] = useState<CyberDefenseState>(replayEngine.getCurrentStage().state);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(replayEngine.getPlaybackMode());
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(replayEngine.getPlaybackSpeed());
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(replayEngine.getCurrentStageIndex());
  const [dataSource, setDataSource] = useState<DataSourceMode>(cyberDefenseApi.getDataSource());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState<boolean>(false);
  const [isReplayDrawerOpen, setIsReplayDrawerOpen] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Network Topology & Inspector State
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [activeVector, setActiveVector] = useState<AttackVectorType>('DDOS');
  const [selectedTacticalAction, setSelectedTacticalAction] = useState<InterventionAction>('ISOLATE_SERVER');

  // Sync theme with HTML document class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Subscribe to CyberDefenseApi state updates
  useEffect(() => {
    const unsubscribeApi = cyberDefenseApi.subscribe((newState) => {
      setState(newState);
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

  const handleInjectVector = (vector: AttackVectorType, msg: string) => {
    setActiveVector(vector);
    if (vector === 'DDOS') setSelectedTacticalAction('NO_ACTION');
    showNotification(`[SCENARIO INJECTED] ${msg}`);
  };

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  const stages = replayEngine.getStages();

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] dark:bg-[#090A0C] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-200">
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

      {/* Main Command Center Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Section 1: Threat Summary & Key Primary Metrics */}
        <section aria-label="Threat Summary">
          <ThreatSummaryCards threat={state.threat} networkStatus={state.network_status} />
        </section>

        {/* Section 2: Full-Spectrum Network Topology Canvas & Interactive Scenario Injector */}
        <section aria-label="Interactive Network Topology" className="space-y-4">
          <NetworkTopologyMap
            state={state}
            selectedAction={selectedTacticalAction}
            activeAttackVector={activeVector}
            onSelectNode={(node) => setSelectedNode(node)}
            height="h-[520px]"
          />

          <AttackInjectorWidget
            onInjectVector={handleInjectVector}
            onApplyMitigation={handleApplyMitigation}
            onResetTopology={handleReset}
          />
        </section>

        {/* Section 3: Real-time Traffic Activity & Attack Forecast Distribution */}
        <section aria-label="Network Activity and Forecast" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 2 Columns on Desktop for Traffic Chart */}
          <div className="lg:col-span-2">
            <NetworkActivityChart
              trafficData={state.traffic_history}
              currentStatus={state.network_status}
            />
          </div>

          {/* Right: 1 Column on Desktop for Attack Probability Forecast */}
          <div className="lg:col-span-1">
            <AttackForecastPanel forecast={state.forecast} />
          </div>
        </section>

        {/* Section 4: Attack Trajectory Progression Stepper */}
        <section aria-label="Attack Trajectory">
          <AttackTrajectoryPipeline trajectory={state.trajectory} />
        </section>

        {/* Section 5: Explainability & Future Simulation Panels */}
        <section aria-label="Explainability and Simulation" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Why this forecast? */}
          <div>
            <ExplainabilityPanel evidence={state.evidence} />
          </div>

          {/* Right: Counterfactual Future Simulation */}
          <div>
            <FutureSimulationPanel
              simulation={state.simulation}
              state={state}
              onSimulateClick={() => setIsSimulationModalOpen(true)}
              onSelectAction={(action) => setSelectedTacticalAction(action)}
            />
          </div>
        </section>
      </main>

      {/* Slide-Out Node Telemetry Inspector Drawer */}
      <NodeInspectorDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onApplyAction={(act) => showNotification(`[POLICY APPLIED] ${act}`)}
      />

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

export default App;

