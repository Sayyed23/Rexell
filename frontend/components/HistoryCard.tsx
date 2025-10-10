import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";

interface HistoryRecord {
  owner: string;
  timestamp: string;
  isCurrent?: boolean;
}

interface HistoryCardProps {
  tokenId: number;
  history: HistoryRecord[];
}

export default function HistoryCard({ tokenId, history }: HistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">Ownership History</CardTitle>
            <CardDescription>
              Complete history for ticket #{tokenId}
            </CardDescription>
          </div>
          <Badge variant="secondary">Resale</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No ownership history available for this ticket
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((record, index) => (
              <div 
                key={index} 
                className={`flex items-start p-3 rounded-lg ${
                  record.isCurrent ? "bg-blue-50 border border-blue-200" : ""
                }`}
              >
                <div className="flex flex-col items-center mr-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index === 0 
                      ? "bg-green-500 text-white" 
                      : record.isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-300 text-gray-700"
                  }`}>
                    {index + 1}
                  </div>
                  {index < history.length - 1 && (
                    <div className="h-full w-0.5 bg-gray-300 my-1"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    {index === 0 
                      ? "Original Owner" 
                      : record.isCurrent
                      ? "Current Owner"
                      : `Owner #${index + 1}`}
                  </div>
                  <div className="text-sm text-gray-600 font-mono">
                    {shortenAddress(record.owner)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(record.timestamp).toLocaleDateString()} at {new Date(record.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}