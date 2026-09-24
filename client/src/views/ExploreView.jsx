import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, TrendingUp, Users, Sparkles, UserCheck, UserPlus } from 'lucide-react';
import PostCard from '../components/PostCard';
import ConfessionCard from '../components/ConfessionCard';
import EventCard from '../components/EventCard';
import { apiService } from '../services/api';

export default function ExploreView({
  searchQuery,
  onSearchChange,
  trendingTags = [],
  onSelectTag,
  searchResults = [],
  currentUserId,
  onLike,
  onBookmark,
  onRegister,
  onOpenComments,
  onOpenProfile,
  onEditPost,
  onDeletePost,
  onHidePost,
  onReportPost,
  onBlockUser
}) {
  const [organizations, setOrganizations] = useState([]);
  const [searchPeople, setSearchPeople] = useState([]);
  const [pendingOrgId, setPendingOrgId] = useState(null);

  useEffect(() => {
    async function loadOrgs() {
      try {
        const res = await apiService.getOrganizations();
        if (res.organizations) setOrganizations(res.organizations);
      } catch (err) {
        console.error('Failed to load explore orgs:', err);
      }
    }
    loadOrgs();
  }, []);

  // When search query is entered, perform global public search
  useEffect(() => {
    let active = true;
    async function doSearch() {
      if (!searchQuery || searchQuery.trim().length === 0) {
        setSearchPeople([]);
        return;
      }
      try {
        const res = await apiService.search(searchQuery.trim());
        if (active && res.people) {
          setSearchPeople(res.people);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }
    const timer = setTimeout(doSearch, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleToggleOrgFollow = async (org) => {
    if (pendingOrgId === org.id) return;
    setPendingOrgId(org.id);

    const nextState = !org.isFollowing;
    setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, isFollowing: nextState } : o));

    try {
      await apiService.toggleFollowOrg(org.id, org.isFollowing);
    } catch (err) {
      setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, isFollowing: !nextState } : o));
      alert('Could not follow club: ' + err.message);
    } finally {
      setPendingOrgId(null);
    }
  };

  const renderCard = (post) => {
    if (post.type === 'confession') {
      return (
        <ConfessionCard
          key={post.id}
          post={post}
          onLike={onLike}
          onBookmark={onBookmark}
          onOpenComments={onOpenComments}
          onHidePost={onHidePost}
          onReportPost={onReportPost}
        />
      );
    }
    if (post.type === 'event') {
      return (
        <EventCard
          key={post.id}
          post={post}
          onBookmark={onBookmark}
          onRegister={onRegister}
        />
      );
    }
    return (
      <PostCard
        key={post.id}
        post={post}
        currentUserId={currentUserId}
        onLike={onLike}
        onBookmark={onBookmark}
        onOpenComments={onOpenComments}
        onOpenProfile={onOpenProfile}
        onEditPost={onEditPost}
        onDeletePost={onDeletePost}
        onHidePost={onHidePost}
        onReportPost={onReportPost}
        onBlockUser={onBlockUser}
      />
    );
  };

  return (
    <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto space-y-5">
      {/* If Search Active: Render People & Posts */}
      {searchQuery ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-[16px] font-bold text-slate-headline">
                Results for "{searchQuery}"
              </h2>
              <p className="text-[12px] text-slate-meta">
                Searching public profiles, tags, and conversations
              </p>
            </div>
            <button
              onClick={() => onSearchChange && onSearchChange('')}
              className="text-[12px] font-bold text-primary hover:underline px-2 py-1"
            >
              Clear Search
            </button>
          </div>

          {/* Discovered Students (Public Identity Only!) */}
          {searchPeople.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-3">
              <h3 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                Students
              </h3>
              <div className="divide-y divide-slate-border/50">
                {searchPeople.map(p => (
                  <div key={p.public_profile_id} className="py-2.5 flex items-center justify-between">
                    <button
                      onClick={() => onOpenProfile && onOpenProfile(p.public_profile_id)}
                      className="flex items-center gap-3 text-left focus:outline-none group"
                    >
                      <img
                        src={p.avatar}
                        alt={p.display_name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-border group-hover:ring-2 group-hover:ring-primary transition"
                      />
                      <div>
                        <h4 className="text-[13px] font-bold text-slate-headline group-hover:text-primary transition">
                          {p.display_name}
                        </h4>
                        <p className="text-[11px] text-slate-meta">
                          {p.handle} {p.department ? `• ${p.department}` : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => onOpenProfile && onOpenProfile(p.public_profile_id)}
                      className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-subtle hover:bg-slate-200 text-slate-headline"
                    >
                      View Profile
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discovered Posts */}
          {searchResults.length === 0 && searchPeople.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-border p-6 shadow-soft-card">
              <p className="text-[15px] font-bold text-slate-headline">No matching public results found</p>
              <p className="text-[12px] text-slate-meta mt-1">
                Try searching for #Robotics, #Academics, or a student handle like @anon103.
              </p>
            </div>
          ) : (
            searchResults.map(renderCard)
          )}
        </div>
      ) : (
        /* Explore Home: Social Discovery Feed */
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div>
              <h1 className="text-[18px] font-bold text-slate-headline tracking-tight">
                Explore Campus
              </h1>
              <p className="text-[12px] text-slate-meta">
                Trending conversations, clubs, and popular campus moments
              </p>
            </div>
          </div>

          {/* 1. Trending Tags */}
          {trendingTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <TrendingUp className="w-4 h-4 text-secondary" />
                <h2 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                  Trending on Campus
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingTags.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectTag && onSelectTag(item.tag)}
                    className="px-3 py-1.5 rounded-full bg-white border border-slate-border hover:border-secondary hover:bg-indigo-50/50 shadow-sm text-left transition flex items-center gap-2 text-[12px] active:scale-95"
                  >
                    <span className="font-bold text-slate-headline">{item.tag}</span>
                    <span className="text-[11px] font-semibold text-secondary">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Verified Student Orgs (Real DB Persistence) */}
          {organizations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h2 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                    Featured Student Orgs
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {organizations.slice(0, 3).map((org) => (
                  <div
                    key={org.id}
                    className="bg-white border border-slate-border rounded-2xl p-3 shadow-soft-card flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <img
                        src={org.avatar}
                        alt={org.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-border shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[12px] font-bold text-slate-headline truncate">
                          {org.name}
                        </h3>
                        <p className="text-[10px] text-slate-meta truncate">{org.category} • {org.members}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleOrgFollow(org)}
                      disabled={pendingOrgId === org.id}
                      className={`w-full py-1 rounded-full text-[11px] font-bold transition active:scale-95 ${
                        org.isFollowing
                          ? 'bg-emerald-100 text-primary-dark border border-emerald-300'
                          : 'bg-slate-headline text-white hover:bg-slate-800'
                      }`}
                    >
                      {org.isFollowing ? 'Joined' : 'Join'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Popular on Campus */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h2 className="text-[13px] font-bold text-slate-headline uppercase tracking-wider">
                Popular on Campus
              </h2>
            </div>
            <div className="space-y-4">
              {searchResults.map(renderCard)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
