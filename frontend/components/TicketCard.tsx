import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface TicketCardProps {
  tokenId: number;
  eventId: number;
  price: number;
  isResale?: boolean;
  isListed?: boolean;
  onBuy?: () => void;
  onList?: () => void;
}

export default function TicketCard({
  tokenId,
  eventId,
  price,
  isResale = false,
  isListed = false,
  onBuy,
  onList
}: TicketCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48 flex items-center justify-center">
          <span className="text-gray-500">Ticket Image</span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg">Ticket #{tokenId}</CardTitle>
          {isResale ? (
            <Badge variant="secondary">Resale</Badge>
          ) : isListed ? (
            <Badge variant="default">Listed</Badge>
          ) : null}
        </div>
        <CardDescription className="mb-4">
          Event ID: {eventId}
        </CardDescription>
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold">{price.toFixed(2)} cUSD</div>
          {isResale ? (
            <Button asChild size="sm">
              <Link href={`/buy/${tokenId}`}>Buy Now</Link>
            </Button>
          ) : isListed ? (
            <Button variant="outline" size="sm" disabled>
              Listed
            </Button>
          ) : (
            <Button size="sm" onClick={onList}>
              List for Resale
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}