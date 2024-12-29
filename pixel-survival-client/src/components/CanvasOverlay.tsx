import React from 'react';
import { Player } from '../types/GameTypes';

interface CanvasOverlayProps {
  player: Player;
  position: {
    top: number;
    right: number;
  };
  scale: number;
  isDayTime: boolean;
}

const CanvasOverlay = React.memo(({ player, position, scale, isDayTime }: CanvasOverlayProps) => {
  return (
    <div className="fixed inset-x-0 bottom-0 md:inset-auto flex flex-col gap-4 p-4 md:absolute md:top-4 md:right-4 max-w-full md:max-w-[400px] lg:max-w-[500px]">
      {/* Resource Bars */}
      <div className="w-full md:w-auto bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm md:text-xs font-medium text-gray-300">RESOURCES</span>
            <span className="text-sm md:text-xs text-gray-400">{isDayTime ? '☀️ Day' : '🌙 Night'}</span>
          </div>
        </div>
        <div className="p-4 md:p-3 space-y-4 md:space-y-3">
          {/* Food Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 flex items-center justify-center bg-amber-900/30 rounded">🍖</span>
                <span>Food</span>
              </div>
              <span className="font-medium">{player.resources.food}%</span>
            </div>
            <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  player.resources.food > 60 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600' 
                    : player.resources.food > 30 
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700'
                    : 'bg-gradient-to-r from-red-600 to-red-700'
                }`}
                style={{ width: `${player.resources.food}%` }}
              />
            </div>
          </div>

          {/* Water Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 flex items-center justify-center bg-blue-900/30 rounded">💧</span>
                <span>Water</span>
              </div>
              <span className="font-medium">{player.resources.water}%</span>
            </div>
            <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  player.resources.water > 60 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                    : player.resources.water > 30 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700'
                    : 'bg-gradient-to-r from-red-600 to-red-700'
                }`}
                style={{ width: `${player.resources.water}%` }}
              />
            </div>
          </div>

          {/* Oxygen Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 flex items-center justify-center bg-emerald-900/30 rounded">⭐</span>
                <span>Oxygen</span>
              </div>
              <span className="font-medium">{player.resources.oxygen}%</span>
            </div>
            <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  player.resources.oxygen > 60 
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                    : player.resources.oxygen > 30 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700'
                    : 'bg-gradient-to-r from-red-600 to-red-700'
                }`}
                style={{ width: `${player.resources.oxygen}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status Panel */}
      <div className="w-full md:w-auto bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700">
        <div className="px-4 py-3 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm md:text-xs font-medium text-gray-300">STATUS</span>
            <span className={`text-sm md:text-xs px-2 py-0.5 rounded-full ${
              player.isInSafeZone 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-red-900/50 text-red-400'
            }`}>
              {player.isInSafeZone ? 'Safe Zone ✓' : 'Danger Zone !'}
            </span>
          </div>
        </div>
        <div className="p-4 md:p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Score</span>
            <span className="text-gray-200 font-medium">{player.score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.player.resources.food === nextProps.player.resources.food &&
    prevProps.player.resources.water === nextProps.player.resources.water &&
    prevProps.player.resources.oxygen === nextProps.player.resources.oxygen &&
    prevProps.player.score === nextProps.player.score &&
    prevProps.player.isInSafeZone === nextProps.player.isInSafeZone &&
    prevProps.isDayTime === nextProps.isDayTime &&
    prevProps.position.top === nextProps.position.top &&
    prevProps.position.right === nextProps.position.right &&
    prevProps.scale === nextProps.scale
  );
});

export default CanvasOverlay; 