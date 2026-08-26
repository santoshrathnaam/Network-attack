import React from 'react';
import { CyberDefenseState, DataSourceMode } from '../../types/cyberDefense';
import { PlaybackMode } from '../../services/replayEngine';
import { Badge } from '../common/Badge';
import { Radio, RefreshCw, Sun, Moon, Database, Shield } from 'lucide-react';

interface TopStatusBarProps {
  state: CyberDefenseState;
  playbackMode: PlaybackMode;
  currentStageIndex: number;
  totalStages: number;
  dataSource: DataSourceMode;
  onToggleDataSource: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onToggleReplayDrawer?: () => void;
  isReplayOpen: boolean;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  state,
  playbackMode,
  currentStageIndex,
  dataSource,
  onToggleDataSource,
  isDarkMode,
  onToggleTheme,
  onToggleReplayDrawer,
  isReplayOpen
}) => {
  // Format human-readable timestamp
  const dateObj = new Date(state.timestamp);
  const timeFormatted = isNaN(dateObj.getTime())
    ? state.timestamp
    : dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="border-b border-[#E5E5EA] dark:border-[#222733] bg-white/80 dark:bg-[#12141A]/80 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Branding & Core Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 shadow-apple-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Predictive Cyber Defense
              </h1>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                M4
              </span>
            </div>
            <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 tracking-wide">
              NTRO • Network Intelligence
            </p>
          </div>
        </div>

        {/* Center: Live / Replay State Indicator */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
            {playbackMode === 'LIVE_STREAM' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold tracking-wider text-emerald-700 dark:text-emerald-400">
                  LIVE STREAM
                </span>
              </>
            ) : playbackMode === 'REPLAY' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold tracking-wider text-amber-700 dark:text-amber-400">
                  REPLAY ACTIVE (S{currentStageIndex + 1})
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-neutral-400" />
                <span className="text-xs font-medium tracking-wider text-neutral-600 dark:text-neutral-400">
                  DEMO TIMELINE (STAGE {currentStageIndex + 1}/6)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span className="text-neutral-400 dark:text-neutral-600">Time:</span>
            <span className="font-mono">{timeFormatted}</span>
          </div>

          <Badge status={state.network_status} size="md" />
        </div>

        {/* Right: Controls & Data Source */}
        <div className="flex items-center gap-2">
          {/* Data Source Pill */}
          <button
            onClick={onToggleDataSource}
            title={`Current Source: ${dataSource.toUpperCase()}. Click to toggle.`}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-[#E5E5EA] dark:border-[#262C38] bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-neutral-400" />
            <span className="capitalize">{dataSource} Data</span>
          </button>

          {/* Replay Drawer Toggle Button */}
          {onToggleReplayDrawer && (
            <button
              onClick={onToggleReplayDrawer}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                isReplayOpen
                  ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                  : 'bg-white dark:bg-[#151820] text-neutral-700 dark:text-neutral-300 border-[#E5E5EA] dark:border-[#262C38] hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Timeline / Replay</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle Theme"
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E5EA] dark:border-[#262C38] bg-white dark:bg-[#151820] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
