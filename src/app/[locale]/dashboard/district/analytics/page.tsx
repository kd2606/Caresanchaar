'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/firebase/clientApp';
import { Activity, Clock, FileText, Calendar, CheckCircle, AlertTriangle, TrendingUp, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useTranslations } from 'next-intl';

export default function AnalyticsPage() {
  const t = useTranslations('district');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
     const d = new Date();
     d.setDate(d.getDate() - 30);
     return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedFacility, setSelectedFacility] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
         // Fallback if not loaded yet, let auth observer handle it in a real app
         throw new Error("Not authenticated");
      }
      const token = await user.getIdToken();
      
      const startMs = new Date(startDate).getTime();
      // end date should be end of day
      const endMs = new Date(endDate).getTime() + 86399999; 

      let url = `/api/analytics/district?startDate=${startMs}&endDate=${endMs}`;
      if (selectedFacility) {
        url += `&facilityId=${selectedFacility}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
         let errMessage = 'Failed to fetch analytics';
         const contentType = res.headers.get('content-type');
         if (contentType && contentType.includes('application/json')) {
            const err = await res.json();
            errMessage = err.error || errMessage;
         } else {
            errMessage = `Server Error (${res.status})`;
         }
         throw new Error(errMessage);
      }

      const json = await res.json();
      setData(json.metrics);
      setFacilities(json.facilities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch when auth is ready
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user) {
        fetchAnalytics();
      } else {
        setLoading(false);
        setError("Please sign in to view analytics.");
      }
    });
    return () => unsubscribe();
  }, [startDate, endDate, selectedFacility]);

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
           <AlertTriangle className="size-5" />
           {error}
        </div>
        <Button className="mt-4" onClick={() => window.location.reload()}>{t("analytics.retry")}</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-xl shadow-sm border border-border">
          <input 
            type="date" 
            className="text-sm border-none bg-slate-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">{t("analytics.to")}</span>
          <input 
            type="date" 
            className="text-sm border-none bg-slate-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
          <select 
            className="text-sm border-none bg-slate-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedFacility}
            onChange={e => setSelectedFacility(e.target.value)}
          >
            <option value="">{t("analytics.allFacilities")}</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Activity className="size-8 animate-spin text-blue-500 mr-3" />
          {t("analytics.loading")}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t("analytics.totalReferrals")}</p>
                    <h3 className="text-3xl font-bold text-foreground">{data.totalReferrals}</h3>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg"><Activity className="size-5 text-blue-600"/></div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t("analytics.pendingReferrals")}</p>
                    <h3 className="text-3xl font-bold text-amber-600">{data.pendingReferrals}</h3>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg"><Clock className="size-5 text-amber-600"/></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t("analytics.avgTurnaround")}</p>
                    <h3 className="text-3xl font-bold text-foreground">
                      {data.averageTurnaroundHours > 0 ? `${data.averageTurnaroundHours.toFixed(1)} hrs` : '--'}
                    </h3>
                    {data.missingSlaData > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">{t('analytics.missingSla', { count: data.missingSlaData })}</p>
                    )}
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg"><CheckCircle className="size-5 text-emerald-600"/></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t("analytics.overdueFollowUps")}</p>
                    <h3 className="text-3xl font-bold text-red-600">{data.overdueFollowUps}</h3>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg"><AlertTriangle className="size-5 text-red-600"/></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-semibold text-foreground">{t("analytics.triageDistribution")}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"/> <span className="text-sm font-medium text-muted-foreground">{t("analytics.red")}</span></div>
                    <span className="font-semibold">{data.triageCounts?.RED || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"/> <span className="text-sm font-medium text-muted-foreground">{t("analytics.yellow")}</span></div>
                    <span className="font-semibold">{data.triageCounts?.YELLOW || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"/> <span className="text-sm font-medium text-muted-foreground">{t("analytics.green")}</span></div>
                    <span className="font-semibold">{data.triageCounts?.GREEN || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-semibold text-foreground">{t("analytics.workloadSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
                      <span>{t("analytics.appointmentsCompleted")}</span>
                      <span>{data.appointments.completed} / {data.appointments.total}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: data.appointments.total > 0 ? `${(data.appointments.completed / data.appointments.total) * 100}%` : '0%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
                      <span>{t("analytics.followUpsCompleted")}</span>
                      <span>{data.followUps.completed} / {data.followUps.total}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: data.followUps.total > 0 ? `${(data.followUps.completed / data.followUps.total) * 100}%` : '0%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold text-foreground">{t("analytics.referralTrend")}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {data.trend && data.trend.length > 0 ? (
                 <div className="flex items-end gap-2 h-40 pt-4">
                   {data.trend.map((t: any) => {
                      const max = Math.max(...data.trend.map((x: any) => x.count), 1);
                      const height = (t.count / max) * 100;
                      return (
                        <div key={t.date} className="flex-1 flex flex-col justify-end group relative">
                          <div 
                            className="bg-blue-200 hover:bg-blue-400 rounded-t-sm transition-all w-full"
                            style={{ height: `${height}%`, minHeight: '4px' }}
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                            {t.date}: {t.count}
                          </div>
                        </div>
                      )
                   })}
                 </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {t("analytics.noTrendData")}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-col justify-center items-center h-64 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
          <FileText className="size-12 text-muted-foreground mb-4" />
          <p>{t("analytics.noData")}</p>
        </div>
      )}
    </div>
  );
}
