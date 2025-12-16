import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api';
const TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '10s', target: Number(__ENV.WARM_VUS || 20) },
    { duration: __ENV.HOLD || '60s', target: Number(__ENV.VUS || 50) },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const jobListTrend = new Trend('job_list_duration');
const jobStatsTrend = new Trend('job_stats_duration');

export default function () {
  const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  group('health', () => {
    const res = http.get(`${BASE_URL}/health/`);
    check(res, {
      'health 200': (r) => r.status === 200,
      'health <400ms': (r) => r.timings.duration < 400,
    });
  });

  if (TOKEN) {
    group('job list + stats', () => {
      const listRes = http.get(`${BASE_URL}/jobs?page_size=20`, { headers: authHeaders });
      jobListTrend.add(listRes.timings.duration);
      check(listRes, {
        'jobs 200': (r) => r.status === 200,
        'jobs cached/fast': (r) => r.timings.duration < 500,
      });

      const statsRes = http.get(`${BASE_URL}/jobs/stats`, { headers: authHeaders });
      jobStatsTrend.add(statsRes.timings.duration);
      check(statsRes, {
        'stats 200': (r) => r.status === 200,
        'stats <500ms': (r) => r.timings.duration < 500,
      });
    });
  }

  sleep(1);
}
