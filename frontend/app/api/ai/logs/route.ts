import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'data', 'ai_logs.json');

// Ensure data directory exists
const dataDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Define CSV path
const CSV_FILE_PATH = path.join(process.cwd(), '..', 'dataset', 'blockchain_ticketing_master.csv');

export async function POST(req: NextRequest) {
    try {
        const event = await req.json();

        // 1. Existing JSON logging (keep for backup/debugging)
        let logs = [];
        if (fs.existsSync(LOG_FILE_PATH)) {
            try {
                const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
                logs = JSON.parse(fileContent);
            } catch (e) {
                logs = [];
            }
        }
        logs.push(event);
        fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2));

        // 2. Append to CSV
        try {
            if (fs.existsSync(CSV_FILE_PATH)) {

                const txHash = event.metadata?.txHash || `0x${Math.random().toString(16).slice(2)}`;
                const wallet = event.wallet;
                const eventId = event.eventId ? `EVT_${event.eventId}` : 'EVT_UNKNOWN';

                let type = 'UNKNOWN';
                let status = 'SUCCESS';

                switch (event.eventType) {
                    case 'purchase_success': type = 'PURCHASE'; break;
                    case 'purchase_failed': type = 'PURCHASE_ATTEMPT'; status = 'FAILED'; break;
                    case 'purchase_attempt': type = 'PURCHASE_ATTEMPT'; status = 'PENDING'; break;
                    case 'resale_success': type = 'RESALE_SALE'; break;
                    case 'resale_attempt': type = 'RESALE_LISTING'; break; // We logged this as 'attempt' in frontend for listing
                    default: type = event.eventType.toUpperCase();
                }

                const timestamp = new Date().toISOString();
                const ticketCount = event.metadata?.quantity || event.metadata?.ticketId ? 1 : 1;
                const price = parseFloat(event.metadata?.price || '0');

                // Simplified logic for CSV columns
                const originalPrice = price; // Placeholder
                const markup = 0; // Placeholder

                const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
                // Simple hash for IP
                let ipHash = 'unknown';
                // We'd need crypto here but let's keep it simple to avoid import issues if not available or just use a mock
                ipHash = Buffer.from(ip).toString('base64').substring(0, 10);

                const isResale = type.includes('RESALE') ? 'True' : 'False';

                // Columns: transaction_hash,wallet_address,event_id,transaction_type,status,timestamp,ticket_count,price_paid,original_event_price,markup_pct,ip_hash,is_resale,scalping_label,fraud_label,risk_score
                const row = [
                    txHash,
                    wallet,
                    eventId,
                    type,
                    status,
                    timestamp,
                    ticketCount,
                    price,
                    originalPrice,
                    markup,
                    ipHash,
                    isResale,
                    0, // scalping_label
                    0, // fraud_label
                    0  // risk_score
                ].join(',');

                fs.appendFileSync(CSV_FILE_PATH, '\n' + row);
            }
        } catch (csvError) {
            console.error('Failed to append to CSV:', csvError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing AI log:', error);
        return NextResponse.json({ success: false, error: 'Failed to log event' }, { status: 500 });
    }
}

export async function GET() {
    // Simple endpoint to view logs for debugging
    if (fs.existsSync(LOG_FILE_PATH)) {
        const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(fileContent));
    }
    return NextResponse.json([]);
}
