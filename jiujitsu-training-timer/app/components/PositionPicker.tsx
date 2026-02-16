'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import PositionSelector from './PositionSelector';
import type { Position } from '@/lib/types';
import { positions } from '@/lib/positions';

interface PositionPickerProps {
  selectedPosition: Position | null;
  onSelect: (position: Position) => void;
}

export default function PositionPicker({
  selectedPosition,
  onSelect,
}: PositionPickerProps) {
  const [showModal, setShowModal] = useState(false);

  const handleAutoSelect = () => {
    const randomPosition = positions[Math.floor(Math.random() * positions.length)];
    onSelect(randomPosition);
  };

  return (
    <>
      <div className="mt-8 flex gap-3 flex-wrap justify-center">
        <Button
          onClick={() => setShowModal(true)}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
        >
          {selectedPosition ? `Position: ${selectedPosition.name}` : 'Select Position'}
        </Button>

        <Button
          onClick={handleAutoSelect}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
        >
          🎲 Random Position
        </Button>
      </div>

      {selectedPosition && (
        <div
          className="mt-4 p-4 rounded-lg text-center"
          style={{
            backgroundColor: selectedPosition.color + '20',
            borderLeft: `4px solid ${selectedPosition.color}`,
          }}
        >
          <p className="text-white font-semibold">{selectedPosition.name}</p>
          <p className="text-gray-300 text-sm capitalize">Category: {selectedPosition.category}</p>
        </div>
      )}

      {showModal && (
        <PositionSelector
          positions={positions}
          onSelect={(pos) => {
            onSelect(pos);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
