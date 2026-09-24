import React from 'react';
import { Bell, Search, MapPin, Plus, X } from 'lucide-react';

export default function TopNav({
  unreadCount = 0,
  onSearchClick,
  onBellClick,
  currentTab,
  searchQuery = '',
  onSearchChange,
  onOpenCreate,
  userProfile,
  onProfileClick
}) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-border px-4 sm:px-6 lg:px-8 h-16 flex items-center transition-all">
      <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand Wordmark & Sanjivani University indicator */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[20px] font-bold tracking-tight text-slate-headline flex items-center gap-1 font-sans">
                Campus <span className="text-secondary font-extrabold">Radar</span>
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse ml-0.5" title="Live Campus Activity"></span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-meta hover:text-slate-body cursor-pointer">
              <MapPin className="w-3 h-3 text-primary" />
              <span>Sanjivani University</span>
              <span className="text-[9px] text-slate-meta">▼</span>
            </div>
          </div>
        </div>

        {/* Center: Desktop/Tablet Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg relative items-center">
          <Search className="w-4 h-4 text-slate-meta absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search keywords, #tags, clubs, or courses..."
            value={searchQuery}
            onChange={(e) => {
              if (onSearchChange) onSearchChange(e.target.value);
            }}
            onFocus={() => {
              if (onSearchClick && currentTab !== 'explore') onSearchClick();
            }}
            className="w-full pl-10 pr-9 py-2 rounded-full bg-slate-subtle border border-transparent focus:border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-placeholder transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange && onSearchChange('')}
              className="absolute right-3 w-4 h-4 rounded-full bg-slate-placeholder text-white flex items-center justify-center hover:bg-slate-meta text-[10px]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right Actions: Quick Actions, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Create CTA for Tablet/Desktop */}
          {onOpenCreate && (
            <button
              onClick={onOpenCreate}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white text-[12px] font-bold shadow-sm transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Post</span>
            </button>
          )}

          {/* Quick Search Toggle (Mobile only) */}
          <button
            onClick={onSearchClick}
            aria-label="Quick Search"
            className="md:hidden w-9 h-9 rounded-full bg-slate-subtle hover:bg-slate-border flex items-center justify-center text-slate-body transition active:scale-95"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onBellClick}
            aria-label="Notifications"
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              currentTab === 'notifications' ? 'bg-secondary text-white' : 'bg-slate-subtle hover:bg-slate-border text-slate-body'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && currentTab !== 'notifications' && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-tertiary text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Profile Quick Avatar (Tablet & Desktop) */}
          {userProfile && (
            <button
              onClick={onProfileClick}
              aria-label="User Profile"
              className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border transition active:scale-95 ${
                currentTab === 'profile'
                  ? 'border-primary bg-emerald-50/60'
                  : 'border-slate-border bg-white hover:bg-slate-subtle'
              }`}
            >
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-7 h-7 rounded-full object-cover border border-slate-border"
              />
              <span className="hidden lg:inline text-[12px] font-bold text-slate-headline max-w-[100px] truncate">
                {userProfile.display_name || userProfile.name || 'Anonymous'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
