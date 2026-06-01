# Load Testing Scripts

Scenarios covered (Task 28.1):

| Script              | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `normal.js`         | 50 req/s sustained for 1 hour              |
| `peak.js`           | 200 req/s sustained for 15 minutes         |
| `spike.js`          | 0 → 500 req/s ramp, then 10 seconds peak   |
| `sustained.js`      | 150 req/s for 4 hours                      |

Thresholds applied to every scenario (in the shared `options.thresholds`):

- `http_req_duration{scenario:default}` p99 < 300ms
- `http_req_failed` error rate < 0.1%

Run with:

```
k6 run normal.js -e API_URL=https://detection.example/api -e API_KEY=...
```
