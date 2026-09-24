import React from 'react';
import { Home, Compass, Plus, Bell, User } from 'lucide-react';

export default function BottomNav({ currentTab, onSelectTab, onOpenCreate, unreadNotifs = 0 }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-border py-1.5 px-6 w-full shadow-sm lg:hidden">
      <div className="max-w-lg mx-auto flex items-center justify-between relative">
        {/* Tab 1: Home (Feed) */}
        <button
          onClick={() => onSelectTab('feed')}
          className={`flex flex-col items-center justify-center py-1 flex-1 transition active:scale-95 ${
            currentTab === 'feed' ? 'text-primary' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Home className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] font-semibold mt-1">Radar</span>
        </button>

        {/* Tab 2: Explore / Search */}
        <button
          onClick={() => onSelectTab('explore')}
          className={`flex flex-col items-center justify-center py-1 flex-1 transition active:scale-95 ${
            currentTab === 'explore' ? 'text-primary' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Compass className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] font-semibold mt-1">Explore</span>
        </button>

        {/* Center: Floating Create Action Button (FAB) */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={onOpenCreate}
            aria-label="Create Post, Confession or Event"
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover active:bg-primary-dark text-white flex items-center justify-center shadow-emerald-fab ring-4 ring-white transition duration-200 transform hover:scale-105 active:scale-95"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 3: Notifications */}
        <button
          onClick={() => onSelectTab('notifications')}
          className={`relative flex flex-col items-center justify-center py-1 flex-1 transition active:scale-95 ${
            currentTab === 'notifications' ? 'text-primary' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5 stroke-[2.2]" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-tertiary rounded-full ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] font-semibold mt-1">Alerts</span>
        </button>

        {/* Tab 4: Profile */}
        <button
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center py-1 flex-1 transition active:scale-95 ${
            currentTab === 'profile' ? 'text-primary' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <User className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] font-semibold mt-1">Profile</span>
        </button>
      </div>
    </nav>
  );
}
