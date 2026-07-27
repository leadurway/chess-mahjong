import { useState } from 'react';
import { GameMode, Difficulty } from './types';
import { GameSettings } from './components/GameSettings';
import { GameScreen } from './components/GameScreen';

export default function App() {
  const [activeGameConfig, setActiveGameConfig] = useState<{
    mode: GameMode;
    difficulty: Difficulty;
    playerIsBanker: boolean;
    playerName: string;
  } | null>(null);

  const handleStartGame = (config: { mode: GameMode; difficulty: Difficulty; playerIsBanker: boolean; playerName: string }) => {
    setActiveGameConfig(config);
  };

  const handleExitGame = () => {
    setActiveGameConfig(null);
  };

  return (
    <div className="h-[100dvh] bg-[#064e3b] text-stone-100 flex flex-col justify-between">
      {activeGameConfig ? (
        <GameScreen
          mode={activeGameConfig.mode}
          difficulty={activeGameConfig.difficulty}
          playerIsBanker={activeGameConfig.playerIsBanker}
          playerName={activeGameConfig.playerName}
          onExit={handleExitGame}
        />
      ) : (
        <GameSettings onStartGame={handleStartGame} />
      )}
    </div>
  );
}
