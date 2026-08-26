import {
  CyberDefenseState,
  DataSourceMode,
  EvidenceItem,
  ForecastData,
  InterventionAction,
  SimulationData,
  TrajectoryData
} from '../types/cyberDefense';
import { DEFAULT_STATE, DEMO_STAGES } from '../mock/mockDataset';

class CyberDefenseApiService {
  private dataSource: DataSourceMode = 'mock';
  private apiBaseUrl: string = 'http://localhost:8000/api/v1';
  private currentState: CyberDefenseState = DEFAULT_STATE;
  private subscribers: Set<(state: CyberDefenseState) => void> = new Set();

  constructor() {
    // Read optional environment override
    const envSource = import.meta.env.VITE_DATA_SOURCE as DataSourceMode | undefined;
    if (envSource === 'api' || envSource === 'mock') {
      this.dataSource = envSource;
    }
    const envApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (envApiUrl) {
      this.apiBaseUrl = envApiUrl;
    }
  }

  public getDataSource(): DataSourceMode {
    return this.dataSource;
  }

  public setDataSource(mode: DataSourceMode): void {
    this.dataSource = mode;
    this.notifySubscribers();
  }

  public setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  public subscribe(callback: (state: CyberDefenseState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentState);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public updateState(newState: CyberDefenseState): void {
    this.currentState = newState;
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.currentState));
  }

  /**
   * Fetches current network state.
   * If in API mode, queries the backend endpoint; otherwise returns mock state.
   */
  public async getCurrentState(): Promise<CyberDefenseState> {
    if (this.dataSource === 'api') {
      try {
        const res = await fetch(`${this.apiBaseUrl}/state`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.currentState = data;
        this.notifySubscribers();
        return data;
      } catch (err) {
        console.warn('[CyberDefenseApi] Failed to fetch live API state, falling back to mock:', err);
      }
    }
    return this.currentState;
  }

  public async getForecast(): Promise<ForecastData> {
    const state = await this.getCurrentState();
    return state.forecast;
  }

  public async getTrajectory(): Promise<TrajectoryData> {
    const state = await this.getCurrentState();
    return state.trajectory;
  }

  public async getEvidence(): Promise<EvidenceItem[]> {
    const state = await this.getCurrentState();
    return state.evidence;
  }

  /**
   * Evaluates counterfactual intervention simulation
   */
  public async simulateResponse(action: InterventionAction): Promise<SimulationData> {
    if (this.dataSource === 'api') {
      try {
        const res = await fetch(`${this.apiBaseUrl}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[CyberDefenseApi] Failed to call simulation API, using local model:', err);
      }
    }

    // Default simulation logic for mock state
    const currentScore = this.currentState.threat.score;
    let reduction = 0;
    if (action === 'BLOCK_SOURCES') {
      reduction = 0.55;
    } else if (action === 'ISOLATE_SERVER') {
      reduction = 0.73;
    }

    return {
      no_action: Math.min(0.98, currentScore * 1.07),
      block_sources: +(currentScore * 0.45).toFixed(2),
      isolate_server: +(currentScore * 0.27).toFixed(2),
      recommended_action: currentScore > 0.7 ? 'ISOLATE_SERVER' : 'BLOCK_SOURCES',
      risk_reduction: reduction
    };
  }

  public loadStage(stageIndex: number): CyberDefenseState {
    const stage = DEMO_STAGES[stageIndex] || DEMO_STAGES[0];
    this.currentState = JSON.parse(JSON.stringify(stage.state));
    this.notifySubscribers();
    return this.currentState;
  }
}

export const cyberDefenseApi = new CyberDefenseApiService();
