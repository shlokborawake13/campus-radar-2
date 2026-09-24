import React from 'react';
import {
  Home,
  Compass,
  Flame,
  ShieldAlert,
  Calendar,
  Bookmark,
  Bell,
  User,
  Settings,
  Plus,
  ShieldCheck
} from 'lucide-react';

export default function LeftSidebar({
  currentTab,
  onSelectTab,
  activeCategory,
  onSelectCategory,
  onOpenCreate,
  unreadNotifs = 0,
  userProfile,
  onOpenSettings
}) {
  const isRadarActive = currentTab === 'feed' && (activeCategory === 'All' || !activeCategory);
  const isTrendingActive = currentTab === 'feed' && activeCategory === 'Trending';
  const isConfessionsActive = currentTab === 'feed' && activeCategory === 'Confessions';
  const isEventsActive = currentTab === 'feed' && activeCategory === 'Events';
  const isExploreActive = currentTab === 'explore';
  const isAlertsActive = currentTab === 'notifications';
  const isSavedActive = currentTab === 'saved';
  const isProfileActive = currentTab === 'profile';
  const isSettingsActive = currentTab === 'settings';
  const isAdminActive = currentTab === 'admin';

  const primaryNavItems = [
    {
      id: 'radar',
      label: 'Radar',
      icon: Home,
      isActive: isRadarActive,
      onClick: () => {
        onSelectTab('feed');
        onSelectCategory('All');
      }
    },
    {
      id: 'explore',
      label: 'Explore',
      icon: Compass,
      isActive: isExploreActive,
      onClick: () => onSelectTab('explore')
    },
    {
      id: 'trending',
      label: 'Trending',
      icon: Flame,
      isActive: isTrendingActive,
      onClick: () => {
        onSelectTab('feed');
        onSelectCategory('Trending');
      }
    },
    {
      id: 'confessions',
      label: 'Confessions',
      icon: ShieldAlert,
      isActive: isConfessionsActive,
      onClick: () => {
        onSelectTab('feed');
        onSelectCategory('Confessions');
      }
    },
    {
      id: 'events',
      label: 'Events',
      icon: Calendar,
      isActive: isEventsActive,
      onClick: () => {
        onSelectTab('feed');
        onSelectCategory('Events');
      }
    },
    {
      id: 'saved',
      label: 'Saved',
      icon: Bookmark,
      isActive: isSavedActive,
      onClick: () => onSelectTab('saved')
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: Bell,
      badge: unreadNotifs > 0 ? unreadNotifs : null,
      isActive: isAlertsActive,
      onClick: () => onSelectTab('notifications')
    }
  ];

  const accountNavItems = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      isActive: isProfileActive,
      onClick: () => onSelectTab('profile')
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      isActive: isSettingsActive,
      onClick: () => onSelectTab('settings')
    }
  ];

  const isStaff = ['admin', 'moderator', 'super_admin'].includes(userProfile?.role?.toLowerCase());

  return (
    <aside className="hidden lg:flex flex-col w-52 lg:w-56 xl:w-60 shrink-0 sticky top-[76px] select-none">
      <div className="space-y-1">
        {/* Primary Navigation */}
        <nav className="space-y-0.5" aria-label="Campus Radar Primary Navigation">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold text-[13px] transition duration-150 active:scale-98 ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-body hover:bg-slate-border/50 hover:text-slate-headline'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      active ? 'bg-white text-primary' : 'bg-tertiary text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Visual separator between navigation and account/settings */}
        <div className="my-2 border-t border-slate-border/70 mx-1" />

        {/* Account & Settings Group */}
        <div className="space-y-0.5">
          {accountNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold text-[13px] transition duration-150 active:scale-98 ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-body hover:bg-slate-border/50 hover:text-slate-headline'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Conditional Admin Portal */}
          {isStaff && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold text-[13px] transition duration-150 ${
                isAdminActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Admin & Analytics</span>
            </button>
          )}
        </div>

        {/* Create CTA Button */}
        <div className="pt-2">
          <button
            onClick={onOpenCreate}
            className="w-full py-2.5 px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[13px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Post</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

