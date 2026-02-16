'use client';

import { useState, useEffect } from 'react';
import Timer from './components/Timer';
import PositionSelector from './components/PositionSelector';
import TrainingPlanSelector from './components/TrainingPlanSelector';
import { Button } from '@/components/ui/button';
import type { Position, TrainingPlan, RoundConfig } from '@/lib/types';
import { announcRound, announceRoundEnd } from '@/lib/audio';
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

  // Training plan state
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [isResting, setIsResting] = useState(false);

  // Active timer state
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [announcementMade, setAnnouncementMade] = useState(false);

  // Get current round config
  const currentRoundConfig = trainingPlan?.rounds[currentRoundIndex];
  const currentDuration = isResting ? (trainingPlan?.restDuration || 60) : (currentRoundConfig?.duration || duration);
  const displayPosition = isResting ? null : (currentRoundConfig?.position || selectedPosition);

  // Timer countdown effect
  useEffect(() => {
    if (!isActive || isPaused) return;

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
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, trainingPlan, isResting]);

  // Announcement effect for training plan
  useEffect(() => {
    if (
      isActive &&
      !isPaused &&
      !announcementMade &&
      timeRemaining < currentDuration - 1 &&
      trainingPlan &&
      !isResting
    ) {
      const position = currentRoundConfig?.position;
      const roundNum = currentRoundIndex + 1;
      const positionName = position?.name || 'Neutral';
      announcRound(roundNum, positionName);
      setAnnouncementMade(true);
    }
  }, [
    isActive,
    isPaused,
    announcementMade,
    timeRemaining,
    currentDuration,
    trainingPlan,
    isResting,
    currentRoundIndex,
    currentRoundConfig?.position,
  ]);

  // Handle rest period completion
  useEffect(() => {
    if (isResting && !isActive && timeRemaining === 0) {
      const nextRoundIndex = currentRoundIndex + 1;
      if (nextRoundIndex < (trainingPlan?.rounds.length || 0)) {
        setCurrentRoundIndex(nextRoundIndex);
        setIsResting(false);
        setAnnouncementMade(false);
        setTimeRemaining(trainingPlan!.rounds[nextRoundIndex].duration);
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

  const handleStartQuick = () => {
    setIsActive(true);
    setIsPaused(false);
    setAnnouncementMade(false);
    // Announce quick start (user gesture ensures audio will play)
    const posName = selectedPosition?.name || 'Neutral';
    announcRound(1, posName);
  };

  const handleStartPlan = (plan: TrainingPlan) => {
    setTrainingPlan(plan);
    setCurrentRoundIndex(0);
    setIsResting(false);
    setAnnouncementMade(false);
    setTimeRemaining(plan.rounds[0].duration);
    setViewMode('plan');
    setShowTrainingPlanSelector(false);
    // Auto start
    setTimeout(() => {
      setIsActive(true);
      setIsPaused(false);
    }, 500);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setAnnouncementMade(false);

    if (trainingPlan) {
      setCurrentRoundIndex(0);
      setIsResting(false);
      setTimeRemaining(trainingPlan.rounds[0].duration);
    } else {
      setTimeRemaining(duration);
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
          {/* Duration Selection */}
          <div className="mb-8 flex gap-3 flex-wrap justify-center">
            {PRESET_DURATIONS.map((preset) => (
              <Button
                key={preset.seconds}
                onClick={() => handleDurationChange(preset.seconds)}
                disabled={isActive}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  duration === preset.seconds
                    ? 'bg-black hover:bg-gray-900 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Timer */}
          <div className="w-full max-w-md">
            <Timer
              timeRemaining={timeRemaining}
              isActive={isActive}
              isPaused={isPaused}
              totalTime={duration}
              positionTitle={selectedPosition?.name ?? null}
            />
          </div>

          {/* Controls and Position Picker */}
          <div className="flex gap-4 mt-24 justify-center flex-wrap">
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
              }}
              className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg"
            >
              🎲 Random Position
            </Button>

            <Button
              onClick={handleStartQuick}
              disabled={isActive}
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
            <Timer
              timeRemaining={timeRemaining}
              isActive={isActive}
              isPaused={isPaused}
              totalTime={currentDuration}
              positionTitle={displayPosition?.name ?? null}
            />
          </div>

          {/* Position Display */}
          {displayPosition && (
            <div
              className="mt-6 p-6 rounded-lg text-center"
              style={{
                backgroundColor: displayPosition.color + '20',
                borderLeft: `4px solid ${displayPosition.color}`,
              }}
            >
              <p className="text-white font-semibold text-lg">{displayPosition.name}</p>
              <p className="text-gray-300 text-sm capitalize">Category: {displayPosition.category}</p>
            </div>
          )}

          {isResting && (
            <div className="mt-4 text-center text-yellow-400 font-semibold text-lg">
              ⏰ Rest Time
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 mt-24 justify-center">
            <Button
              onClick={() => setIsActive(true)}
              disabled={isActive}
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
          }}
          onClose={() => setShowPositionSelector(false)}
        />
      )}

      {/* Footer */}
      <div className="mt-auto pb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Jiu Jitsu Training Timer</h1>
        <p className="text-gray-400">Track your training rounds</p>
      </div>
    </div>
  );
}
