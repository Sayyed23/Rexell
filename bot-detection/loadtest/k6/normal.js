import http from 'k6/http';
import { check, sleep } from 'k6';
import { detectionPayload } from './lib/payload.js';

export const options = {
  scenarios: {
    normal: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '1h',
      preAllocatedVUs: 100,
      maxVUs: 200
    }
  },
  thresholds: {
    http_req_duration: ['p(99)<300'],
    http_req_failed: ['rate<0.001']
  }
};

export default function () {
  const url = `${__ENV.API_URL}/v1/detect`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': __ENV.API_KEY
  };
  const res = http.post(url, JSON.stringify(detectionPayload()), { headers });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.1);
}
