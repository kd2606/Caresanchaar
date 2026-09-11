'use client';

import { useCallback, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Share2, CheckCircle2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  QR Payload Format                                                  */
/*  "dv:ref:<firestore_referral_id>"                                   */
/*  No patient PII is encoded in the QR.                               */
/* ------------------------------------------------------------------ */

const DV_PREFIX = 'dv:ref:';

interface ReferralQrCodeProps {
  /** The opaque Firestore referral document ID */
  referralId: string;
  /** If true, shows a synthetic/demo data label */
  isSynthetic?: boolean;
  onClose: () => void;
}

export default function ReferralQrCode({
  referralId,
  isSynthetic = true,
  onClose,
}: ReferralQrCodeProps) {
  const [copied, setCopied] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const qrValue = `${DV_PREFIX}${referralId}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = referralId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralId]);

  const handleDownload = useCallback(() => {
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 50, 30, 300, 300);

      // Add referral ID text below QR
      ctx.fillStyle = '#374151';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Referral: ${referralId.slice(0, 20)}`, canvas.width / 2, 360);

      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.fillText('caresanchaar SIH26133 — No PII encoded', canvas.width / 2, 385);

      if (isSynthetic) {
        ctx.fillStyle = '#d97706';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('SYNTHETIC / DEMO DATA', canvas.width / 2, 410);
      }

      const a = document.createElement('a');
      a.download = `referral-qr-${referralId.slice(0, 8)}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();

      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [referralId, isSynthetic]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) return;

    try {
      await navigator.share({
        title: 'caresanchaar Referral QR',
        text: `Referral ID: ${referralId}\nScan this at the facility to pull up the referral.`,
      });
    } catch {
      // User cancelled or share failed — ignore
    }
  }, [referralId]);

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm flex flex-col items-center border border-slate-800 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-1">Referral QR Code</h3>
        <p className="text-sm text-slate-400 mb-4 text-center">
          Show this to facility staff on arrival for instant lookup.
        </p>

        {isSynthetic && (
          <div className="mb-3 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <span className="text-xs font-semibold text-amber-400">
              Synthetic / Demo Data
            </span>
          </div>
        )}

        {/* QR Code */}
        <div ref={qrContainerRef} className="p-4 bg-white rounded-xl mb-4 shadow-sm">
          <QRCodeSVG value={qrValue} size={200} level="M" />
        </div>

        {/* Referral ID */}
        <p className="font-mono text-slate-500 text-xs mb-1 break-all text-center">
          {referralId}
        </p>
        <p className="text-[10px] text-slate-600 mb-4">
          No patient PII is encoded in this QR code.
        </p>

        {/* Actions */}
        <div className="flex gap-2 w-full mb-4">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy ID
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Download className="size-3.5" />
            Download
          </button>

          {canShare && (
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Share2 className="size-3.5" />
              Share
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors border border-slate-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
