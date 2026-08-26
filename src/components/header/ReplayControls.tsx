import React from 'react';
import { DemoStage } from '../../types/cyberDefense';
import { PlaybackMode } from '../../services/replayEngine';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  FastForward
} from 'lucide-react';

interface ReplayControlsProps {
  stages: DemoStage[];
  currentStageIndex: number;
  playbackMode: PlaybackMode;
  playbackSpeed: number;
  onPlay: (fromStart?: boolean) => void;
  onPause: () => void;
  onReset: () => void;
  onNextStage: () => void;
  onPrevStage: () => void;
  onJumpToStage: (index: number) => void;
  onSetSpeed: (speed: number) => void;
  onStartLiveStream: () => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  stages,
  currentStageIndex,
  playbackMode,
  playbackSpeed,
  onPlay,
  onPause,
  onReset,
  onNextStage,
  onPrevStage,
  onJumpToStage,
  onSetSpeed,
  onStartLiveStream
}) => {
  const currentStage = stages[currentStageIndex] || stages[0];

  return (
    <div className="bg-white dark:bg-[#12141A] border-b border-[#E5E5EA] dark:border-[#222733] py-3 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: Stage Badges / Pipeline Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
          {stages.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            const isPassed = idx < currentStageIndex;

            return (
              <button
                key={stage.id}
                onClick={() => onJumpToStage(idx)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                    : isPassed
                    ? 'bg-neutral-100 text-neutral-700 dark:bg-[#1C2029] dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#252B38]'
                    : 'bg-transparent text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#181C24]'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                      : isPassed
                      ? 'bg-neutral-300 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <span>{stage.name.split(':')[1]?.trim() || stage.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Media Controls & Utilities */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          {/* Active Stage Description Tooltip */}
          <div className="hidden xl:block max-w-xs text-xs text-neutral-500 dark:text-neutral-400 truncate">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {currentStage.name}:
            </span>{' '}
            {currentStage.description}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Step Back */}
            <button
              onClick={onPrevStage}
              disabled={currentStageIndex === 0}
              title="Previous Stage"
              className="p-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#262C38] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Play / Pause Toggle */}
            {playbackMode === 'REPLAY' ? (
              <button
                onClick={onPause}
                title="Pause Replay"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium text-xs shadow-sm hover:bg-amber-600 transition-colors"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={() => onPlay(currentStageIndex === stages.length - 1)}
                title="Play Attack Progression"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium text-xs shadow-sm hover:bg-neutral-800 dark:hover:bg-white transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{currentStageIndex === stages.length - 1 ? 'Replay Demo' : 'Play'}</span>
              </button>
            )}

            {/* Step Next */}
            <button
              onClick={onNextStage}
              disabled={currentStageIndex === stages.length - 1}
              title="Next Stage"
              className="p-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#262C38] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Reset */}
            <button
              onClick={onReset}
              title="Reset to Critical Attack Stage"
              className="p-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#262C38] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed Selector */}
            <div className="flex items-center rounded-lg border border-[#E5E5EA] dark:border-[#262C38] p-0.5 ml-1">
              {[0.5, 1.0, 2.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onSetSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Live Stream Mode Switch */}
            <button
              onClick={onStartLiveStream}
              title="Switch to Synthetic Real-Time Stream"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ml-1 transition-colors ${
                playbackMode === 'LIVE_STREAM'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'border-[#E5E5EA] dark:border-[#262C38] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Stream</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
