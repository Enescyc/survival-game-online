import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Position } from './types/GameTypes';
import GameCanvas from './components/GameCanvas';
import { soundManager } from './utils/SoundManager';
import RegisterForm from './components/RegisterForm';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://192.168.1.100:3000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server with ID:', newSocket.id);
      setPlayerId(newSocket.id!);
      setConnectionStatus('connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('error');
    });

    newSocket.on('connect_timeout', () => {
      console.error('Socket connection timeout');
      setConnectionStatus('error');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setConnectionStatus('error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setConnectionStatus('connecting');
    });

    newSocket.on('gameState', (state: GameState) => {
      console.log('Received initial game state:', state);
      setGameState({
        ...state,
        players: Array.isArray(state.players) ? state.players : Array.from(state.players)
      });
    });

    newSocket.on('preparationPhase', (data: { message: string; timeRemaining: number }) => {
      console.log('Preparation phase:', data);
      setGameState(prev => prev ? {
        ...prev,
        gameStatus: 'waiting',
        timeRemaining: data.timeRemaining
      } : null);
    });
    newSocket.on('gameStarted', (newGameState: GameState) => {
      console.log('Game started:', newGameState);
      setGameState(newGameState);
      soundManager.play('gameStart');
      soundManager.play('background');
    });

    newSocket.on('preparationUpdate', (timeRemaining: number) => {
      console.log('Preparation update:', timeRemaining);
      setGameState(prev => prev ? {
        ...prev,
        gameStatus: 'waiting',
        timeRemaining: timeRemaining
      } : null);
    });

    newSocket.on('gameStateUpdate', (state: GameState) => {
      console.log('Received game state update:', state);
      setGameState({
        ...state,
        players: Array.isArray(state.players) ? state.players : Array.from(state.players)
      });
    });

    newSocket.on('playerDied', () => {
      console.log('Player died - entering spectator mode');
      soundManager.play('gameOver');
      if (!gameState?.players.find(p => p.id === playerId)?.isSpectator) {
        
      }
    });

    newSocket.on('playerBecameSpectator', (data: { playerId: string, playerName: string }) => {
      console.log(`${data.playerName} became a spectator`);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        console.log('Cleaning up socket connection');
        newSocket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('resourceCollected', ({ resourceId, playerId: collectorId, newResourceValue }) => {
      if (collectorId === playerId) {
        soundManager.play('collect');
      }
      
      setGameState(prevState => {
        if (!prevState) return null;

        return {
          ...prevState,
          resources: prevState.resources.filter(r => r.id !== resourceId),
          players: prevState.players.map(p => {
            if (p.id === collectorId) {
              return {
                ...p,
                resources: {
                  ...p.resources,
                  [prevState.resources.find(r => r.id === resourceId)?.type || '']: newResourceValue
                }
              };
            }
            return p;
          })
        };
      });
    });

    socket.on('gameStateUpdate', (state: GameState) => {
      const player = state.players.find(p => p.id === playerId);
      if (player) {
        if (player.resources.food <= 30 || 
            player.resources.water <= 30 || 
            player.resources.oxygen <= 30) {
          soundManager.play('low-resource');
        }
      }
      setGameState({
        ...state,
        players: Array.isArray(state.players) ? state.players : Array.from(state.players)
      });
    });

    socket.on('gameOver', (score: number) => {
      soundManager.play('gameOver');
    });

    return () => {
      socket.off('resourceCollected');
      socket.off('gameStateUpdate');
      socket.off('gameOver');
      socket.off('gameStarted');
    };
  }, [socket, playerId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('playersUpdate', (updatedPlayers) => {
      setGameState(prevState => {
        if (!prevState) return null;

        const updatedPlayerMap = new Map(prevState.players.map(p => [p.id, p]));
        updatedPlayers.forEach((player: Player) => {
          updatedPlayerMap.set(player.id, player);
        });

        return {
          ...prevState,
          players: Array.from(updatedPlayerMap.values())
        };
      });
    });

    return () => {
      socket.off('playersUpdate');
    };
  }, [socket]);

  const handleMove = (position: Position) => {
    if (socket && gameState) {
      socket.emit('movePlayer', position);
      
      // Optimistic update
      setGameState(prevState => {
        if (!prevState) return null;

        return {
          ...prevState,
          players: prevState.players.map(p => {
            if (p.id === playerId) {
              return {
                ...p,
                position: position
              };
            }
            return p;
          })
        };
      });
    }
  };

  const handleRegister = (name: string) => {
    if (socket) {
      console.log('Registering with name:', name);
      socket.emit('register', { name });
      setIsRegistered(true);
    }
  };

  if (connectionStatus === 'error') {
    return <div className="text-red-500">Failed to connect to server</div>;
  }

  if (!socket || connectionStatus === 'connecting') {
    return <div>Connecting to server...</div>;
  }

  if (!isRegistered) {
    return <RegisterForm onRegister={handleRegister} />;
  }

  if (!gameState) {
    return <div>Waiting for game state...</div>;
  }

  const player = gameState.players.find(p => p.id === playerId);

  return (
    <div className="flex flex-col h-screen bg-gray-800 text-white">
      <header className="p-4 bg-gray-900">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Pixel Survival</h1>
          <div className="flex gap-4 items-center">
            <span className={gameState?.gameStatus === 'waiting' ? 'text-yellow-400' : 'text-green-400'}>
              {gameState?.gameStatus === 'waiting' ? 'Next game in: ' : 'Game ends in: '}
              {Math.floor(gameState.timeRemaining / 60)}:
              {(gameState.timeRemaining % 60).toString().padStart(2, '0')}
            </span>
            <button
              onClick={() => soundManager.toggleMute()}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              🔊
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex- gap-4 p-4 overflow-hidden">
        {player?.isSpectator && (
          <div className="bg-red-500 text-white px-4 py-2 text-center">
            Spectator Mode - Waiting for next game
          </div>
        )}
        <div className="flex-1 min-w-0">
          {gameState && socket ? (
            <GameCanvas
              gameState={gameState}
              playerId={playerId}
              onMove={handleMove}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-xl">Loading...</p>
            </div>
          )}
        </div>

        <aside className="w-64 flex-shrink-0 bg-gray-900 p-4 rounded">
          {player && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="p-3 bg-gray-800 rounded">
                  <h2 className="text-lg font-semibold mb-2">Game Info</h2>
                  <div className="space-y-2 text-sm">
                    <p className="flex justify-between">
                      <span>Status:</span>
                      <span>{gameState.gameStatus === 'waiting' ? 'Preparing Next Game' : 
                             gameState.gameStatus === 'running' ? 'Game In Progress' : 'Game Finished'}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{gameState.gameStatus === 'waiting' ? 'Next Game:' : 'Time Left:'}</span>
                      <span>{Math.floor(gameState.timeRemaining / 60)}:
                            {(gameState.timeRemaining % 60).toString().padStart(2, '0')}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Time of Day:</span>
                      <span>{gameState.isDayTime ? '☀️ Day' : '🌙 Night'}</span>
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded">
                  <h2 className="text-lg font-semibold mb-2">Player Stats</h2>
                  <div className="space-y-2 text-sm">
                    <p className="flex justify-between">
                      <span>Score:</span>
                      <span>{player.score}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Safe Zone:</span>
                      <span>{player.isInSafeZone ? '✅' : '❌'}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App; 