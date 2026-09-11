'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Loader2, MicOff } from 'lucide-react';
import { toast } from 'sonner';

export interface ParsedIntakeData {
  name?: string;
  age_years?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  symptoms?: string;
  temperature_f?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  risk_level?: 'RED' | 'YELLOW' | 'GREEN';
}

interface AIAssistantFABProps {
  onDataParsed: (data: ParsedIntakeData) => void;
}

export function AIAssistantFAB({ onDataParsed }: AIAssistantFABProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN'; // Better suited for Indian English / accents

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        
        recognition.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsProcessing(true);
          toast.info('Analyzing speech with AI...');
          
          try {
            const res = await fetch('/api/ai/parse-intake', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: transcript })
            });
            
            if (!res.ok) throw new Error('API request failed');
            
            const data: ParsedIntakeData = await res.json();
            onDataParsed(data);
            toast.success('Form magically auto-filled!');
          } catch (e) {
            console.error('Failed to parse speech:', e);
            toast.error('Failed to parse speech details');
          } finally {
            setIsProcessing(false);
          }
        };

        recognition.onerror = (e: any) => {
          console.error('Speech recognition error:', e);
          setIsListening(false);
          if (e.error !== 'no-speech') {
            toast.error(`Microphone error: ${e.error}`);
          }
        };

        recognitionRef.current = recognition;
      } else {
        setIsSupported(false);
      }
    }
  }, [onDataParsed]);

  if (!isSupported) return null;

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        toast.info('Listening for patient details...');
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={isProcessing}
      title="Auto-fill with AI Voice"
      className={`fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 border-2 ${
        isProcessing 
          ? 'bg-slate-800 border-slate-700 text-slate-400' 
          : isListening 
            ? 'bg-teal-600 border-teal-400 animate-pulse text-white shadow-teal-500/30' 
            : 'bg-slate-900 border-teal-500/50 hover:bg-slate-800 hover:border-teal-400 text-teal-400'
      }`}
    >
      {isProcessing ? (
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      ) : isListening ? (
        <Mic className="h-6 w-6 animate-bounce" />
      ) : (
        <Mic className="h-6 w-6" />
      )}
    </button>
  );
}
