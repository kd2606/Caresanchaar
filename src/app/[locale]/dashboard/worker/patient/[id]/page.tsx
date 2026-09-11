"use client";
import { useTranslations } from "next-intl";

import { use, useEffect, useState } from 'react';
import { auth } from '@/firebase/clientApp';
import { Activity, Clock, ShieldCheck, UserCircle, ActivitySquare, Pill, ChevronLeft, MapPin, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { SyncStatusBar } from '@/components/sync-status-bar';

export default function WorkerPatientTimelinePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
  const t = useTranslations("worker.patientTimeline");
  const { locale, id: patientId } = use(params);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/patient/timeline?patientId=${patientId}`, {
           headers: { 'Authorization': `Bearer ${token}` }
        });

        const json = await res.json();
        if (!res.ok) {
           throw new Error(json.error || 'Failed to fetch timeline');
        }

        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user) fetchTimeline();
      else {
         setLoading(false);
         setError('You must be logged in.');
      }
    });
    return () => unsubscribe();
  }, [patientId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
       <Activity className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
       <p className="text-muted-foreground font-medium">{t("loadingRecord")}</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center">
       <div className="max-w-md w-full bg-card rounded-2xl shadow-sm border border-red-500/20 p-8 text-center mt-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t("accessDenied")}</h2>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <button 
            onClick={() => router.back()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-500"
          >
            Go Back
          </button>
       </div>
    </div>
  );

  if (!data) return null;

  const { patient, consentStatus, accessPurpose, timeline } = data;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'REFERRAL': return <ActivitySquare className="w-5 h-5 text-indigo-400" />;
      case 'TRIAGE': return <Activity className="w-5 h-5 text-orange-400" />;
      case 'APPOINTMENT': return <Clock className="w-5 h-5 text-blue-400" />;
      case 'FOLLOW_UP_RECORD': return <Pill className="w-5 h-5 text-emerald-400" />;
      case 'REFERRAL_EVENT': return <FileText className="w-5 h-5 text-muted-foreground" />;
      default: return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getEventTitle = (event: any) => {
    switch (event._type) {
      case 'REFERRAL': return `Referral ${event.status}`;
      case 'TRIAGE': return `Triage Generated (${event.risk_level})`;
      case 'APPOINTMENT': return `Appointment Scheduled (${event.queue_token || 'Token'})`;
      case 'FOLLOW_UP_RECORD': return `${event.follow_up_type || 'General'} Follow-up Logged`;
      case 'REFERRAL_EVENT': return `Audit: ${event.action}`;
      default: return 'Unknown Event';
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return 'Unknown time';
    const ms = ts._seconds ? ts._seconds * 1000 : (ts.toMillis ? ts.toMillis() : ts);
    if (typeof ms !== 'number') return 'Unknown time';
    return new Date(ms).toLocaleString('en-US', { 
       month: 'short', day: 'numeric', year: 'numeric', 
       hour: 'numeric', minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SyncStatusBar />
      
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <UserCircle className="w-6 h-6 text-muted-foreground" />
                {patient.name}
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span>{patient.age}y • {patient.gender}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {patient.village}</span>
                {patient.abha_id && patient.abha_id !== '[REDACTED]' && (
                  <>
                    <span>•</span>
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs border border-border text-muted-foreground">
                      ABHA: {patient.abha_id}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${consentStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
              <ShieldCheck className="w-4 h-4" />
              Consent: {consentStatus?.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
              {accessPurpose.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-secondary/30">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("longitudinalRecord")}</h2>
          </div>
          
          <div className="p-6">
            {timeline.length === 0 ? (
               <div className="text-center py-12 text-muted-foreground">
                  No records found for this patient.
               </div>
            ) : (
               <div className="relative border-l-2 border-border ml-4 space-y-8 pb-4">
                  {timeline.map((event: any, idx: number) => (
                    <div key={event.id || idx} className="relative pl-8">
                       <div className="absolute -left-[17px] top-1 bg-card p-1 rounded-full border border-border shadow-sm">
                          {getEventIcon(event._type)}
                       </div>
                       
                       <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-border transition-colors">
                          <div className="flex justify-between items-start mb-3">
                             <div>
                                <h3 className="font-semibold text-white">{getEventTitle(event)}</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                   {formatTime(event.created_at || event.timestamp || event.occurred_at)}
                                </p>
                             </div>
                             <span className="px-2.5 py-1 bg-secondary text-muted-foreground text-[10px] font-bold rounded-md uppercase tracking-wider">
                                {event._type.replace(/_/g, ' ')}
                             </span>
                          </div>

                          <div className="text-sm text-muted-foreground space-y-2 mt-4">
                             {event._type === 'TRIAGE' && (
                                <div className="bg-secondary/50 p-3 rounded-lg border border-border">
                                   <p><strong className="text-white">{t("symptoms")}</strong> {event.symptoms?.join(', ')}</p>
                                   <p className="mt-1"><strong className="text-white">{t("recommendation")}</strong> {event.recommendation}</p>
                                </div>
                             )}
                             {event._type === 'REFERRAL' && (
                                <div>
                                   <p>{t("targetFacility")} <span className="font-medium text-white">{event.target_facility || t("unassigned")}</span></p>
                                   <p>{t("careCategory")} <span className="font-medium text-white">{event.care_category}</span></p>
                                </div>
                             )}
                             {event._type === 'FOLLOW_UP_RECORD' && (
                                <div className="grid grid-cols-2 gap-4 bg-secondary/50 p-3 rounded-lg border border-border mt-2">
                                   <div>
                                      <p className="text-xs text-muted-foreground uppercase">{t("vitals")}</p>
                                      <p className="font-medium text-white">BP: {event.vitals?.systolic || '--'}/{event.vitals?.diastolic || '--'}</p>
                                   </div>
                                   <div>
                                      <p className="text-xs text-muted-foreground uppercase">{t("adherence")}</p>
                                      <p className="font-medium text-white">{event.adherence}</p>
                                   </div>
                                   {event.notes && (
                                      <div className="col-span-2 mt-1">
                                        <p className="text-xs text-muted-foreground uppercase">{t("notes")}</p>
                                        <p>{event.notes}</p>
                                      </div>
                                   )}
                                </div>
                             )}
                             {event._type === 'REFERRAL_EVENT' && (
                                <p className="text-muted-foreground italic">"{event.note || 'Status transitioned without explicit note.'}"</p>
                             )}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
