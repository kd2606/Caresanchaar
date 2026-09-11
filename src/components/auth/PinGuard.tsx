'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Unlock, KeyRound, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOfflineDb } from '@/lib/db/offline-db';
import { OfflineCrypto } from '@/lib/crypto/offline-crypto';
import { useLiveQuery } from 'dexie-react-hooks';
import FullScreenLoader from './FullScreenLoader';
import { toast } from 'sonner';
import { auth } from '@/firebase/clientApp';
import { signOut } from 'firebase/auth';
import { useRouter, useParams } from 'next/navigation';

export default function PinGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('worker.pin');
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'en';

  const db = getOfflineDb();
  const keyMaterials = useLiveQuery(() => db.key_material.toArray());

  useEffect(() => {
    if (OfflineCrypto.isKeyLoaded()) {
      setUnlocked(true);
    }
  }, []);

  if (unlocked) {
    return <>{children}</>;
  }

  // Still loading Dexie
  if (keyMaterials === undefined) {
    return <FullScreenLoader />;
  }

  const isSetup = keyMaterials.length === 0;

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      toast.error(t('pinRequired') || 'PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      toast.error(t('incorrectPin') || 'PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const material = await OfflineCrypto.setupKeyWithPIN(pin);
      await db.key_material.add({ id: material.keyId, ...material });
      setUnlocked(true);
      toast.success(t('setupSuccess') || 'Device PIN created successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(t('setupFailed') || 'Failed to create Device PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      toast.error(t('pinRequired') || 'PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    try {
      const material = keyMaterials[0];
      await OfflineCrypto.unlockKeyWithPIN(pin, material);
      setUnlocked(true);
    } catch (error: any) {
      console.error(error);
      toast.error(t('incorrectPin') || 'Incorrect device PIN');
    } finally {
      setLoading(false);
      setPin(''); // clear PIN on failure/success
    }
  };

  const handleSignOut = async () => {
    OfflineCrypto.clearKey();
    await signOut(auth);
    router.push(`/${locale}/auth/worker`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 font-sans text-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md z-10 bg-[#0B1120] border border-slate-800 rounded-2xl p-8 shadow-2xl relative">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
            {isSetup ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            ) : (
              <Lock className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isSetup ? (t('createDevicePin') || 'Create Device PIN') : (t('unlockDevice') || 'Unlock Device')}
          </h2>
          <p className="text-sm text-slate-400">
            {isSetup 
              ? 'Create a PIN to secure patient records on this device.'
              : t('secureOfflineExplanation')}
          </p>
        </div>

        <form onSubmit={isSetup ? handleSetup : handleUnlock} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={t('pinRequired') || 'PIN (4-8 digits)'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="bg-slate-900 border-slate-700 text-center text-2xl tracking-[0.5em] h-14"
                maxLength={8}
                disabled={loading}
                autoFocus
              />
            </div>
            
            {isSetup && (
              <div>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('confirmPin') || 'Confirm PIN'}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-center text-2xl tracking-[0.5em] h-14"
                  maxLength={8}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {!isSetup && (
            <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300 leading-relaxed">
                {t('recoveryLimitation') || 'If you forget this PIN, offline data on this device cannot be recovered.'}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={loading || pin.length < 4 || (isSetup && confirmPin.length < 4)}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {loading ? '...' : (isSetup ? (t('createDevicePin') || 'Create Device PIN') : (t('unlockDevice') || 'Unlock Device'))}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              onClick={handleSignOut}
              disabled={loading}
              className="w-full text-slate-400 hover:text-white"
            >
              {t('lockSignOut')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
