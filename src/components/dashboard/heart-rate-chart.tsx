"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";

const mockHeartRateData = [
    { time: "08:00", bpm: 62 },
    { time: "10:00", bpm: 75 },
    { time: "12:00", bpm: 82 },
    { time: "14:00", bpm: 70 },
    { time: "16:00", bpm: 68 },
    { time: "18:00", bpm: 85 },
    { time: "20:00", bpm: 65 },
];

export function HeartRateChart({ currentBpm = 72 }: { currentBpm?: number }) {
    const [mounted, setMounted] = useState(false);
    const { theme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="h-[200px] w-full animate-pulse bg-muted/50 rounded-xl" />;

    const dynamicData = [...mockHeartRateData];
    dynamicData[dynamicData.length - 1] = { time: "Now", bpm: currentBpm };

    const isDark = theme === "dark";

    return (
        <div className="h-[200px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: isDark ? "#a1a1aa" : "#71717a" }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: isDark ? "#a1a1aa" : "#71717a" }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '12px',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                            color: isDark ? '#fff' : '#000'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="bpm"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorBpm)"
                        activeDot={{ r: 6, fill: "#10b981", stroke: isDark ? "#000" : "#fff", strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
