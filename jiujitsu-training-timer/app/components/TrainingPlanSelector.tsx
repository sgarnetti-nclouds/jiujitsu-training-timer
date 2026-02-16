'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import PositionSelector from './PositionSelector';
import type { Position, TrainingPlan, RoundConfig } from '@/lib/types';
import { positions } from '@/lib/positions';

interface TrainingPlanSelectorProps {
  onSelect: (plan: TrainingPlan) => void;
  onClose: () => void;
}

export default function TrainingPlanSelector({
  onSelect,
  onClose,
}: TrainingPlanSelectorProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [numRounds, setNumRounds] = useState(5);
  const [roundDuration, setRoundDuration] = useState(300); // 5 min
  const [selectedPositions, setSelectedPositions] = useState<(Position | null)[]>([]);
  const [showPositionSelector, setShowPositionSelector] = useState(false);
  const [currentRoundForPosition, setCurrentRoundForPosition] = useState(0);

  // Get random positions
  const getRandomPositions = (count: number): Position[] => {
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  // Tournament prep plan
  const tournamentPrepPlan: TrainingPlan = {
    id: 'tournament-prep',
    name: 'Tournament Prep',
    rounds: Array.from({ length: 5 }, (_, i) => ({
      duration: 300, // 5 minutes
      position: getRandomPositions(5)[i],
    })),
    restDuration: 60,
  };

  // Casual training plan
  const casualTrainingPlan: TrainingPlan = {
    id: 'casual',
    name: 'Casual Training',
    rounds: Array.from({ length: 10 }, (_, i) => ({
      duration: 180, // 3 minutes
      position: getRandomPositions(10)[i],
    })),
    restDuration: 30,
  };

  const initializeCustomPositions = () => {
    if (selectedPositions.length !== numRounds) {
      setSelectedPositions(getRandomPositions(numRounds));
    }
  };

  // Create custom plan
  const createCustomPlan = () => {
    initializeCustomPositions();

    const customRounds: RoundConfig[] = Array.from({ length: numRounds }, (_, i) => ({
      duration: roundDuration,
      position: selectedPositions[i] || getRandomPositions(numRounds)[i],
    }));

    const customPlan: TrainingPlan = {
      id: 'custom',
      name: `Custom (${numRounds}x${Math.floor(roundDuration / 60)}m)`,
      rounds: customRounds,
      restDuration: 60,
    };

    onSelect(customPlan);
  };

  const handlePositionSelect = (position: Position) => {
    const newPositions = [...selectedPositions];
    newPositions[currentRoundForPosition] = position;
    setSelectedPositions(newPositions);
    setShowPositionSelector(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Training Plan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'preset' && (
            <div className="space-y-4">
              {/* Tournament Prep */}
              <button
                onClick={() => onSelect(tournamentPrepPlan)}
                className="w-full p-4 text-left bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 rounded-lg transition-all text-white"
              >
                <div className="font-semibold text-lg">Tournament Prep</div>
                <div className="text-sm text-indigo-200">5 rounds × 5 minutes • Auto-selected positions</div>
              </button>

              {/* Casual Training */}
              <button
                onClick={() => onSelect(casualTrainingPlan)}
                className="w-full p-4 text-left bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-lg transition-all text-white"
              >
                <div className="font-semibold text-lg">Casual Training</div>
                <div className="text-sm text-slate-200">10 rounds × 3 minutes • Auto-selected positions</div>
              </button>

              {/* Custom Plan Button */}
              <button
                onClick={() => {
                  setMode('custom');
                  initializeCustomPositions();
                }}
                className="w-full p-4 text-left bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 rounded-lg transition-all text-white"
              >
                <div className="font-semibold text-lg">Custom Plan</div>
                <div className="text-sm text-stone-300">Create your own training plan</div>
              </button>
            </div>
          )}

          {mode === 'custom' && (
            <div className="space-y-6">
              {/* Number of Rounds */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Number of Rounds: {numRounds}
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={numRounds}
                  onChange={(e) => {
                    const newNum = parseInt(e.target.value);
                    setNumRounds(newNum);
                    if (selectedPositions.length < newNum) {
                      setSelectedPositions([
                        ...selectedPositions,
                        ...getRandomPositions(newNum - selectedPositions.length),
                      ]);
                    }
                  }}
                  className="w-full"
                />
              </div>

              {/* Round Duration */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Round Duration: {Math.floor(roundDuration / 60)} minute(s)
                </label>
                <div className="flex gap-2">
                  {[60, 180, 300, 600].map((dur) => (
                    <Button
                      key={dur}
                      onClick={() => setRoundDuration(dur)}
                      className={`px-3 py-1 text-sm rounded ${
                        roundDuration === dur
                          ? 'bg-indigo-800 text-white'
                          : 'bg-gray-700 text-gray-200'
                      }`}
                    >
                      {Math.floor(dur / 60)}m
                    </Button>
                  ))}
                </div>
              </div>

              {/* Position Selection */}
              <div>
                <label className="block text-white font-semibold mb-3">
                  Select Position for Each Round
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {Array.from({ length: numRounds }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentRoundForPosition(i);
                        setShowPositionSelector(true);
                      }}
                      className={`p-3 rounded text-sm font-semibold transition-all ${
                        selectedPositions[i]
                          ? `text-white`
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      style={
                        selectedPositions[i]
                          ? {
                              backgroundColor: selectedPositions[i].color + '40',
                              borderLeft: `3px solid ${selectedPositions[i].color}`,
                            }
                          : {}
                      }
                    >
                      {selectedPositions[i] ? (
                        <div>
                          <div>R{i + 1}</div>
                          <div className="text-xs">{selectedPositions[i].name.split('(')[0].trim()}</div>
                        </div>
                      ) : (
                        <div>R{i + 1}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="text-gray-300 text-sm">
                Plan: {numRounds} rounds × {Math.floor(roundDuration / 60)} minute(s)
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setMode('preset')}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Back
                </Button>
                <Button
                  onClick={createCustomPlan}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
                >
                  Start Plan
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Position Selector Modal */}
      {showPositionSelector && (
        <PositionSelector
          positions={positions}
          onSelect={handlePositionSelect}
          onClose={() => setShowPositionSelector(false)}
        />
      )}
    </div>
  );
}
