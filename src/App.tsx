import { useState } from 'react';
import { GameMode, Difficulty } from './types';
import { GameSettings } from './components/GameSettings';
import { GameScreen } from './components/GameScreen';
import { DeviceTypeProvider } from './hooks/useResponsive';

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
    // Device type (iPhone/iPad/PC web) is detected once here, right at the app's entry point,
    // and shared via context to every page below — see hooks/useResponsive.tsx.
    <DeviceTypeProvider>
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
    </DeviceTypeProvider>
  );
}
