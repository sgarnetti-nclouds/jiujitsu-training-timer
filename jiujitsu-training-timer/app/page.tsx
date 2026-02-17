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

  // Get Ready countdown effect
  useEffect(() => {
    if (!isGetReady || isPaused) return;

    const interval = setInterval(() => {
      setGetReadyTime((prev) => {
        // Play beep for each countdown number
        if (prev > 1) {
          playBeep();
        }

        if (prev <= 1) {
          clearInterval(interval);
          setIsGetReady(false);
          setIsActive(true);
          setGetReadyTime(10); // Reset for next time

          // STEP 4: Play bell to signal round start (position already announced when Start was clicked)
          console.log('COUNTDOWN COMPLETE: Playing bell to start round');
          playAirHorn();
          setAnnouncementMade(true);

          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGetReady, isPaused, trainingPlan, currentRoundConfig, currentRoundIndex, selectedPosition, currentQuickRound]);

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

    // STEP 1: Initialize speech synthesis
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
        window.speechSynthesis.getVoices();
      }
    } catch (error) {
      console.error('Error initializing speech:', error);
    }

    // STEP 2: Announce position and WAIT for it to finish
    if (selectedPosition) {
      console.log('START: Announcing position:', selectedPosition.name);
      await announcRound(currentQuickRound, selectedPosition.name);
      console.log('START: Announcement finished, starting countdown');
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

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* Quick Timer View */}
      {viewMode === 'quick' && !trainingPlan && (
        <>
          {/* Quick Round Setup - All in one row */}
          <div className="mb-8 flex items-center justify-center gap-6 flex-wrap">
            {/* Title on the left */}
            <h2 className="text-2xl font-bold text-black">Quick Round Setup</h2>

            {/* Duration buttons in the middle */}
            <div className="flex gap-3">
              {PRESET_DURATIONS.map((preset) => (
                <Button
                  key={preset.seconds}
                  onClick={() => handleDurationChange(preset.seconds)}
                  disabled={isActive}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    duration === preset.seconds
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Rounds selector on the right */}
            <div className="flex items-center gap-3">
              <label className="text-black font-semibold">Rounds:</label>
              <select
                value={numQuickRounds}
                onChange={(e) => {
                  const newNum = parseInt(e.target.value);
                  setNumQuickRounds(newNum);
                  setCurrentQuickRound(1); // Reset to round 1
                }}
                disabled={isActive}
                className="px-4 py-2 rounded-lg font-semibold bg-gray-800 text-white border-2 border-gray-700 focus:border-gray-600 focus:outline-none disabled:opacity-50"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
              {numQuickRounds > 1 && (
                <span className="text-black font-semibold text-sm">
                  (Round {currentQuickRound}/{numQuickRounds})
                </span>
              )}
            </div>
          </div>

          {/* Timer */}
          <div className="w-full max-w-md">
            {isGetReady ? (
              <div className="flex flex-col items-center justify-center p-4">
                <div className="text-yellow-400 text-6xl font-bold mb-4">GET READY</div>
                <div className="text-black text-9xl font-bold">{getReadyTime}</div>
              </div>
            ) : (
              <Timer
                timeRemaining={timeRemaining}
                isActive={isActive}
                isPaused={isPaused}
                totalTime={duration}
                positionTitle={selectedPosition?.name ?? null}
              />
            )}
          </div>

          {/* Controls and Position Picker */}
          <div className="flex gap-4 mt-16 justify-center flex-wrap">
            <Button
              onClick={() => setShowPositionSelector(true)}
              className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg"
            >
              {selectedPosition ? `Position: ${selectedPosition.name}` : 'Select Position'}
            </Button>

            <Button
              onClick={() => {
                const randomPos = positions[Math.floor(Math.random() * positions.length)];
                setSelectedPosition(randomPos);
                if (!isActive && !isGetReady) {
                  setTimeRemaining(duration);
                }
              }}
              className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg"
            >
              🎲 Random Position
            </Button>

            <Button
              onClick={handleStartQuick}
              disabled={isActive || isGetReady}
              className="px-6 py-2 bg-[#0f6b3a] hover:bg-[#0e5c33] text-white font-semibold rounded-lg disabled:opacity-50"
            >
              Start
            </Button>

            <Button
              onClick={handlePause}
              disabled={!isActive}
              className="px-6 py-2 bg-[#b58b00] hover:bg-[#9f7700] text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>

            <Button
              onClick={handleReset}
              className="px-6 py-2 bg-[#c0392b] hover:bg-[#99271f] text-white font-semibold rounded-lg"
            >
              Reset
            </Button>

            <Button
              onClick={() => setShowTrainingPlanSelector(true)}
              className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg"
            >
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
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">{trainingPlan.name}</h2>
            <p className="text-gray-300">
              Round {currentRoundIndex + 1} of {trainingPlan.rounds.length}
              {isResting && ' • REST'}
            </p>
          </div>

          {/* Timer */}
          <div className="w-full max-w-md">
            {isGetReady ? (
              <div className="flex flex-col items-center justify-center p-4">
                <div className="text-yellow-400 text-6xl font-bold mb-4">GET READY</div>
                <div className="text-black text-9xl font-bold">{getReadyTime}</div>
              </div>
            ) : (
              <Timer
                timeRemaining={timeRemaining}
                isActive={isActive}
                isPaused={isPaused}
                totalTime={currentDuration}
                positionTitle={displayPosition?.name ?? null}
              />
            )}
          </div>

          {isResting && (
            <div className="mt-4 text-center text-yellow-400 font-semibold text-lg">
              ⏰ Rest Time
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 mt-24 justify-center">
            <Button
              onClick={async () => {
                // Initialize speech synthesis
                try {
                  if (typeof window !== 'undefined' && window.speechSynthesis) {
                    window.speechSynthesis.resume();
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.getVoices();
                  }
                } catch (error) {
                  console.error('Error initializing speech:', error);
                }

                // Announce position and WAIT for it to finish
                if (currentRoundConfig?.position) {
                  await announcRound(currentRoundIndex + 1, currentRoundConfig.position.name);
                }

                // Start countdown AFTER announcement completes
                setIsGetReady(true);
                setGetReadyTime(10);
                setIsPaused(false);
                setAnnouncementMade(false);
              }}
              disabled={isActive || isGetReady}
              className="px-6 py-2 bg-[#0f6b3a] hover:bg-[#0e5c33] text-white font-semibold rounded-lg disabled:opacity-50"
            >
              Start
            </Button>

            <Button
              onClick={handlePause}
              disabled={!isActive}
              className="px-6 py-2 bg-[#b58b00] hover:bg-[#9f7700] text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>

            {isResting && (
              <Button onClick={handleSkipRest} className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg">
                Skip Rest
              </Button>
            )}

            <Button onClick={handleReset} className="px-6 py-2 bg-[#c0392b] hover:bg-[#99271f] text-white font-semibold rounded-lg">
              Restart Round
            </Button>

            <Button onClick={handleEndSession} className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg">
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
