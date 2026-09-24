import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Users, Check } from 'lucide-react';
import { apiService } from '../services/api';

export default function RightSidebar({
  trendingTags = [],
  onSelectTag,
  events = [],
  onRegister,
  onExploreMore
}) {
  const [organizations, setOrganizations] = useState([]);
  const [pendingOrgId, setPendingOrgId] = useState(null);

  useEffect(() => {
    async function loadOrgs() {
      try {
        const res = await apiService.getOrganizations();
        if (res.organizations) setOrganizations(res.organizations);
      } catch (err) {
        console.error('Failed to load orgs:', err);
      }
    }
    loadOrgs();
  }, []);

  const handleToggleOrgFollow = async (org) => {
    if (pendingOrgId === org.id) return;
    setPendingOrgId(org.id);

    const nextState = !org.isFollowing;
    setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, isFollowing: nextState } : o));

    try {
      await apiService.toggleFollowOrg(org.id, org.isFollowing);
    } catch (err) {
      // Rollback
      setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, isFollowing: !nextState } : o));
      alert('Could not update organization follow: ' + err.message);
    } finally {
      setPendingOrgId(null);
    }
  };

  const upcomingEvents = events.slice(0, 3);

  return (
    <aside className="hidden xl:flex flex-col w-64 xl:w-72 2xl:w-76 shrink-0 sticky top-[68px] h-[calc(100vh-80px)] overflow-y-auto no-scrollbar space-y-6 select-none pb-6">
      {/* 1. Trending on Campus */}
      {trendingTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-border/80">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-secondary" />
              <h3 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                Trending on Campus
              </h3>
            </div>
            {onExploreMore && (
              <button
                onClick={onExploreMore}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                View all
              </button>
            )}
          </div>
          <div className="space-y-1">
            {trendingTags.slice(0, 5).map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectTag && onSelectTag(item.tag)}
                className="w-full py-1.5 px-2 rounded-lg hover:bg-white text-left transition flex items-center justify-between group"
              >
                <div className="min-w-0 pr-2">
                  <span className="text-[12px] font-bold text-slate-headline group-hover:text-secondary truncate block">
                    {item.tag}
                  </span>
                  <span className="text-[10px] text-slate-meta">{item.category}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-meta group-hover:text-secondary shrink-0">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-border/80">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                Upcoming Events
              </h3>
            </div>
            {onExploreMore && (
              <button
                onClick={onExploreMore}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                See all
              </button>
            )}
          </div>
          <div className="space-y-2">
            {upcomingEvents.map((evt) => {
              const eventDate = evt.eventDate || { month: 'OCT', day: '28' };
              return (
                <div
                  key={evt.id}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition"
                >
                  <div className="w-9 h-10 rounded-lg bg-emerald-50 border border-emerald-200/60 flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-[8px] font-black uppercase text-primary leading-none">
                      {eventDate.month}
                    </span>
                    <span className="text-[12px] font-black text-slate-headline leading-tight">
                      {eventDate.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[12px] font-bold text-slate-headline line-clamp-1 leading-snug">
                      {evt.title}
                    </h4>
                    <p className="text-[10px] text-slate-meta truncate mt-0.5">
                      {eventDate.time || 'TBA'} • {eventDate.location || 'Sanjivani Campus'}
                    </p>
                    {onRegister && (
                      <button
                        onClick={() => onRegister(evt.id)}
                        className={`text-[10px] font-bold mt-1 inline-block transition ${
                          evt.isRegistered
                            ? 'text-emerald-700'
                            : 'text-primary hover:underline'
                        }`}
                      >
                        {evt.isRegistered ? '✓ Registered' : '+ Interested'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Student Organizations (Real DB Persistence) */}
      {organizations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-border/80">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-secondary" />
              <h3 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                Student Orgs
              </h3>
            </div>
          </div>
          <div className="space-y-2">
            {organizations.slice(0, 3).map((org) => (
              <div key={org.id} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white transition">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={org.avatar}
                    alt={org.name}
                    className="w-7 h-7 rounded-full object-cover border border-slate-border shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-slate-headline truncate">{org.name}</h4>
                    <p className="text-[9px] text-slate-meta truncate">{org.category} • {org.members}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOrgFollow(org)}
                  disabled={pendingOrgId === org.id}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition shrink-0 ${
                    org.isFollowing
                      ? 'bg-emerald-100 text-primary-dark border border-emerald-300'
                      : 'bg-slate-subtle hover:bg-slate-headline hover:text-white text-slate-headline'
                  }`}
                >
                  {org.isFollowing ? 'Joined' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
