import http from 'k6/http';
import { check } from 'k6';
import { detectionPayload } from './lib/payload.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 1200,
      stages: [
        { target: 500, duration: '10s' },
        { target: 500, duration: '10s' },
        { target: 0, duration: '10s' }
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(99)<300'],
    http_req_failed: ['rate<0.001']
  }
};

export default function () {
  const res = http.post(
    `${__ENV.API_URL}/v1/detect`,
    JSON.stringify(detectionPayload()),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': __ENV.API_KEY
      }
    }
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
