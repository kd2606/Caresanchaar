'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, RotateCcw, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  QR Payload Format                                                  */
/*  "dv:ref:<firestore_referral_id>"                                   */
/*  No patient PII is encoded in the QR.                               */
/* ------------------------------------------------------------------ */

const DV_PREFIX = 'dv:ref:';

export type ScannerState =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'scanned'
  | 'permission_denied'
  | 'no_camera'
  | 'invalid_qr'
  | 'error';

interface QrScannerProps {
  /** Called with the opaque referral ID (without prefix) on successful scan */
  onScan: (referralId: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [state, setState] = useState<ScannerState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const scannerState = scannerRef.current.getState?.();
        // Html5Qrcode states: NOT_STARTED=1, SCANNING=2, PAUSED=3
        if (scannerState === 2 || scannerState === 3) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {
      // Ignore cleanup errors
    }
  }, []);

  const startScanner = useCallback(async () => {
    setState('requesting');
    setErrorMsg('');

    try {
      // Dynamically import html5-qrcode to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');

      // Check for camera availability
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        if (mountedRef.current) {
          setState('no_camera');
          setErrorMsg('No camera found on this device.');
        }
        return;
      }

      // Stop any existing scanner
      await stopScanner();

      const scannerId = 'qr-scanner-region';
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;

      if (mountedRef.current) {
        setState('scanning');
      }

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText: string) => {
          if (!mountedRef.current) return;

          // Validate QR format
          if (!decodedText.startsWith(DV_PREFIX)) {
            setState('invalid_qr');
            setLastScanned(decodedText.slice(0, 50));
            setErrorMsg('This QR code is not a valid caresanchaar referral.');
            // Don't stop scanner — let user try again
            return;
          }

          const referralId = decodedText.slice(DV_PREFIX.length).trim();
          if (!referralId || referralId.length < 4) {
            setState('invalid_qr');
            setErrorMsg('QR code contains an invalid referral ID.');
            return;
          }

          // Valid scan — stop camera and report
          setLastScanned(referralId);
          setState('scanned');
          scanner.stop().catch(() => {});
          onScan(referralId);
        },
        () => {
          // Scan error callback (no QR detected in frame) — ignore silently
        }
      );
    } catch (err: any) {
      if (!mountedRef.current) return;

      const msg = err?.message || String(err);
      if (
        msg.includes('NotAllowedError') ||
        msg.includes('Permission') ||
        msg.includes('denied')
      ) {
        setState('permission_denied');
        setErrorMsg(
          'Camera permission was denied. Please allow camera access in your browser settings and try again.'
        );
      } else if (
        msg.includes('NotFoundError') ||
        msg.includes('no camera') ||
        msg.includes('Requested device not found')
      ) {
        setState('no_camera');
        setErrorMsg('No camera found on this device.');
      } else {
        setState('error');
        setErrorMsg(msg);
      }
    }
  }, [onScan, stopScanner]);

  const handleRetry = useCallback(() => {
    setState('idle');
    setErrorMsg('');
    setLastScanned('');
    startScanner();
  }, [startScanner]);

  const handleCancel = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  // Status icon and color for each state
  const stateDisplay: Record<
    ScannerState,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    idle: {
      icon: <Camera className="size-5" />,
      label: 'Ready to scan',
      color: 'text-slate-400',
    },
    requesting: {
      icon: <Camera className="size-5 animate-pulse" />,
      label: 'Requesting camera permission…',
      color: 'text-blue-400',
    },
    scanning: {
      icon: <Camera className="size-5 text-emerald-400" />,
      label: 'Point camera at QR code',
      color: 'text-emerald-400',
    },
    scanned: {
      icon: <CheckCircle2 className="size-5 text-emerald-400" />,
      label: 'QR code scanned successfully',
      color: 'text-emerald-400',
    },
    permission_denied: {
      icon: <CameraOff className="size-5 text-red-400" />,
      label: 'Camera permission denied',
      color: 'text-red-400',
    },
    no_camera: {
      icon: <CameraOff className="size-5 text-orange-400" />,
      label: 'No camera available',
      color: 'text-orange-400',
    },
    invalid_qr: {
      icon: <AlertTriangle className="size-5 text-yellow-400" />,
      label: 'Invalid QR code',
      color: 'text-yellow-400',
    },
    error: {
      icon: <XCircle className="size-5 text-red-400" />,
      label: 'Scanner error',
      color: 'text-red-400',
    },
  };

  const current = stateDisplay[state];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Scanner viewport */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[320px] aspect-square bg-black rounded-xl overflow-hidden mb-4"
      >
        {/* html5-qrcode mounts the video here */}
        <div id="qr-scanner-region" className="w-full h-full" />

        {/* Overlay for non-scanning states */}
        {state !== 'scanning' && state !== 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm p-6 text-center">
            <div className="mb-3">{current.icon}</div>
            <p className={`text-sm font-medium ${current.color} mb-2`}>
              {current.label}
            </p>
            {errorMsg && (
              <p className="text-xs text-slate-400 mb-4 max-w-[240px]">
                {errorMsg}
              </p>
            )}
            {state === 'invalid_qr' && lastScanned && (
              <p className="text-[10px] text-slate-500 font-mono mb-2 break-all max-w-[240px]">
                Scanned: &quot;{lastScanned}&quot;
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className={`flex items-center gap-2 mb-4 ${current.color}`}>
        {current.icon}
        <span className="text-sm font-medium">{current.label}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full">
        {state === 'idle' && (
          <button
            onClick={startScanner}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="size-5" />
            Start Camera
          </button>
        )}

        {(state === 'permission_denied' ||
          state === 'no_camera' ||
          state === 'invalid_qr' ||
          state === 'error') && (
          <button
            onClick={handleRetry}
            className="flex-1 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="size-4" />
            Retry
          </button>
        )}

        <button
          onClick={handleCancel}
          className="flex-1 h-12 border border-slate-600 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold transition-colors"
        >
          {state === 'scanning' ? 'Stop Camera' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
