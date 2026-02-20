"use client";

import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  timeRemaining: number;
  isActive: boolean;
  isPaused: boolean;
  totalTime?: number;
  positionTitle?: string | null;
  darkMode?: boolean;
}

export default function Timer({
  timeRemaining,
  isActive,
  isPaused,
  totalTime = 180,
  positionTitle = null,
  darkMode = false,
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
  const [windowWidth, setWindowWidth] = useState<number>(1200);
  const [windowHeight, setWindowHeight] = useState<number>(900);
  const [flashStart, setFlashStart] = useState(false);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    setWindowHeight(window.innerHeight);
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Flash bright green when round starts
  useEffect(() => {
    if (isActive) {
      setFlashStart(true);
      const t = setTimeout(() => setFlashStart(false), 700);
      return () => clearTimeout(t);
    } else {
      setFlashStart(false);
    }
  }, [isActive]);

  // Landscape mobile: width > height and height is phone-sized
  const isLandscapeMobile = windowWidth > windowHeight && windowHeight < 500;
  const isMobile = windowWidth < 640 || isLandscapeMobile;
  const fontSize = isLandscapeMobile
    ? Math.round(windowHeight * 0.42)
    : isMobile
      ? Math.round(windowWidth * 0.28)
      : 400;
  const padX = isMobile ? 16 : 120;
  const padY = isMobile ? 12 : 64;
  const rx = isMobile ? 16 : 48;
  const strokeW = isMobile ? 6 : 14;

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
          <div ref={containerRef} className="relative inline-block" style={{ paddingBottom: isMobile ? '24px' : '48px' }}>
            <div ref={timeRef} className="font-bold tabular-nums" style={{ fontSize: `${fontSize}px`, lineHeight: '1', letterSpacing: '-0.05em', color: darkMode ? '#fff' : '#000', position: 'relative', zIndex: 30 }}>
              {formatTime(timeRemaining)}
            </div>

            {/* Rounded rectangle SVG surrounding the digits - placed behind digits */}
            {barWidth && barHeight && (
              (() => {
                const w = Math.max(200, barWidth + padX);
                const h = Math.max(120, barHeight + padY);
                // Add 1-second compensation so animation stays ahead and completes exactly at endpoint
                const elapsedFraction = Math.max(0, Math.min(1, (totalTime - timeRemaining + 1) / totalTime));

                // Stroke color: flash bright green on start → green → yellow → red as time passes
                let strokeColor: string;
                if (flashStart) {
                  strokeColor = '#00ff88'; // bright green flash takes priority
                } else if (isActive) {
                  if (timeRemaining <= 10) strokeColor = '#ef4444'; // red at 10 seconds
                  else if (percentageRemaining > 50) strokeColor = '#10b981'; // green
                  else if (percentageRemaining > 25) strokeColor = '#eab308'; // yellow
                  else strokeColor = '#ef4444'; // red
                } else {
                  strokeColor = '#1f2937'; // dark when not started
                }
                
                // Create rounded rect path starting from top-center
                const x = strokeW / 2;
                const y = strokeW / 2;
                const width = w - strokeW;
                const height = h - strokeW;
                const centerX = x + width / 2;
                const topY = y;

                // Start from top center, go clockwise
                const pathData = `M ${centerX} ${topY} L ${x + width - rx} ${y} Q ${x + width} ${y} ${x + width} ${y + rx} L ${x + width} ${y + height - rx} Q ${x + width} ${y + height} ${x + width - rx} ${y + height} L ${x + rx} ${y + height} Q ${x} ${y + height} ${x} ${y + height - rx} L ${x} ${y + rx} Q ${x} ${y} ${x + rx} ${y} L ${centerX} ${topY}`;

                // Calculate path length for proper dash animation
                const perimeter = 2 * ((width - 2*rx) + (height - 2*rx)) + Math.PI * 2 * rx;
                // Add slight extra length at completion to ensure it reaches the exact endpoint
                const dashLength = elapsedFraction >= 1 ? perimeter + 5 : Math.max(0, perimeter * elapsedFraction);

                return (
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', zIndex: 10 }}>
                    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      {/* Background rounded rect */}
                      <path
                        d={pathData}
                        fill="transparent"
                        stroke={darkMode ? '#555' : '#364152'}
                        strokeWidth={strokeW}
                        opacity={0.9}
                      />

                      {/* Animated countdown path - starts at 12 o'clock, moves clockwise */}
                      <path
                        d={pathData}
                        fill="transparent"
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        strokeLinecap="butt"
                        strokeDasharray={perimeter}
                        strokeDashoffset={perimeter - dashLength}
                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                      />
                    </svg>

                    {/* Position title centered between rectangle and buttons */}
                    {positionTitle && (
                      <div style={{ position: 'absolute', left: '50%', top: `${Math.round(h + 18)}px`, transform: 'translateX(-50%)', width: w, textAlign: 'center', zIndex: 25 }}>
                        <div style={{ color: '#c0392b', fontWeight: 800, fontSize: isMobile ? '24px' : '48px' }}>{positionTitle}</div>
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
