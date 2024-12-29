import React from 'react';
import { LeaderboardEntry } from '../types/GameTypes';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries }) => {
  return (
    <div className="leaderboard">
      <h3>Leaderboard</h3>
      <div className="leaderboard-entries">
        {entries.map((entry, index) => (
          <div key={index} className="leaderboard-entry">
            <span className="rank">#{index + 1}</span>
            <span className="name">{entry.playerName}</span>
            <span className="score">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard; 