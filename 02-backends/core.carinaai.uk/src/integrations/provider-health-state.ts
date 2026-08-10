export type ProviderHealthState = 'healthy' | 'degraded' | 'unavailable' | 'recovering';

export class ProviderHealthTracker {
  private state: ProviderHealthState = 'unavailable';
  private failures = 0;

  getState(): ProviderHealthState {
    return this.state;
  }

  observe(input: { healthy: boolean; latencyMs?: number | null; degradedLatencyMs?: number }): ProviderHealthState {
    if (input.healthy) {
      this.failures = 0;
      this.state = input.latencyMs != null && input.latencyMs > (input.degradedLatencyMs ?? 1500) ? 'degraded' : this.state === 'unavailable' ? 'recovering' : 'healthy';
      if (this.state === 'recovering') this.state = 'healthy';
      return this.state;
    }
    this.failures += 1;
    this.state = this.failures >= 2 ? 'unavailable' : 'degraded';
    return this.state;
  }

  reset(): void {
    this.state = 'unavailable';
    this.failures = 0;
  }
}
