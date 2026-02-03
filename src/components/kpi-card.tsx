import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: number;
  trendLabel?: string;
}

export function KpiCard({ title, value, icon: Icon, description, trend, trendLabel }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{String(value)}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        
        {typeof trend === 'number' && (
           <div className="flex items-center mt-4 text-xs">
              {trend > 0 ? (
                <span className="text-destructive flex items-center font-medium">
                  <ArrowUpIcon className="mr-1 h-3 w-3" /> +{trend}
                </span>
              ) : trend < 0 ? (
                 <span className="text-emerald-500 flex items-center font-medium">
                  <ArrowDownIcon className="mr-1 h-3 w-3" /> {trend}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center font-medium">
                   <MinusIcon className="mr-1 h-3 w-3" /> 0
                </span>
              )}
              <span className="text-muted-foreground ml-2">
                {trendLabel || "since last bi-weekly"}
              </span>
           </div>
        )}
      </CardContent>
    </Card>
  );
}