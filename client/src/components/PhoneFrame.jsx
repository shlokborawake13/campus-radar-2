import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Smartphone, Monitor } from 'lucide-react';

export default function PhoneFrame({ children }) {
  const [currentTime, setCurrentTime] = useState('9:41');
  const [showDeviceBezel, setShowDeviceBezel] = useState(true);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours % 12 || 12}:${minutes}`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f3fa] text-slate-headline flex flex-col items-center justify-start sm:py-6 relative overflow-x-hidden selection:bg-emerald-100">
      {/* Background ambient lighting orbs */}
      <div className="fixed top-[-10%] left-[20%] w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Desktop Top Control Banner (for preview context) */}
      <aside aria-label="Device preview controls" className="hidden sm:flex items-center justify-between w-full max-w-[480px] mb-2 px-3 text-[11px] font-semibold text-slate-meta">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Campus Radar Mobile Environment</span>
        </div>
        <button
          onClick={() => setShowDeviceBezel(!showDeviceBezel)}
          className="flex items-center gap-1 text-slate-meta hover:text-slate-headline transition bg-white/70 px-2 py-0.5 rounded-full border border-slate-border"
        >
          {showDeviceBezel ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
          <span>{showDeviceBezel ? 'Bezel On' : 'Bezel Off'}</span>
        </button>
      </aside>

      {/* Main Viewport Container (Centered 480px) */}
      <div
        className={`w-full max-w-[480px] bg-surface relative transition-all duration-300 ${
          showDeviceBezel
            ? 'sm:rounded-[40px] sm:shadow-2xl sm:border-[8px] sm:border-slate-800/90 sm:overflow-hidden sm:min-h-[844px]'
            : 'sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-border sm:overflow-hidden'
        }`}
      >
        {/* iOS Dynamic Island & Status Bar (Visible on desktop bezel or small screens) */}
        <div className="w-full bg-white/95 px-6 pt-3 pb-1 flex items-center justify-between text-slate-headline text-[12px] font-bold select-none border-b border-slate-border/40">
          <span className="tracking-tight">{currentTime}</span>

          {/* Dynamic Island Pill */}
          <div className="w-24 h-4.5 bg-slate-900 rounded-full flex items-center justify-end px-2 gap-1.5 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#10b981]/80 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </div>

          <div className="flex items-center gap-1.5 text-slate-headline">
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Content View Area */}
        <div className="relative min-h-[calc(100vh-42px)] sm:min-h-[800px] flex flex-col bg-surface">
          {children}
        </div>
      </div>
    </div>
  );
}
