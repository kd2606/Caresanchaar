'use client';

import { useState, useEffect } from 'react';
import { useAuthClaims } from '@/hooks/useAuthClaims';
import { useDistrictReferrals } from '@/hooks/useDistrictReferrals';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertOctagon, Activity, Users, ArrowUpRight, Clock, CheckCircle2,
  Search, Filter, Download, ScanLine, Camera, Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, onSnapshot, query, getDocs, doc, updateDoc, getDoc, where } from 'firebase/firestore';
import { db, auth } from '@/firebase/clientApp';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('@/components/qr/QrScanner'), { ssr: false });

// G��G��G�� Helpers G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

const TIER_COLORS: Record<string, string> = {
  'critical': 'bg-red-900/50 text-red-200 border-red-800',
  'high': 'bg-orange-900/50 text-orange-200 border-orange-800',
  'routine': 'bg-slate-800 text-slate-300 border-slate-700',
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  'pending': { label: 'In Transit / Pending', icon: ArrowUpRight, color: 'text-blue-400' },
  'acknowledged': { label: 'Acknowledged', icon: Clock, color: 'text-amber-400' },
  'in_transit': { label: 'In Transit', icon: ArrowUpRight, color: 'text-blue-400' },
  'admitted': { label: 'Admitted', icon: CheckCircle2, color: 'text-emerald-400' },
  'completed': { label: 'Closed / Treated', icon: CheckCircle2, color: 'text-emerald-400' },
  'cancelled': { label: 'Cancelled', icon: AlertOctagon, color: 'text-red-400' },
};

import { useParams } from 'next/navigation';
import { useTranslations } from "next-intl";

