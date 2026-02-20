'use client';

import { useState, useEffect } from 'react';
import Timer from './components/Timer';
import PositionSelector from './components/PositionSelector';
import TrainingPlanSelector from './components/TrainingPlanSelector';
import { Button } from '@/components/ui/button';
import type { Position, TrainingPlan, RoundConfig } from '@/lib/types';
import { announcRound, announceRoundEnd, playBeep, playAirHorn } from '@/lib/audio';
import { positions } from '@/lib/positions';

const PRESET_DURATIONS = [
  { label: '1 min', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
];

type ViewMode = 'quick' | 'plan';

export default function Home() {
  // Dark mode
  const [darkMode, setDarkMode] = useState(false);

  // Detect landscape mobile (phone rotated horizontally) for screencasting layout
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsLandscapeMobile(window.innerWidth > window.innerHeight && window.innerHeight < 500);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Speech toggle
  const [speechEnabled, setSpeechEnabled] = useState(true);

  // View and mode
  const [viewMode, setViewMode] = useState<ViewMode>('quick');
  const [showTrainingPlanSelector, setShowTrainingPlanSelector] = useState(false);
  const [showPositionSelector, setShowPositionSelector] = useState(false);

  // Quick timer state
  const [duration, setDuration] = useState(180);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [numQuickRounds, setNumQuickRounds] = useState(1);
  const [currentQuickRound, setCurrentQuickRound] = useState(1);

  // Training plan state
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [isResting, setIsResting] = useState(false);

  // Active timer state
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [announcementMade, setAnnouncementMade] = useState(false);
  const [isGetReady, setIsGetReady] = useState(false);
  const [getReadyTime, setGetReadyTime] = useState(10);

  // Get current round config
  const currentRoundConfig = trainingPlan?.rounds[currentRoundIndex];
  const currentDuration = isResting ? (trainingPlan?.restDuration || 60) : (currentRoundConfig?.duration || duration);
  const displayPosition = isResting ? null : (currentRoundConfig?.position || selectedPosition);

  // Get Ready countdown effect — only decrements the counter
  useEffect(() => {
    if (!isGetReady || isPaused) return;

    const interval = setInterval(() => {
      setGetReadyTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGetReady, isPaused]);

  // Play beep sound on each countdown tick
  useEffect(() => {
    if (isGetReady && getReadyTime > 0 && getReadyTime < 10) {
      playBeep();
    }
  }, [isGetReady, getReadyTime]);

  // Handle countdown reaching zero — transition to active timer
  useEffect(() => {
    if (!isGetReady || getReadyTime > 0) return;

    setIsGetReady(false);
    setIsActive(true);
    setGetReadyTime(10); // Reset for next time

    // Play bell to signal round start (position already announced when Start was clicked)
    console.log('COUNTDOWN COMPLETE: Playing bell to start round');
    playAirHorn();
    setAnnouncementMade(true);
  }, [isGetReady, getReadyTime]);

  // Timer countdown effect
  useEffect(() => {
    if (!isActive || isPaused || isGetReady) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsActive(false);
          announceRoundEnd();

          // Advance to next round if in plan mode
          if (trainingPlan && !isResting) {
            setIsResting(true);
            setTimeout(() => {
              setTimeRemaining(trainingPlan.restDuration);
            }, 1000);
          } else if (!trainingPlan && currentQuickRound < numQuickRounds) {
            // Quick mode: increment round counter
            setCurrentQuickRound((prev) => prev + 1);
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, isGetReady, trainingPlan, isResting, currentQuickRound, numQuickRounds]);

  // Handle rest period completion
  useEffect(() => {
    if (isResting && !isActive && timeRemaining === 0) {
      const nextRoundIndex = currentRoundIndex + 1;
      if (nextRoundIndex < (trainingPlan?.rounds.length || 0)) {
        setCurrentRoundIndex(nextRoundIndex);
        setIsResting(false);
        setAnnouncementMade(false);
        setTimeRemaining(trainingPlan!.rounds[nextRoundIndex].duration);
        // Auto-start next round: announce position, then start countdown
        const nextPosition = trainingPlan!.rounds[nextRoundIndex].position;
        const startCountdown = () => {
          setIsGetReady(true);
          setGetReadyTime(10);
          setIsPaused(false);
        };
        setTimeout(async () => {
          if (nextPosition) {
            await announcRound(nextRoundIndex + 1, nextPosition.name);
          }
          startCountdown();
        }, 1000);
      } else {
        // Training session complete
        setTrainingPlan(null);
        setViewMode('quick');
      }
    }
  }, [isResting, isActive, timeRemaining, currentRoundIndex, trainingPlan]);

  // Session control handlers
  const handleDurationChange = (seconds: number) => {
    if (!isActive) {
      setDuration(seconds);
      setTimeRemaining(seconds);
    }
  };

  const handleStartQuick = async () => {
    // Reset timer to full duration
    setTimeRemaining(duration);

    // iOS requires speechSynthesis.speak() to be called synchronously within a user gesture.
    // Unlock it now before any awaits, otherwise iOS blocks speech entirely.
    if (speechEnabled && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const unlock = new SpeechSynthesisUtterance(' ');
        unlock.volume = 0;
        unlock.rate = 10;
        window.speechSynthesis.speak(unlock);
        // Don't cancel — let speak() in audio.ts cancel it when real speech starts
      } catch {
        // ignore
      }
    }

    // Announce position and WAIT for it to finish
    if (speechEnabled && selectedPosition) {
      await announcRound(currentQuickRound, selectedPosition.name);
    }

    // STEP 4: Start the 10-second countdown AFTER announcement completes
    setIsGetReady(true);
    setGetReadyTime(10);
    setIsPaused(false);
    setAnnouncementMade(false);
  };

  const handleStartPlan = (plan: TrainingPlan) => {
    setTrainingPlan(plan);
    setCurrentRoundIndex(0);
    setIsResting(false);
    setAnnouncementMade(false);
    setTimeRemaining(plan.rounds[0].duration);
    setViewMode('plan');
    setShowTrainingPlanSelector(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setIsGetReady(false);
    setGetReadyTime(10);
    setAnnouncementMade(false);

    if (trainingPlan) {
      setCurrentRoundIndex(0);
      setIsResting(false);
      setTimeRemaining(trainingPlan.rounds[0].duration);
    } else {
      setTimeRemaining(duration);
      setCurrentQuickRound(1); // Reset to round 1 in quick mode
    }
  };

  const handleEndSession = () => {
    setIsActive(false);
    setIsPaused(false);
    setTrainingPlan(null);
    setViewMode('quick');
    setTimeRemaining(duration);
  };

  const handleSkipRest = () => {
    if (trainingPlan && isResting) {
      const nextRoundIndex = currentRoundIndex + 1;
      if (nextRoundIndex < trainingPlan.rounds.length) {
        setCurrentRoundIndex(nextRoundIndex);
        setIsResting(false);
        setAnnouncementMade(false);
        setTimeRemaining(trainingPlan.rounds[nextRoundIndex].duration);
      }
    }
  };

  // Dark mode button styles
  const btnClass = darkMode
    ? 'px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg border border-white'
    : 'px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'bg-black' : 'bg-white'}`}>
      {/* Dark Mode Toggle - top right */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center gap-2 sm:gap-3">
        <span className={`text-sm sm:text-base font-bold ${darkMode ? 'text-gray-300' : 'text-gray-800'}`}>
          {darkMode ? 'Dark' : 'Light'}
        </span>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`relative w-12 h-6 sm:w-16 sm:h-8 rounded-full transition-colors border-2 ${
            darkMode ? 'bg-gray-700 border-white' : 'bg-gray-300 border-gray-500'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-6 sm:h-6 rounded-full transition-transform ${
              darkMode ? 'translate-x-6 sm:translate-x-7 bg-white' : 'translate-x-0 bg-black'
            }`}
          />
        </button>
      </div>

      {/* Quick Timer View */}
      {viewMode === 'quick' && !trainingPlan && (
        <>
          {/* Quick Round Setup — hidden in landscape mobile (screencasting mode) */}
          <div className={`mb-4 sm:mb-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 w-full px-4 ${isLandscapeMobile ? 'hidden' : ''}`}>
            {/* Title */}
            <h2 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-black'}`}>Quick Round Setup</h2>

            {/* Duration buttons */}
            <div className="flex gap-2 sm:gap-3">
              {PRESET_DURATIONS.map((preset) => (
                <Button
                  key={preset.seconds}
                  onClick={() => handleDurationChange(preset.seconds)}
                  disabled={isActive}
                  className={`px-3 py-2 sm:px-4 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                    duration === preset.seconds
                      ? darkMode
                        ? 'bg-green-600 hover:bg-green-700 text-white border border-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                      : darkMode
                        ? 'bg-gray-900 hover:bg-gray-800 text-white border border-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Rounds selector */}
            <div className="flex items-center gap-2 sm:gap-3">
              <label className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-white' : 'text-black'}`}>Rounds:</label>
              <select
                value={numQuickRounds}
                onChange={(e) => {
                  const newNum = parseInt(e.target.value);
                  setNumQuickRounds(newNum);
                  setCurrentQuickRound(1);
                }}
                disabled={isActive}
                className={`px-3 py-2 sm:px-4 rounded-lg font-semibold bg-gray-800 text-white focus:outline-none disabled:opacity-50 text-sm sm:text-base ${
                  darkMode ? 'border border-white' : 'border-2 border-gray-700 focus:border-gray-600'
                }`}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
              {numQuickRounds > 1 && (
                <span className={`font-semibold text-xs sm:text-sm ${darkMode ? 'text-white' : 'text-black'}`}>
                  (Round {currentQuickRound}/{numQuickRounds})
                </span>
              )}
            </div>
          </div>

          {/* Timer */}
          <div className="w-full">
            {isGetReady ? (
              <div className="flex flex-col items-center justify-center p-4">
                <div className="text-yellow-400 text-4xl sm:text-6xl font-bold mb-4">GET READY</div>
                <div className={`text-7xl sm:text-9xl font-bold ${darkMode ? 'text-white' : 'text-black'}`}>{getReadyTime}</div>
              </div>
            ) : (
              <Timer
                timeRemaining={timeRemaining}
                isActive={isActive}
                isPaused={isPaused}
                totalTime={duration}
                positionTitle={selectedPosition?.name ?? null}
                darkMode={darkMode}
              />
            )}
          </div>

          {/* Controls */}
          <div className={`flex flex-wrap justify-center px-4 ${isLandscapeMobile ? 'gap-2 mt-2' : 'gap-3 sm:gap-4 mt-8 sm:mt-16'}`}>
            {/* Speech toggle */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-black'}`}>Announce Position</span>
              <button
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors border-2 ${
                  speechEnabled
                    ? darkMode ? 'bg-green-600 border-white' : 'bg-green-600 border-green-700'
                    : darkMode ? 'bg-gray-700 border-white' : 'bg-gray-400 border-gray-500'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    speechEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Button onClick={() => setShowPositionSelector(true)} className={btnClass}>
                {selectedPosition ? `Position: ${selectedPosition.name}` : 'Select Position'}
              </Button>

              <Button
                onClick={() => {
                  const randomPos = positions[Math.floor(Math.random() * positions.length)];
                  setSelectedPosition(randomPos);
                  if (!isActive && !isGetReady) setTimeRemaining(duration);
                }}
                className={btnClass}
              >
                🎲 Random Position
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleStartQuick}
                disabled={isActive || isGetReady}
                className={`px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-xl rounded-lg disabled:opacity-50 ${darkMode ? 'border border-white' : 'border border-black'}`}
              >
                ▶
              </Button>

              <Button
                onClick={handlePause}
                disabled={!isActive}
                className={`px-6 py-2 bg-none ${darkMode ? 'bg-yellow-300 border border-white' : 'bg-yellow-400 border border-black'} text-white text-xl rounded-lg disabled:opacity-50`}
              >
                {isPaused ? '▶' : (
                  <svg width="20" height="22" viewBox="0 0 20 22" fill="currentColor" className="size-auto">
                    <rect x="0" y="0" width="8" height="22" rx="2"/>
                    <rect x="12" y="0" width="8" height="22" rx="2"/>
                  </svg>
                )}
              </Button>

              <Button
                onClick={handleReset}
                className={`px-6 py-2 bg-[#c0392b] hover:bg-[#99271f] text-white text-xl rounded-lg ${darkMode ? 'border border-white' : 'border border-black'}`}
              >
                ↺
              </Button>
            </div>

            <Button onClick={() => setShowTrainingPlanSelector(true)} className={btnClass}>
              📋 Training Plan
            </Button>
          </div>

          {/* Position card removed (position shown above the progress line in the Timer) */}
        </>
      )}

      {/* Training Plan View */}
      {viewMode === 'plan' && trainingPlan && (
        <>
          {/* Plan Info */}
          <div className="mb-4 sm:mb-6 text-center">
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-white'}`}>{trainingPlan.name}</h2>
            <p className="text-gray-300 text-sm sm:text-base">
              Round {currentRoundIndex + 1} of {trainingPlan.rounds.length}
              {isResting && ' • REST'}
            </p>
          </div>

          {/* Timer */}
          <div className="w-full">
            {isGetReady ? (
              <div className="flex flex-col items-center justify-center p-4">
                <div className="text-yellow-400 text-4xl sm:text-6xl font-bold mb-4">GET READY</div>
                <div className={`text-7xl sm:text-9xl font-bold ${darkMode ? 'text-white' : 'text-black'}`}>{getReadyTime}</div>
              </div>
            ) : (
              <Timer
                timeRemaining={timeRemaining}
                isActive={isActive}
                isPaused={isPaused}
                totalTime={currentDuration}
                positionTitle={displayPosition?.name ?? null}
                darkMode={darkMode}
              />
            )}
          </div>

          {isResting && (
            <div className="mt-4 text-center text-yellow-400 font-semibold text-lg">
              ⏰ Rest Time
            </div>
          )}

          {/* Controls */}
          <div className={`flex flex-wrap justify-center px-4 ${isLandscapeMobile ? 'gap-2 mt-2' : 'gap-3 sm:gap-4 mt-8 sm:mt-24'}`}>
            {/* Speech toggle */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-black'}`}>Announce Position</span>
              <button
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors border-2 ${
                  speechEnabled
                    ? darkMode ? 'bg-green-600 border-white' : 'bg-green-600 border-green-700'
                    : darkMode ? 'bg-gray-700 border-white' : 'bg-gray-400 border-gray-500'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    speechEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <Button
              onClick={async () => {
                // iOS requires speechSynthesis.speak() synchronously within user gesture
                if (speechEnabled && typeof window !== 'undefined' && window.speechSynthesis) {
                  try {
                    window.speechSynthesis.cancel();
                    const unlock = new SpeechSynthesisUtterance(' ');
                    unlock.volume = 0;
                    unlock.rate = 10;
                    window.speechSynthesis.speak(unlock);
                  } catch {
                    // ignore
                  }
                }

                // Announce position and WAIT for it to finish
                if (speechEnabled && currentRoundConfig?.position) {
                  await announcRound(currentRoundIndex + 1, currentRoundConfig.position.name);
                }

                // Start countdown AFTER announcement completes
                setIsGetReady(true);
                setGetReadyTime(10);
                setIsPaused(false);
                setAnnouncementMade(false);
              }}
              disabled={isActive || isGetReady}
              className={`px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-xl rounded-lg disabled:opacity-50 ${darkMode ? 'border border-white' : 'border border-black'}`}
            >
              ▶
            </Button>

            <Button
              onClick={handlePause}
              disabled={!isActive}
              className={`px-6 py-2 bg-none ${darkMode ? 'bg-yellow-300 border border-white' : 'bg-yellow-400 border border-black'} text-white text-xl rounded-lg disabled:opacity-50`}
            >
              {isPaused ? '▶' : (
                <svg width="20" height="22" viewBox="0 0 20 22" fill="currentColor" className="size-auto">
                  <rect x="0" y="0" width="8" height="22" rx="2"/>
                  <rect x="12" y="0" width="8" height="22" rx="2"/>
                </svg>
              )}
            </Button>

            {isResting && (
              <Button onClick={handleSkipRest} className={btnClass}>
                Skip Rest
              </Button>
            )}

            <Button onClick={handleReset} className={`px-6 py-2 bg-[#c0392b] hover:bg-[#99271f] text-white text-xl rounded-lg ${darkMode ? 'border border-white' : 'border border-black'}`}>
              ↺
            </Button>

            <Button onClick={handleEndSession} className={btnClass}>
              End Session
            </Button>
          </div>
        </>
      )}

      {/* Training Plan Selector Modal */}
      {showTrainingPlanSelector && (
        <TrainingPlanSelector
          onSelect={handleStartPlan}
          onClose={() => setShowTrainingPlanSelector(false)}
        />
      )}

      {/* Position Selector Modal */}
      {showPositionSelector && (
        <PositionSelector
          positions={positions}
          onSelect={(position) => {
            setSelectedPosition(position);
            setShowPositionSelector(false);
            if (!isActive && !isGetReady) {
              setTimeRemaining(duration);
            }
          }}
          onClose={() => setShowPositionSelector(false)}
        />
      )}
    </div>
  );
}
