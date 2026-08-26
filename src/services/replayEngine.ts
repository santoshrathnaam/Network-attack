import { DEMO_STAGES } from '../mock/mockDataset';
import { cyberDefenseApi } from './cyberDefenseApi';
import { createLiveTrafficTick } from '../mock/networkTrafficGenerator';

export type PlaybackMode = 'LIVE_STREAM' | 'REPLAY' | 'PAUSED';

class ReplayEngine {
  private currentStageIndex: number = 3; // Default to Stage 4 (Attack Imminent)
  private playbackMode: PlaybackMode = 'PAUSED';
  private playbackSpeed: number = 1.0; // 0.5x, 1x, 2x
  private timerId: number | null = null;
  private liveTickTimerId: number | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initStage(this.currentStageIndex);
  }

  public getStages() {
    return DEMO_STAGES;
  }

  public getCurrentStageIndex(): number {
    return this.currentStageIndex;
  }

  public getCurrentStage() {
    return DEMO_STAGES[this.currentStageIndex];
  }

  public getPlaybackMode(): PlaybackMode {
    return this.playbackMode;
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
    this.notify();
    if (this.playbackMode === 'REPLAY') {
      this.restartReplayTimer();
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public initStage(index: number) {
    if (index >= 0 && index < DEMO_STAGES.length) {
      this.currentStageIndex = index;
      cyberDefenseApi.loadStage(index);
      this.notify();
    }
  }

  public jumpToStage(index: number) {
    this.initStage(index);
  }

  public nextStage(): boolean {
    if (this.currentStageIndex < DEMO_STAGES.length - 1) {
      this.jumpToStage(this.currentStageIndex + 1);
      return true;
    }
    return false;
  }

  public previousStage(): boolean {
    if (this.currentStageIndex > 0) {
      this.jumpToStage(this.currentStageIndex - 1);
      return true;
    }
    return false;
  }

  public startReplay(fromStart: boolean = false) {
    this.stopLiveStream();
    if (fromStart) {
      this.currentStageIndex = 0;
      this.jumpToStage(0);
    }
    this.playbackMode = 'REPLAY';
    this.restartReplayTimer();
    this.notify();
  }

  public pause() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.playbackMode = 'PAUSED';
    this.notify();
  }

  public reset() {
    this.pause();
    this.jumpToStage(3); // Reset to primary critical scenario (Stage 4)
  }

  public startLiveStream() {
    this.pause();
    this.playbackMode = 'LIVE_STREAM';
    this.startLiveTick();
    this.notify();
  }

  public stopLiveStream() {
    if (this.liveTickTimerId) {
      window.clearInterval(this.liveTickTimerId);
      this.liveTickTimerId = null;
    }
  }

  private restartReplayTimer() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
    }
    // Base stage duration 5 seconds at 1x
    const intervalMs = Math.max(1200, 5000 / this.playbackSpeed);
    this.timerId = window.setInterval(() => {
      const hasNext = this.nextStage();
      if (!hasNext) {
        this.pause();
      }
    }, intervalMs);
  }

  private startLiveTick() {
    this.stopLiveStream();
    this.liveTickTimerId = window.setInterval(async () => {
      const currentState = await cyberDefenseApi.getCurrentState();
      const { nextState } = createLiveTrafficTick(currentState);
      cyberDefenseApi.updateState(nextState);
    }, 2500);
  }
}

export const replayEngine = new ReplayEngine();
