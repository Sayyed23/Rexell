import http from 'k6/http';
import { check } from 'k6';
import { detectionPayload } from './lib/payload.js';

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 150,
      timeUnit: '1s',
      duration: '4h',
      preAllocatedVUs: 250,
      maxVUs: 500
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
