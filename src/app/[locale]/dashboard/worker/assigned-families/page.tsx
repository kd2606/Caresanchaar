"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

export default function WorkerAssignedFamiliesPage() {
  const t = useTranslations("worker.dashboard");
  const [families, setFamilies] = useState<any[]>([]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t("assignedFamilies")}</h1>
        </div>

        <div className="relative w-full md:w-72">
          <Button className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Family
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by family head name or ID..."
            className="pl-9 bg-background border-border text-white placeholder:text-muted-foreground focus-visible:ring-emerald-500"
          />
        </div>
      </div>

      <Card className="bg-background border-border shadow-xl overflow-hidden min-h-[400px] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center p-12 text-center max-w-sm mx-auto">
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="bg-white/5 p-4 rounded-full mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t("noAssignedFamilies")}</h3>
          </div>
        </div>
      </Card>
    </div>
  );
}
