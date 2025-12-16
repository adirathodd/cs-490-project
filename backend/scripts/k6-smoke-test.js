import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    errors: ['rate<0.1'], // Error rate should be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api';

// Helper function to make authenticated requests (if needed)
function getHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

export default function () {
  // Test 1: Health check endpoint
  let healthRes = http.get(`${BASE_URL}/health/`, {
    headers: getHeaders(),
    tags: { name: 'health_check' },
  });
  
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 2: API root endpoint
  let rootRes = http.get(`${BASE_URL}/`, {
    headers: getHeaders(),
    tags: { name: 'api_root' },
  });
  
  check(rootRes, {
    'api root status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 3: Public endpoints (market data, salary benchmarks if available)
  let marketRes = http.get(`${BASE_URL}/market/overview/`, {
    headers: getHeaders(),
    tags: { name: 'market_overview' },
  });
  
  check(marketRes, {
    'market overview returns valid response': (r) => r.status === 200 || r.status === 401 || r.status === 404,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 4: Salary benchmarks endpoint
  let salaryRes = http.get(`${BASE_URL}/salary/benchmarks/?title=Software%20Engineer&location=New%20York`, {
    headers: getHeaders(),
    tags: { name: 'salary_benchmarks' },
  });
  
  check(salaryRes, {
    'salary benchmarks returns valid response': (r) => r.status === 200 || r.status === 401 || r.status === 404,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 5: Auth endpoints (login page availability)
  let authRes = http.options(`${BASE_URL}/auth/login/`, {
    headers: getHeaders(),
    tags: { name: 'auth_options' },
  });
  
  check(authRes, {
    'auth endpoint accessible': (r) => r.status === 200 || r.status === 204 || r.status === 405,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  
  let output = '\n========== K6 SMOKE TEST SUMMARY ==========\n\n';
  
  // Request metrics
  if (metrics.http_reqs) {
    output += `Total Requests: ${metrics.http_reqs.values.count}\n`;
    output += `Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  }
  
  // Duration metrics
  if (metrics.http_req_duration) {
    output += `\nResponse Times:\n`;
    output += `  Average: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    output += `  Min: ${metrics.http_req_duration.values.min.toFixed(2)}ms\n`;
    output += `  Max: ${metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
    output += `  p90: ${metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
    output += `  p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  // Error rate
  if (metrics.errors) {
    output += `\nError Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  }
  
  // Failed checks
  if (metrics.checks) {
    const passRate = (metrics.checks.values.passes / (metrics.checks.values.passes + metrics.checks.values.fails) * 100).toFixed(2);
    output += `Check Pass Rate: ${passRate}%\n`;
  }
  
  output += '\n============================================\n';
  
  return output;
}
