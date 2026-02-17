'use client';

import type { Position } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface PositionSelectorProps {
  positions: Position[];
  onSelect: (position: Position) => void;
  onClose: () => void;
}

export default function PositionSelector({
  positions,
  onSelect,
  onClose,
}: PositionSelectorProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl">
        {/* Header */}
        <div className="bg-gray-900 p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Select Position</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Position Grid */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
          {positions.map((position) => (
            <button
              key={position.id}
              onClick={() => onSelect(position)}
              className="p-3 rounded-lg text-left transition-all hover:scale-105 active:scale-95 text-sm"
              style={{
                backgroundColor: position.color + '20',
                borderLeft: `4px solid ${position.color}`,
              }}
            >
              <div className="font-semibold text-white">{position.name}</div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-gray-900 p-4 border-t border-gray-700 flex justify-end">
          <Button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
