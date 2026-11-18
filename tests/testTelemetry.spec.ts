import test from 'tape';
import {
  clearTelemetry,
  getTelemetrySnapshot,
  trackFeatureUsage,
  trackTiming,
} from '../src/utils/telemetry';

test('telemetry tracks feature usage and operation timings without PII', (t) => {
  clearTelemetry();
  trackFeatureUsage('POS');
  trackFeatureUsage('POS');
  trackFeatureUsage('CustomReportBuilder');

  trackTiming('dbOpen', 120);
  trackTiming('dbOpen', 300);

  const snap = getTelemetrySnapshot();
  t.equal(snap.features.POS, 2, 'counts POS usage');
  t.equal(snap.features.CustomReportBuilder, 1, 'counts CustomReportBuilder');
  t.equal(snap.timings.dbOpen.count, 2, 'tracks timing count');
  t.equal(snap.timings.dbOpen.totalMs, 420, 'tracks totalMs');
  t.equal(snap.timings.dbOpen.maxMs, 300, 'tracks maxMs');
  t.end();
});
