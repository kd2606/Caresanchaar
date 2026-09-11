"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Activity, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function VoiceCallInterface({ onClose }: { onClose: () => void }) {
    const t = useTranslations("dashboard");
    const [callState, setCallState] = useState<"connecting" | "listening" | "thinking" | "speaking" | "ended">("connecting");
    const [transcript, setTranscript] = useState("");
    const [aiResponse, setAiResponse] = useState("Connecting to Pulse AI...");
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [micMuted, setMicMuted] = useState(false);
    
    const recognitionRef = useRef<any>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Initialize Web Speech API
    useEffect(() => {
        // Mock connection delay for realistic feel
        const connectTimer = setTimeout(() => {
            setCallState("listening");
            setAiResponse("Hi, I'm Pulse. How can I help you today?");
            playTTS("Hi, I'm Pulse. How can I help you today?");
        }, 1500);

        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                // Try to map to navigator language or default to English/Hindi
                recognition.lang = navigator.language || 'en-IN';

                recognition.onresult = (event: any) => {
                    let finalTranscript = '';
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (interimTranscript) {
                        setTranscript(interimTranscript);
                    }
                    if (finalTranscript) {
                        handleUserSpeech(finalTranscript);
                    }
                };

                recognition.onend = () => {
                    if (callState === "listening" && !micMuted) {
                        try { recognition.start(); } catch(e) {}
                    }
                };

                recognitionRef.current = recognition;
            } else {
                toast.error("Speech recognition not supported in this browser.");
            }
        }

        return () => {
            clearTimeout(connectTimer);
            if (recognitionRef.current) recognitionRef.current.stop();
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current.src = "";
                audioPlayerRef.current = null;
            }
        };
    }, []);

    // Manage Microphone state based on callState
    useEffect(() => {
        if (!recognitionRef.current) return;
        
        try {
            if (callState === "listening" && !micMuted) {
                recognitionRef.current.start();
            } else {
                recognitionRef.current.stop();
            }
        } catch (e) {
            // Ignore errors if it's already started/stopped
        }
    }, [callState, micMuted]);

    const handleUserSpeech = async (text: string) => {
        setTranscript(text);
        setCallState("thinking");
        setAiResponse("Thinking...");
        
        const newMessages = [...messages, { role: "user", content: text }];
        setMessages(newMessages);

        try {
            const res = await fetch("/api/pulse?stream=false", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages })
            });

            if (!res.ok) throw new Error("Failed to get response");
            const data = await res.json();
            
            setMessages([...newMessages, { role: "model", content: data.content }]);
            setAiResponse(data.content);
            setCallState("speaking");
            await playTTS(data.content);
            
        } catch (err) {
            console.error(err);
            toast.error("Connection failed.");
            setCallState("listening");
            setTranscript("");
        }
    };

    const playTTS = async (text: string) => {
        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, languageCode: navigator.language.startsWith('hi') ? 'hi-IN' : 'en-IN' }),
            });

            if (!response.ok) throw new Error("TTS failed");
            const data = await response.json();
            
            if (data.audios && data.audios[0]) {
                const audioSrc = `data:audio/wav;base64,${data.audios[0]}`;
                const audio = new Audio(audioSrc);
                audioPlayerRef.current = audio;
                
                audio.onended = () => {
                    setCallState("listening");
                    setTranscript("");
                };
                
                await audio.play();
            } else {
                setCallState("listening");
            }
        } catch (err) {
            console.error(err);
            setCallState("listening");
        }
    };

    const endCall = () => {
        setCallState("ended");
        if (recognitionRef.current) recognitionRef.current.stop();
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = "";
        }
        setTimeout(onClose, 500);
    };

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-between font-space overflow-hidden"
            >
                {/* Background ambient light */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[150px] rounded-full pointer-events-none transition-colors duration-1000 ${
                    callState === 'speaking' ? 'bg-emerald-500/20' : 
                    callState === 'thinking' ? 'bg-indigo-500/20' : 
                    callState === 'listening' ? 'bg-emerald-500/5' : 'bg-transparent'
                }`} />

                {/* Top Bar */}
                <div className="w-full p-8 flex justify-center items-center relative z-10">
                    <div className="flex flex-col items-center gap-2">
                        <BadgePulse state={callState} />
                        <h2 className="text-xl font-bold text-white tracking-widest uppercase">Pulse AI</h2>
                        <span className="text-xs text-white/40 tracking-widest">End-to-End Encrypted</span>
                    </div>
                </div>

                {/* Central Avatar & Transcript */}
                <div className="flex-1 w-full max-w-2xl px-6 flex flex-col items-center justify-center gap-12 relative z-10">
                    
                    {/* Avatar Animation */}
                    <div className="relative flex items-center justify-center">
                        <AnimatePresence>
                            {(callState === "speaking" || callState === "thinking") && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: [1, 1.2, 1] }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute inset-0 rounded-full border border-emerald-500/30 bg-emerald-500/10"
                                />
                            )}
                        </AnimatePresence>
                        <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center backdrop-blur-xl transition-all duration-500 ${
                            callState === 'speaking' ? 'border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]' :
                            callState === 'listening' ? 'border-emerald-500/30' : 'border-indigo-500 border-dashed animate-spin-slow'
                        }`}>
                            <Activity className={`w-12 h-12 ${callState === 'speaking' ? 'text-emerald-400 animate-pulse' : 'text-white/50'}`} />
                        </div>
                    </div>

                    {/* AI Subtitles / User Transcript */}
                    <div className="text-center min-h-[120px] flex flex-col justify-center items-center w-full">
                        <AnimatePresence mode="wait">
                            <motion.p 
                                key={callState === 'listening' ? transcript : aiResponse}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`text-2xl md:text-3xl font-medium tracking-tight max-w-xl leading-relaxed ${
                                    callState === 'listening' && !transcript ? 'text-white/20' : 'text-white/90'
                                }`}
                            >
                                {callState === 'listening' 
                                    ? (transcript || "Listening...") 
                                    : aiResponse}
                            </motion.p>
                        </AnimatePresence>
                    </div>

                </div>

                {/* Call Controls */}
                <div className="w-full pb-16 flex justify-center gap-8 items-center relative z-10">
                    <button 
                        onClick={() => setMicMuted(!micMuted)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all ${
                            micMuted ? 'bg-white/10 border-white/20 text-white/40' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                    >
                        {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>

                    <button 
                        onClick={endCall}
                        className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(225,29,72,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        <PhoneOff className="w-8 h-8" />
                    </button>
                    
                    <button className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-xl border bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all">
                        <User className="w-6 h-6" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function BadgePulse({ state }: { state: string }) {
    const isGreen = state === "listening" || state === "speaking";
    return (
        <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2 ${
            isGreen ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-indigo-500/10 border-indigo-500/20'
        }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isGreen ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isGreen ? 'text-emerald-400' : 'text-indigo-400'}`}>
                {state}
            </span>
        </div>
    );
}
