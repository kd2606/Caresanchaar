"use client";
﻿import { useTranslations } from "next-intl";

import { use, useEffect, useState } from 'react';
import { db, auth } from '@/firebase/clientApp';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { Activity, Bell, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { SyncStatusBar } from '@/components/sync-status-bar';

interface Task {
  id: string;
  referral_id: string;
  type: string;
  status: string;
  note: string;
  created_at: any;
  resolution_note?: string;
}

export default function WorkerInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations("worker.inbox");
  const { locale } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [replyNote, setReplyNote] = useState('');
  // Structured Follow-up fields
  const [followUpType, setFollowUpType] = useState('GENERAL');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [adherence, setAdherence] = useState('UNKNOWN');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'worker_tasks'),
          where('worker_uid', '==', user.uid)
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        // Sort in memory to avoid needing a composite index immediately for demo
        loaded.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
        setTasks(loaded);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        toast.error('Could not load inbox. You might be offline.');
      } finally {
        setLoading(false);
      }
    };

    // Auth state observer ensures we only fetch when user is confirmed loaded
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user) fetchTasks();
      else setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolve = async () => {
    if (!activeTask) return;
    if (!replyNote.trim()) {
      toast.error('Please provide a note or visit summary before resolving.');
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const idempotencyKey = `${activeTask.id}_${Date.now()}`;

      const vitals = {
         systolic: systolic ? parseInt(systolic) : null,
         diastolic: diastolic ? parseInt(diastolic) : null,
      };

      const parsedSymptoms = symptoms.split(',').map(s => s.trim()).filter(Boolean);

      const res = await fetch('/api/worker/task/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: activeTask.id,
          referralId: activeTask.referral_id,
          followUpType,
          vitals,
          symptoms: parsedSymptoms,
          adherence,
          outcomeNotes: replyNote,
          idempotencyKey
        })
      });

      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to submit follow-up');
      }

      toast.success('Follow-up securely submitted and referred back to Medical Officer.');
      setTasks(tasks.map(t => t.id === activeTask.id ? { ...t, status: 'COMPLETED', resolution_note: replyNote } : t));
      setActiveTask(null);
      setReplyNote('');
      setSystolic('');
      setDiastolic('');
      setSymptoms('');
      setAdherence('UNKNOWN');
      setFollowUpType('GENERAL');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-background">
      <SyncStatusBar />

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
            <Bell className="w-6 h-6 text-emerald-400" /> Action Required Inbox
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow-up tasks and requests from Medical Officers.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="space-y-6">
            {pendingTasks.length === 0 && completedTasks.length === 0 ? (
               <div className="rounded-xl border border-border bg-card/50 p-12 text-center">
                 <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                 <h3 className="text-lg font-medium text-white">You're all caught up!</h3>
                 <p className="text-sm text-muted-foreground mt-1">No pending tasks or info requests.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Pending Tasks ({pendingTasks.length})</h2>
                  {pendingTasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-colors cursor-pointer ${activeTask?.id === task.id ? 'bg-secondary border-emerald-500/50' : 'bg-card border-border hover:border-border'}`}
                      onClick={() => { setActiveTask(task); setReplyNote(''); }}
                    >
                      <div className="flex justify-between items-start mb-2">
                         <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs font-semibold rounded-md uppercase">
                           Action Required
                         </span>
                         <span className="text-xs text-muted-foreground font-mono">#{task.referral_id.slice(0, 8)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{task.note}</p>
                      <div className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> From Medical Officer
                      </div>
                    </div>
                  ))}
                  {pendingTasks.length === 0 && <p className="text-sm text-muted-foreground">No pending tasks.</p>}

                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-8 mb-4">Completed ({completedTasks.length})</h2>
                  {completedTasks.map(task => (
                    <div key={task.id} className="p-4 rounded-xl bg-card/50 border border-border/50 opacity-70">
                      <div className="flex justify-between items-start mb-2">
                         <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-md uppercase">
                           Resolved
                         </span>
                         <span className="text-xs text-muted-foreground font-mono">#{task.referral_id.slice(0, 8)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-2">{task.note}</p>
                    </div>
                  ))}
                </div>

                <div className="md:pl-6">
                  {activeTask ? (
                    <div className="sticky top-24 bg-card rounded-2xl border border-border p-6 shadow-xl">
                      <div className="mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <ArrowRight className="w-5 h-5 text-emerald-400" /> Resolve Task
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">Ref ID: {activeTask.referral_id}</p>
                      </div>

                      <div className="bg-secondary/50 rounded-xl p-4 mb-6 border border-border/50">
                        <p className="text-sm text-muted-foreground font-medium mb-1">Medical Officer Note:</p>
                        <p className="text-muted-foreground">{activeTask.note}</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 border-t border-border bg-card/50 space-y-4">
                      {activeTask.type === 'FOLLOW_UP' && (
                        <div className="space-y-4 pb-4 mb-4 border-b border-border">
                           <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Follow-up Structured Data</h3>

                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Follow-up Type</label>
                                <select
                                  value={followUpType}
                                  onChange={e => setFollowUpType(e.target.value)}
                                  className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="GENERAL">General</option>
                                  <option value="MATERNAL">Maternal Health (ANC/PNC)</option>
                                  <option value="CHILD">Child Health (Immunization/Nutrition)</option>
                                  <option value="CHRONIC">NCD / Chronic Care (BP/Sugar)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Medication Adherence</label>
                                <select
                                  value={adherence}
                                  onChange={e => setAdherence(e.target.value)}
                                  className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="UNKNOWN">Unknown</option>
                                  <option value="GOOD">Good (Taking as prescribed)</option>
                                  <option value="POOR">Poor (Missing doses)</option>
                                  <option value="STOPPED">Stopped Completely</option>
                                </select>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Blood Pressure (Systolic)</label>
                                <input
                                  type="number"
                                  placeholder="120"
                                  value={systolic}
                                  onChange={e => setSystolic(e.target.value)}
                                  className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Blood Pressure (Diastolic)</label>
                                <input
                                  type="number"
                                  placeholder="80"
                                  value={diastolic}
                                  onChange={e => setDiastolic(e.target.value)}
                                  className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                           </div>

                           <div>
                             <label className="block text-xs text-muted-foreground mb-1">Current Symptoms (comma separated)</label>
                             <input
                               type="text"
                               placeholder={t("placeholder")}
                               value={symptoms}
                               onChange={e => setSymptoms(e.target.value)}
                               className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500"
                             />
                           </div>
                        </div>
                      )}

                      <textarea
                        rows={3}
                        placeholder={t("placeholder")}
                        className="w-full bg-secondary border-none rounded-lg px-4 py-3 text-sm text-foreground placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                        value={replyNote}
                        onChange={(e) => setReplyNote(e.target.value)}
                      />
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => { setActiveTask(null); setReplyNote(''); }}
                          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={!replyNote.trim() || submitting}
                          onClick={handleResolve}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
                        >
                          {submitting ? 'Submitting...' : 'Submit & Resolve'}
                        </button>
                      </div>
                    </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden md:flex h-full min-h-[300px] flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-8 text-center bg-card/30">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground font-medium">{t("noTasks")}</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
