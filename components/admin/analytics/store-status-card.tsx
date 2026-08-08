import { Database01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsStoreStatus } from "@/lib/analytics";

/**
 * States plainly which `AnalyticsStore` implementation is active (D7), so
 * a memory-store deploy (a serverless filesystem is typically read-only,
 * T10) shows "resets on cold start" instead of quietly recording nothing
 * and leaving a human to wonder why the dashboard is empty.
 */
export function StoreStatusCard({ status }: { status: AnalyticsStoreStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <HugeiconsIcon icon={Database01Icon} strokeWidth={2} className="size-4" />
          Store
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Badge variant={status.kind === "file" ? "secondary" : "destructive"} className="capitalize">
          {status.kind}
        </Badge>
        <p className="text-sm text-muted-foreground">{status.message}</p>
      </CardContent>
    </Card>
  );
}
