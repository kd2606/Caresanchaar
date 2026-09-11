import { Clock, Map } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { useTranslations } from "next-intl";

export default function FacilitiesPage() {
  const t = useTranslations("district");
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <h1 className="text-2xl font-bold text-foreground">{t("dashboard.facilities")}</h1>
      
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-blue-600" />
            Feature Planned
          </CardTitle>
          <CardDescription>
            Geospatial view of all PHCs and CHCs in the district is scheduled for an upcoming release.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-foreground">
          <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <Map className="size-4 text-muted-foreground" />
              Current Status
            </p>
            <p className="text-muted-foreground">{t("roadmap.facilitiesStatus")}</p>
          </div>
          <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
            <p className="font-semibold text-muted-foreground">{t("roadmap.plannedNextStep")}:</p>
            <p className="text-muted-foreground">{t("roadmap.facilitiesNext")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
