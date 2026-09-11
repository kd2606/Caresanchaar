"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function MedicalDisclaimer() {
    const t = useTranslations("disclaimer");

    return (
        <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("title")}</AlertTitle>
            <AlertDescription className="text-xs">{t("text")}</AlertDescription>
        </Alert>
    );
}