export default function DistrictDashboardPage() {
  const t = useTranslations("district");
  const { locale } = useParams();
  const [search, setSearch] = useState('');
  const { claims } = useAuthClaims();
  const { referrals: _liveReferrals, loading: hookLoading } = useDistrictReferrals(claims?.facilityId);
  const liveReferrals = _liveReferrals as any[];
  const [facilities, setFacilities] = useState<any[]>([]);
  const loading = hookLoading;
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanTab, setScanTab] = useState<'camera' | 'manual'>('camera');
  const [qrLookupResult, setQrLookupResult] = useState<any>(null);
  const [qrLookupLoading, setQrLookupLoading] = useState(false);
  
  const [assignRef, setAssignRef] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const [scheduleRef, setScheduleRef] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [scheduling, setScheduling] = useState(false);

  const [outcomeRef, setOutcomeRef] = useState<string | null>(null);
  const [outcomeDisposition, setOutcomeDisposition] = useState<string>('');
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [outcomeDueDate, setOutcomeDueDate] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  // G��G��G�� Live Data Fetching G��G��G��
  useEffect(() => {
    // Fetch facilities once
    const fetchFacilities = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch('/api/facility/list', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFacilities(data.facilities || []);
        }
      } catch(err) {
        console.error("Error fetching facilities", err);
      }
    };
    fetchFacilities();

    // Fetch replaced by hook
  }, []);

  const activeReferrals = liveReferrals.filter(r => r.status !== 'completed').length;
  const breachedCases = liveReferrals.filter(r => r.slaBreached && r.status !== 'completed').length;

  const [timelineRef, setTimelineRef] = useState<any | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const handleQrLookup = async (referralIdOrPayload: string) => {
    if (!referralIdOrPayload.trim()) return;
    setQrLookupLoading(true);
    setQrLookupResult(null);

    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const res = await fetch('/api/referral/qr-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ qrPayload: referralIdOrPayload }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned a non-JSON response');
      }

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Lookup failed');
        setQrLookupResult({ error: true, code: data.code, message: data.error });
        return;
      }

      setQrLookupResult(data.referral);
      toast.success('Referral found G�� resolved securely from server');
    } catch (error: any) {
      toast.error('Lookup error: ' + error.message);
      setQrLookupResult({ error: true, message: error.message });
    } finally {
      setQrLookupLoading(false);
    }
  };

  const handleQrScan = (referralId: string) => {
    handleQrLookup(`dv:ref:${referralId}`);
  };

  const handleManualScan = () => {
    handleQrLookup(scanInput);
  };

  const handleViewTimeline = async (fbId: string) => {
    setTimelineRef(fbId);
    setLoadingTimeline(true);
    try {
       const q = query(collection(db, 'referral_events'));
       // In a real app we would filter by `where('referral_id', '==', fbId)` but we need an index for that.
       // For demo, we just fetch all or filter client side.
       const snapshot = await getDocs(q);
       const events = snapshot.docs
         .map(d => d.data())
         .filter(d => d.referral_id === fbId)
         .sort((a, b) => b.occurred_at - a.occurred_at);
       setTimelineEvents(events);
    } catch(err) {
       console.error(err);
    } finally {
       setLoadingTimeline(false);
    }
  };

  const handleAssignFacility = async () => {
    if (!assignRef || !selectedFacility) return;
    setAssigning(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      
      const res = await fetch('/api/referral/assign-facility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          referralId: assignRef,
          facilityId: selectedFacility
        })
      });
      
      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to assign facility');
      }

      toast.success('Facility assigned successfully.');
      setAssignRef(null);
      setSelectedFacility('');
    } catch (error: any) {
      toast.error('Error assigning facility: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleScheduleAppt = async () => {
    if (!scheduleRef || !selectedService || !selectedDate || !selectedTime) return;
    setScheduling(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      
      const res = await fetch('/api/appointment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          referralId: scheduleRef,
          serviceId: selectedService,
          dateSlot: selectedDate,
          timeSlot: selectedTime,
          idempotencyKey: `${scheduleRef}_${selectedDate}_${selectedTime}` // basic idempotency
        })
      });
      
      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to schedule appointment');
      }

      toast.success('Appointment scheduled and token generated.');
      setScheduleRef(null);
      setSelectedService('');
      setSelectedDate('');
      setSelectedTime('');
    } catch (error: any) {
      toast.error('Error scheduling appointment: ' + error.message);
    } finally {
      setScheduling(false);
    }
  };

  const handleRecordOutcome = async () => {
    if (!outcomeRef || !outcomeDisposition) return;
    setSubmittingOutcome(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      
      const res = await fetch('/api/referral/outcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          referralId: outcomeRef,
          disposition: outcomeDisposition,
          notes: outcomeNotes,
          dueDate: outcomeDisposition === 'follow_up_required' ? outcomeDueDate : null
        })
      });
      
      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to record outcome');
      }

      toast.success('Consultation outcome recorded successfully.');
      setOutcomeRef(null);
      setOutcomeDisposition('');
      setOutcomeNotes('');
      setOutcomeDueDate('');
    } catch (error: any) {
      toast.error('Error recording outcome: ' + error.message);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleTransition = async (fbId: string, status: string, note: string = '') => {
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      
      const res = await fetch('/api/referral/transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          referralId: fbId,
          status,
          note
        })
      });
      
      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || `Failed to transition to ${status}`);
      }

      toast.success(`Referral updated to ${status}`);
    } catch (error: any) {
      toast.error(`Error: ` + error.message);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* G��G��G�� Scanner Modal G��G��G�� */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-card p-6 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2 text-foreground">Scan Referral QR</h3>
            <p className="text-sm text-slate-300 mb-4">Scan the ASHA worker&apos;s referral QR code or manually enter the Referral ID.</p>

            {/* Tabs */}
            <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-4">
              <button
                onClick={() => { setScanTab('camera'); setQrLookupResult(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
                  scanTab === 'camera' ? "bg-card text-blue-600 shadow-sm" : "text-slate-300 hover:text-slate-300"
                )}
              >
                <Camera className="size-4" /> Camera
              </button>
              <button
                onClick={() => { setScanTab('manual'); setQrLookupResult(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
                  scanTab === 'manual' ? "bg-card text-blue-600 shadow-sm" : "text-slate-300 hover:text-slate-300"
                )}
              >
                <Keyboard className="size-4" /> Manual Lookup
              </button>
            </div>

            {/* Camera Tab */}
            {scanTab === 'camera' && !qrLookupResult && (
              <QrScanner
                onScan={handleQrScan}
                onClose={() => { setShowScanner(false); setQrLookupResult(null); }}
              />
            )}

            {/* Manual Tab */}
            {scanTab === 'manual' && !qrLookupResult && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">Enter the Referral ID printed on the referral slip or displayed on the ASHA worker&apos;s device.</p>
                <input
                  type="text"
                  placeholder="Enter Referral ID"
                  className="w-full h-12 px-4 rounded-xl border border-border focus:ring-2 focus:ring-blue-500 outline-none"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualScan(); }}
                />
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { setShowScanner(false); setQrLookupResult(null); }}>Cancel</Button>
                  <Button
                    className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
                    onClick={handleManualScan}
                    disabled={qrLookupLoading || !scanInput.trim()}
                  >
                    {qrLookupLoading ? 'Looking upGǪ' : 'Lookup'}
                  </Button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {qrLookupLoading && (
              <div className="flex flex-col items-center py-8">
                <Activity className="size-8 animate-spin text-blue-500 mb-4" />
                <p className="text-sm text-slate-300">Resolving referral securely from serverGǪ</p>
              </div>
            )}

            {/* Result Display */}
            {qrLookupResult && !qrLookupResult.error && !qrLookupLoading && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <h4 className="font-bold text-emerald-800">Referral Found</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-300 text-xs">Referral ID</p>
                      <p className="font-mono font-bold text-slate-300">{qrLookupResult.id?.slice(0, 12)}</p>
                    </div>
                    <div>
                      <p className="text-slate-300 text-xs">Status</p>
                      <p className="font-semibold text-slate-300">{qrLookupResult.status}</p>
                    </div>
                    <div>
                      <p className="text-slate-300 text-xs">Urgency</p>
                      <Badge variant="outline" className={cn("text-xs", qrLookupResult.urgency === 'EMERGENCY' ? 'text-red-600 border-red-200' : qrLookupResult.urgency === 'URGENT' ? 'text-orange-600 border-orange-200' : 'text-emerald-600 border-emerald-200')}>
                        {qrLookupResult.urgency}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-slate-300 text-xs">Facility</p>
                      <p className="font-medium text-slate-300 text-xs">{qrLookupResult.facilityId === 'PENDING_ASSIGNMENT' ? 'Unassigned' : qrLookupResult.facilityId || 'G��'}</p>
                    </div>
                    {qrLookupResult.patientName && (
                      <div className="col-span-2">
                        <p className="text-slate-300 text-xs">Patient</p>
                        <p className="font-medium text-slate-300">{qrLookupResult.patientName}</p>
                      </div>
                    )}
                    {qrLookupResult.queue_token && (
                      <div className="col-span-2">
                        <p className="text-slate-300 text-xs">Queue Token</p>
                        <p className="font-mono font-bold text-blue-700 text-lg">{qrLookupResult.queue_token}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={async () => {
                      try {
                        const user = auth.currentUser;
                        const token = user ? await user.getIdToken() : '';
                        const res = await fetch('/api/referral/transition', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ referralId: qrLookupResult.id, status: 'ACCEPTED' }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          throw new Error(err.error || 'Transition failed');
                        }
                        toast.success('Patient accepted G�� status updated');
                        setShowScanner(false);
                        setQrLookupResult(null);
                        setScanInput('');
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  >
                    Accept Patient
                  </Button>
                  <Button variant="outline" onClick={() => { setQrLookupResult(null); }}>
                    Scan Another
                  </Button>
                </div>

                <p className="text-[10px] text-slate-300 text-center">
                  Referral resolved server-side. No patient PII was read from the QR payload.
                </p>
              </div>
            )}

            {/* Error Result */}
            {qrLookupResult?.error && !qrLookupLoading && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertOctagon className="size-5 text-red-600" />
                    <h4 className="font-bold text-red-800">
                      {qrLookupResult.code === 'REFERRAL_NOT_FOUND' ? 'Referral Not Found'
                        : qrLookupResult.code === 'REFERRAL_CLOSED' ? 'Referral Already Closed'
                        : qrLookupResult.code === 'SCOPE_FACILITY_MISMATCH' ? 'Unauthorized G�� Different Facility'
                        : qrLookupResult.code === 'ROLE_UNAUTHORIZED' ? 'Access Denied'
                        : qrLookupResult.code === 'PAYLOAD_TAMPERED' ? 'Invalid / Tampered QR'
                        : 'Lookup Failed'}
                    </h4>
                  </div>
                  <p className="text-sm text-red-700">{qrLookupResult.message}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setQrLookupResult(null); }}>Try Again</Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setShowScanner(false); setQrLookupResult(null); }}>Close</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* G��G��G�� Timeline Modal G��G��G�� */}
      {timelineRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-foreground">Referral Timeline</h3>
            <p className="text-sm text-slate-300 mb-6">Complete audit history for this referral.</p>
            
            <div className="space-y-4">
              {loadingTimeline ? (
                 <div className="text-center py-4"><Activity className="size-6 animate-spin mx-auto text-blue-500" /></div>
              ) : timelineEvents.length === 0 ? (
                 <p className="text-sm text-slate-300 text-center py-4">No events found.</p>
              ) : (
                 <div className="relative border-l border-border ml-3 space-y-6">
                   {timelineEvents.map((ev, idx) => (
                     <div key={idx} className="pl-6 relative">
                       <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                       <div className="text-sm font-semibold text-slate-300">{ev.action}</div>
                       <div className="text-xs text-slate-300 mb-1">{new Date(ev.occurred_at).toLocaleString()}</div>
                       {ev.note && <div className="text-sm text-slate-300 bg-slate-50 p-2 rounded-md">{ev.note}</div>}
                       <div className="text-xs text-slate-300 mt-1">Actor UID: {ev.actor_uid}</div>
                     </div>
                   ))}
                 </div>
              )}
              
              <div className="pt-4 mt-6 border-t border-border flex justify-end">
                <Button variant="outline" onClick={() => setTimelineRef(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G��G��G�� Assign Facility Modal G��G��G�� */}
      {assignRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-foreground">Assign Target Facility</h3>
            <p className="text-sm text-slate-300 mb-6">Select a facility to route this referral to.</p>
            
            <div className="space-y-4">
              {facilities.length > 0 ? (
                <select 
                  className="w-full h-12 px-4 rounded-xl border border-border focus:ring-2 focus:ring-blue-500 outline-none bg-card"
                  value={selectedFacility}
                  onChange={e => setSelectedFacility(e.target.value)}
                >
                  <option value="" disabled>Select a facility...</option>
                  {facilities.filter(f => f.status !== 'INACTIVE').map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.district})</option>
                  ))}
                </select>
              ) : (
                <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm">
                  No active facilities found in the system. Please ensure facilities exist in the database.
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setAssignRef(null)}>Cancel</Button>
                <Button 
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700" 
                  onClick={handleAssignFacility}
                  disabled={!selectedFacility || facilities.length === 0 || assigning}
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G��G��G�� Schedule Appointment Modal G��G��G�� */}
      {scheduleRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-foreground">Schedule Appointment</h3>
            <p className="text-sm text-slate-300 mb-6">Book a slot and generate a queue token.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Service</label>
                <select 
                    className="w-full h-10 px-3 rounded-lg border border-border focus:ring-2 focus:ring-blue-500 outline-none bg-card text-sm"
                    value={selectedService}
                    onChange={e => setSelectedService(e.target.value)}
                  >
                    <option value="" disabled>Select a service...</option>
                    {(() => {
                      const refToSchedule = liveReferrals.find(r => r.id === scheduleRef);
                      const fac = facilities.find(f => f.id === refToSchedule?.facilityId);
                      const srvs = fac?.services || [];
                      const availableSrvs = srvs.filter((s: any) => s.availabilityStatus === 'AVAILABLE' || s.availabilityStatus === 'LIMITED');
                      
                      if (availableSrvs.length === 0) {
                        return (
                          <option value="" disabled>No configured services. Use manual override.</option>
                        );
                      }
                      return availableSrvs.map((s: any) => (
                        <option key={s.serviceId} value={s.serviceId}>{s.serviceName} {s.availabilityStatus === 'LIMITED' ? '(Limited)' : ''}</option>
                      ));
                    })()}
                  </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                <input 
                  type="date"
                  className="w-full h-10 px-3 rounded-lg border border-border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Time Slot</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg border border-border focus:ring-2 focus:ring-blue-500 outline-none bg-card text-sm"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                >
                  <option value="" disabled>Select a time slot...</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="16:00">04:00 PM</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setScheduleRef(null)}>Cancel</Button>
                <Button 
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700" 
                  onClick={handleScheduleAppt}
                  disabled={!selectedService || !selectedDate || !selectedTime || scheduling}
                >
                  {scheduling ? 'Scheduling...' : 'Confirm Booking'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G��G��G�� Record Outcome Modal G��G��G�� */}
      {outcomeRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-foreground">Record Consultation Outcome</h3>
            <p className="text-sm text-slate-300 mb-6">Log clinical notes and decide the next step.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Disposition</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg border border-border focus:ring-2 focus:ring-blue-500 outline-none bg-card text-sm"
                  value={outcomeDisposition}
                  onChange={e => setOutcomeDisposition(e.target.value)}
                >
                  <option value="" disabled>Select outcome...</option>
                  <option value="treated">Treated / Closed</option>
                  <option value="referred_onward">Referred Onward (Escalation)</option>
                  <option value="follow_up_required">Follow-up Required (ASHA Task)</option>
                  <option value="unable_to_attend">Unable to Attend / Did Not Show</option>
                </select>
              </div>
              
              {outcomeDisposition === 'follow_up_required' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Follow-up Date</label>
                  <input 
                    type="date"
                    className="w-full h-10 px-3 rounded-lg border border-border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={outcomeDueDate}
                    onChange={e => setOutcomeDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Clinical Notes (Required for follow-up)</label>
                <textarea 
                  className="w-full p-3 rounded-lg border border-border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  rows={3}
                  placeholder="Enter diagnosis, prescription notes, or follow-up instructions..."
                  value={outcomeNotes}
                  onChange={e => setOutcomeNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setOutcomeRef(null)}>Cancel</Button>
                <Button 
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700" 
                  onClick={handleRecordOutcome}
                  disabled={!outcomeDisposition || (outcomeDisposition === 'follow_up_required' && (!outcomeDueDate || !outcomeNotes)) || submittingOutcome}
                >
                  {submittingOutcome ? 'Saving...' : 'Save Outcome'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G��G��G�� Metrics Row G��G��G�� */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-blue-50 rounded-full border border-blue-100">
              <Users className="size-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">Total Active Referrals</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-foreground">{loading ? '-' : activeReferrals}</h3>
                <span className="text-xs font-medium text-slate-300">Live from Field</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-red-100 shadow-sm ring-1 ring-red-500/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-red-50 rounded-full border border-red-100">
              <AlertOctagon className="size-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">SLA Breached Cases</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-red-700">{loading ? '-' : breachedCases}</h3>
                <span className="text-xs font-medium text-red-500 flex items-center">
                  Requires Attention
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-600 border-blue-700 shadow-lg cursor-pointer hover:bg-blue-700 transition-colors" onClick={() => { setShowScanner(true); setQrLookupResult(null); setScanTab('camera'); }}>
          <CardContent className="p-6 flex items-center justify-between h-full">
            <div>
              <p className="text-blue-100 font-medium mb-1">Incoming Patient?</p>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <ScanLine className="size-6" /> Scan Referral QR
              </h3>
            </div>
            <div className="p-3 bg-card/10 rounded-full">
              <Camera className="size-6 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* G��G��G�� Open Defects Table G��G��G�� */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border bg-slate-50/50 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-300">Live Referral Tracking</CardTitle>
              <CardDescription className="text-slate-300">Syncs instantly when ASHA workers update data offline.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Search Referral ID..."
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-slate-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Patient Name</th>
                  <th className="px-6 py-3 font-semibold">Triage Tier</th>
                  <th className="px-6 py-3 font-semibold">Referral ID</th>
                  <th className="px-6 py-3 font-semibold">Assigned PHC</th>
                  <th className="px-6 py-3 font-semibold">Appt / Token</th>
                  <th className="px-6 py-3 font-semibold">Status / Outcome</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {liveReferrals.filter(r => r.id.toLowerCase().includes(search.toLowerCase()) || r.patientName.toLowerCase().includes(search.toLowerCase())).map((ref) => {
                  const statusConf = STATUS_CONFIG[ref.status] || STATUS_CONFIG['pending'];
                  const StatusIcon = statusConf.icon;
                  
                  return (
                    <tr 
                      key={ref.id} 
                      className={cn(
                        "transition-colors hover:bg-slate-800/50",
                        ref.slaBreached && ref.status !== 'completed' ? "bg-red-900/20" : ""
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-100">{ref.patientName}</div>
                        {ref.patient_id && (
                          <a
                            href={`/${locale}/dashboard/district/patient/${ref.patient_id}`}
                            className="text-[10px] text-blue-600 hover:underline inline-flex items-center mt-1"
                          >
                            View 360 Record
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={cn("font-bold text-[10px]", TIER_COLORS[ref.urgency] || TIER_COLORS['YELLOW'])}>
                          {ref.urgency}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                        {ref.id}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-300">
                        {ref.facilityId === 'PENDING_ASSIGNMENT' ? (
                           <span className="text-orange-500 text-xs italic">Pending Assignment</span>
                        ) : (
                           ref.facilityId || 'PHC Default'
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {ref.queue_token ? (
                          <span className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{ref.queue_token}</span>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Unscheduled</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn("flex items-center gap-1.5 font-medium", statusConf.color)}>
                          <StatusIcon className="size-4" />
                          {statusConf.label}
                        </div>
                        {ref.outcome_disposition && (
                          <div className="mt-1 text-[10px] uppercase font-bold text-slate-300">
                            {ref.outcome_disposition.replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 flex flex-wrap gap-2">
                        {ref.status === 'CREATED' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => setAssignRef(ref.id)}
                            >
                              Assign Facility
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => handleTransition(ref.id, 'ACCEPTED', 'Patient arrived')}
                            >
                              Mark Arrived
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-orange-600 border-orange-200 hover:bg-orange-50"
                              onClick={() => {
                                const note = window.prompt("What info is needed?");
                                if (note) handleTransition(ref.id, 'INFO_REQUESTED', note);
                              }}
                            >
                              Request Info
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                const note = window.prompt("Reason for rejection?");
                                if (note) handleTransition(ref.id, 'REJECTED', note);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {ref.facilityId && ref.facilityId !== 'PENDING_ASSIGNMENT' && !ref.queue_token && ref.status !== 'completed' && ref.status !== 'REJECTED' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => setScheduleRef(ref.id)}
                          >
                            Schedule Appt
                          </Button>
                        )}
                        {ref.status === 'ACCEPTED' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => setOutcomeRef(ref.id)}
                          >
                            Record Outcome
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-blue-600 hover:bg-blue-50 ml-auto"
                          onClick={() => handleViewTimeline(ref.id)}
                        >
                          <Clock className="size-4 mr-1" /> Timeline
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && liveReferrals.length === 0 && (
            <div className="text-center py-12 text-slate-300">
              <div className="flex justify-center mb-4"><Activity className="size-12 text-slate-300" /></div>
              No active referrals found. Create one from the ASHA portal!
            </div>
          )}
          {loading && (
            <div className="text-center py-12 text-slate-300">
              <Activity className="size-8 animate-spin mx-auto text-blue-500 mb-4" />
              Syncing live data from field...
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}



