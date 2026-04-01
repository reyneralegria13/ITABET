import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BetSlip from '@/components/betting/BetSlip';
import LiveScoreTicker from '@/components/betting/LiveScoreTicker';
import { useBetSlipStore } from '@/stores/betSlipStore';

export default function MainLayout() {
  const { isOpen } = useBetSlipStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LiveScoreTicker />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isOpen ? 'mr-80' : ''}`}>
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <Outlet />
          </div>
        </main>

        {isOpen && (
          <aside className="fixed right-0 top-0 h-full w-80 z-40">
            <BetSlip />
          </aside>
        )}
      </div>
    </div>
  );
}
