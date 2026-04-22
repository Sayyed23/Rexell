import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export function detectionPayload() {
  const events = [];
  const start = Date.now();
  for (let i = 0; i < 50; i++) {
    events.push({
      type: 'mousemove',
      timestamp: start + i * 50,
      x: randomIntBetween(0, 1000),
      y: randomIntBetween(0, 800)
    });
  }
  events.push({
    type: 'click',
    timestamp: start + 3000,
    x: randomIntBetween(0, 1000),
    y: randomIntBetween(0, 800)
  });
  return {
    behavioralData: {
      sessionId: randomString(12),
      walletAddress: `0x${randomString(40, '0123456789abcdef')}`,
      userAgent: 'k6/loadtest',
      ipAddress: '10.0.0.1',
      events
    },
    context: {
      accountAgeDays: 30,
      transactionCount: 5,
      isBulkPurchase: false,
      requestedQuantity: 1
    }
  };
}
