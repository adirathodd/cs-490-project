import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api';
const TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
};

export default function () {
  const params = {
    headers: {
      Authorization: TOKEN ? `Bearer ${TOKEN}` : '',
    },
  };

  const res = http.get(`${BASE_URL}/jobs?paginate=false`, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response under 1.2s': (r) => r.timings.duration < 1200,
  });

  sleep(1);
}
