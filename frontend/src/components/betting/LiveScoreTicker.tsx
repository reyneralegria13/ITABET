import { useEffect, useState } from 'react';
import { getSocket, connectSocket } from '@/lib/socket';
import { Zap } from 'lucide-react';

interface LiveGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  sport: string;
}

export default function LiveScoreTicker() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('live:games', (games: LiveGame[]) => setLiveGames(games));
    return () => { socket.off('live:games'); };
  }, []);

  if (liveGames.length === 0) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 py-1.5 overflow-hidden">
      <div className="flex items-center gap-3 px-4">
        <div className="flex items-center gap-1.5 shrink-0 text-red-400 text-xs font-semibold">
          <Zap className="w-3 h-3" />
          AO VIVO
        </div>
        <div className="flex gap-6 overflow-x-auto hide-scrollbar">
          {liveGames.map((g) => (
            <div key={g.id} className="flex items-center gap-2 shrink-0 text-xs">
              <span className="text-foreground font-medium">{g.homeTeam}</span>
              <span className="font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                {g.homeScore} - {g.awayScore}
              </span>
              <span className="text-foreground font-medium">{g.awayTeam}</span>
              {g.minute && <span className="text-muted-foreground">{g.minute}'</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
