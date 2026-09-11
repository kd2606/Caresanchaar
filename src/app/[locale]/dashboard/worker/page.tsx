"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  ClipboardCheck, 
  AlertTriangle, 
  CloudOff,
  CloudLightning,
  ClipboardPlus,
  Send,
  Clock,
  ArrowRight,
  CheckCircle2,
  Inbox
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/firebase/auth/useUser";
import { useTranslations } from "next-intl";

export default function WorkerDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || "en";
  const { user } = useUser();
  const t = useTranslations("worker.dashboard");

  const [stats, setStats] = useState({
    assigned: 0,
    todayVisits: 0,
    referrals: 0,
    unsynced: 0
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  useEffect(() => {
    // In a production environment, this would fetch from Firestore/IndexedDB
    // For now, representing an authentic zero-state for a newly logged-in worker.
    setStats({
      assigned: 0,
      todayVisits: 0,
      referrals: 0,
      unsynced: 0
    });
    setActivities([]);
    setLoading(false);
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {t('goodMorning')}, {user?.displayName ? user.displayName.split(' ')[0] : t('healthWorker')}
        </h1>
        <p className="text-muted-foreground">{today}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('assignedFamilies')}</CardTitle>
            <Users className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-secondary animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-white">{stats.assigned}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('noAssignedFamilies')}</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('todaysVisits')}</CardTitle>
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-secondary animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-white">{stats.todayVisits}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('zeroRemainingToday')}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('pendingReferrals')}</CardTitle>
            {stats.referrals > 0 ? (
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-secondary animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-white">{stats.referrals}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.referrals > 0 ? t('requiresFollowUp') : t('allCaughtUp')}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={stats.unsynced > 0 ? "bg-card border-red-900/50 shadow-sm" : "bg-card border-border shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('unsyncedRecords')}</CardTitle>
            {stats.unsynced > 0 ? (
              <CloudOff className="w-4 h-4 text-red-400" />
            ) : (
              <CloudLightning className="w-4 h-4 text-blue-400" />
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-secondary animate-pulse rounded" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${stats.unsynced > 0 ? 'text-red-400' : 'text-white'}`}>
                  {stats.unsynced}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.unsynced > 0 ? t('tapSyncToUpload') : t('allDataSynced')}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-muted-foreground">{t('quickActions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card 
            className="bg-emerald-600/10 border-emerald-500/30 hover:bg-emerald-600/20 transition-colors cursor-pointer shadow-sm group min-h-[100px]" 
            onClick={() => router.push(`/${locale}/dashboard/worker/intake`)}
          >
            <CardContent className="p-6 flex items-center justify-between h-full">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-600 p-3 rounded-xl shadow-inner group-hover:scale-105 transition-transform">
                  <ClipboardPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{t('startNewIntake')}</h3>
                  <p className="text-sm text-blue-200">{t('recordNewPatientScreening')}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="bg-card border-border hover:bg-secondary transition-colors cursor-pointer shadow-sm group min-h-[100px]" 
            onClick={() => router.push(`/${locale}/dashboard/worker/referrals`)}
          >
            <CardContent className="p-6 flex items-center justify-between h-full">
              <div className="flex items-center gap-4">
                <div className="bg-secondary p-3 rounded-xl shadow-inner group-hover:scale-105 transition-transform">
                  <Send className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{t('viewReferrals')}</h3>
                  <p className="text-sm text-muted-foreground">{t('trackReferredPatients')}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-muted-foreground">{t('recentActivity')}</h2>
          {activities.length > 0 && (
            <Button variant="link" className="text-blue-400 p-0 h-auto min-h-[44px]">{t('viewAll')}</Button>
          )}
        </div>
        <Card className="bg-card border-border">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activities.length > 0 ? (
            <div className="divide-y divide-border">
              {activities.map((activity, i) => (
                <div key={i} className="p-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
                  <div className="bg-secondary p-2 rounded-full">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="bg-secondary/50 p-4 rounded-full mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-muted-foreground">{t('noRecentActivity')}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {t('recentActivityDesc')}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
