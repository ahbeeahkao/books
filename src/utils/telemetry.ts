export interface TimingStats {
  count: number;
  totalMs: number;
  maxMs: number;
}

export interface TelemetryErrorEntry {
  timestamp: string;
  source: string;
  message: string;
}

export interface TelemetrySnapshot {
  features: Record<string, number>;
  timings: Record<string, TimingStats>;
  recentErrors: TelemetryErrorEntry[];
  environment: {
    platform: string;
    screen: string;
  };
}

const features: Record<string, number> = {};
const timings: Record<string, TimingStats> = {};
const recentErrors: TelemetryErrorEntry[] = [];
const MAX_RECENT_ERRORS = 50;

export function trackFeatureUsage(feature: string): void {
  if (!feature) {
    return;
  }
  features[feature] = (features[feature] ?? 0) + 1;
}

export function trackTiming(operation: string, durationMs: number): void {
  if (!operation || !Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }
  const current = timings[operation] ?? { count: 0, totalMs: 0, maxMs: 0 };
  current.count += 1;
  current.totalMs += durationMs;
  if (durationMs > current.maxMs) {
    current.maxMs = durationMs;
  }
  timings[operation] = current;
}

export function trackError(source: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');
  recentErrors.push({
    timestamp: new Date().toISOString(),
    source,
    message: message.slice(0, 500),
  });
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.shift();
  }
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  const platform =
    typeof navigator !== 'undefined' ? navigator.platform : 'node';
  const screen =
    typeof window !== 'undefined' && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : 'unknown';

  return {
    features: { ...features },
    timings: { ...timings },
    recentErrors: [...recentErrors],
    environment: { platform, screen },
  };
}

export function clearTelemetry(): void {
  for (const k of Object.keys(features)) {
    delete features[k];
  }
  for (const k of Object.keys(timings)) {
    delete timings[k];
  }
  recentErrors.length = 0;
}
