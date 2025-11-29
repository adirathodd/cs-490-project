/**
 * Tests for src/reportWebVitals.js
 * - Calls dynamic import('web-vitals') and forwards onPerfEntry to all metrics
 * - Skips importing when argument is not a function (no metric calls)
 */

const calls = [];

jest.mock('web-vitals', () => ({
  __esModule: true,
  getCLS: (cb) => { calls.push(['CLS']); cb && cb('CLS'); },
  getFID: (cb) => { calls.push(['FID']); cb && cb('FID'); },
  getFCP: (cb) => { calls.push(['FCP']); cb && cb('FCP'); },
  getLCP: (cb) => { calls.push(['LCP']); cb && cb('LCP'); },
  getTTFB: (cb) => { calls.push(['TTFB']); cb && cb('TTFB'); },
}));

describe('reportWebVitals', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    calls.length = 0;
  });

  it('imports web-vitals and passes callback to all metrics', async () => {
    const onPerfEntry = jest.fn();

    const reportWebVitals = (await import('./reportWebVitals')).default;
    reportWebVitals(onPerfEntry);

    // allow dynamic import .then() to run (tick the event loop)
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toEqual([
      ['CLS'],
      ['FID'],
      ['FCP'],
      ['LCP'],
      ['TTFB'],
    ]);
    expect(onPerfEntry).toHaveBeenCalled();
  });

  it('does nothing when onPerfEntry is not a function (no metric calls)', async () => {
    const reportWebVitals = (await import('./reportWebVitals')).default;
    reportWebVitals(true);

    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([]);
  });
});
