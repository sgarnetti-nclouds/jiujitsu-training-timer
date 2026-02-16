"use client";

import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  timeRemaining: number;
  isActive: boolean;
  isPaused: boolean;
  totalTime?: number;
  positionTitle?: string | null;
}

export default function Timer({
  timeRemaining,
  isActive,
  isPaused,
  totalTime = 180,
  positionTitle = null,
}: TimerProps) {

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate percentage remaining
  const percentageRemaining = (timeRemaining / totalTime) * 100;
  // Percentage elapsed (grows left-to-right as time passes)
  const percentageElapsed = ((totalTime - timeRemaining) / totalTime) * 100;

  // Determine color based on percentage
  const getColor = () => {
    if (percentageRemaining > 50) return 'text-green-500';
    if (percentageRemaining > 25) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCircleColor = () => {
    if (percentageRemaining > 50) return '#10b981';
    if (percentageRemaining > 25) return '#eab308';
    return '#ef4444';
  };

  const timeRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState<number | null>(null);
  const [barHeight, setBarHeight] = useState<number | null>(null);

  useEffect(() => {
    const timeEl = timeRef.current;
    if (!timeEl) return;

    const measure = () => {
      const rect = timeEl.getBoundingClientRect();
      setBarWidth(Math.ceil(rect.width));
      setBarHeight(Math.ceil(rect.height));
    };

    // Initial measure
    measure();

    // Use ResizeObserver for font/loading/layout changes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(timeEl);
    }

    // Fallback: listen to window resize as well
    window.addEventListener('resize', measure);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [timeRef.current]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
      {/* Time Display */}
      <div className="flex flex-col items-center justify-center">
          <div ref={containerRef} className="relative inline-block" style={{ paddingBottom: '48px' }}>
            <div ref={timeRef} className="font-bold tabular-nums" style={{ fontSize: '400px', lineHeight: '1', letterSpacing: '-0.05em', color: '#000', position: 'relative', zIndex: 30 }}>
              {formatTime(timeRemaining)}
            </div>

            {/* Rounded rectangle SVG surrounding the digits - placed behind digits */}
            {barWidth && barHeight && (
              (() => {
                const padX = 120;
                const padY = 64;
                const w = Math.max(200, barWidth + padX);
                const h = Math.max(120, barHeight + padY);
                const rx = 48;
                const strokeW = 14;
                const elapsedFraction = Math.max(0, Math.min(1, (totalTime - timeRemaining) / totalTime));
                
                // Stroke color: black (not started) → green → yellow → red as time passes
                let strokeColor = '#1f2937'; // black initially
                if (isActive) {
                  if (percentageRemaining > 50) strokeColor = '#10b981'; // green
                  else if (percentageRemaining > 25) strokeColor = '#eab308'; // yellow
                  else strokeColor = '#ef4444'; // red
                }
                
                // Create rounded rect path
                const x = strokeW / 2;
                const y = strokeW / 2;
                const width = w - strokeW;
                const height = h - strokeW;
                const pathData = `M ${x + rx} ${y} L ${x + width - rx} ${y} Q ${x + width} ${y} ${x + width} ${y + rx} L ${x + width} ${y + height - rx} Q ${x + width} ${y + height} ${x + width - rx} ${y + height} L ${x + rx} ${y + height} Q ${x} ${y + height} ${x} ${y + height - rx} L ${x} ${y + rx} Q ${x} ${y} ${x + rx} ${y}`;
                
                // Calculate path length for proper dash animation
                const perimeter = 2 * ((width - 2*rx) + (height - 2*rx)) + Math.PI * 2 * rx;
                const dashLength = Math.max(0, perimeter * elapsedFraction);

                return (
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', zIndex: 10 }}>
                    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      {/* Background rounded rect */}
                      <path
                        d={pathData}
                        fill="transparent"
                        stroke="#364152"
                        strokeWidth={strokeW}
                        opacity={0.9}
                      />

                      {/* Animated countdown path - starts at 12 o'clock, moves clockwise */}
                      <path
                        d={pathData}
                        fill="transparent"
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        strokeDasharray={perimeter}
                        strokeDashoffset={perimeter - dashLength}
                        style={{ transformOrigin: `${w / 2}px ${h / 2}px`, transform: `rotate(-90deg)`, transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease' }}
                      />
                    </svg>

                    {/* Position title outside rectangle, just below it */}
                    {positionTitle && (
                      <div style={{ position: 'absolute', left: '50%', top: `${Math.round(h + 24)}px`, transform: 'translateX(-50%)', width: w, textAlign: 'center', zIndex: 25 }}>
                        <div style={{ color: '#c0392b', fontWeight: 800, fontSize: '48px' }}>{positionTitle}</div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
            
          </div>
      </div>

      {/* spacer kept for layout consistency */}
      <div className="mt-8" />
    </div>
  );
}
