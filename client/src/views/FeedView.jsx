import React from 'react';
import FilterPills from '../components/FilterPills';
import PostCard from '../components/PostCard';
import ConfessionCard from '../components/ConfessionCard';
import EventCard from '../components/EventCard';
import { Sparkles, RefreshCw, UserX } from 'lucide-react';

export default function FeedView({
  posts,
  activeCategory,
  onSelectCategory,
  currentUser,
  onLike,
  onBookmark,
  onRegister,
  onOpenComments,
  onOpenProfile,
  onOpenCreate,
  onEditPost,
  onDeletePost,
  onHidePost,
  onReportPost,
  onBlockUser,
  isLoading,
  onRefresh
}) {
  return (
    <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto">
      {/* Category Pills Header */}
      <FilterPills
        activeCategory={activeCategory}
        onSelectCategory={onSelectCategory}
      />

      {/* Quick Prompt Bar / Composer */}
      <div className="px-4 py-3 bg-white border-b sm:border sm:rounded-2xl border-slate-border/80 flex items-center gap-3 my-3 shadow-soft-card">
        {currentUser?.avatar ? (
          <img
            src={currentUser.avatar}
            alt="My Avatar"
            className="w-8 h-8 rounded-full object-cover border border-slate-border shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-primary-dark font-bold text-[12px] shrink-0">
            <UserX className="w-4 h-4" />
          </div>
        )}
        <button
          onClick={onOpenCreate}
          className="flex-1 text-left px-4 py-2 rounded-full bg-slate-subtle hover:bg-slate-border/50 text-[13px] text-slate-meta font-medium transition truncate"
        >
          Share with campus or post confession...
        </button>
        <button
          onClick={onRefresh}
          className="p-2 rounded-full text-slate-meta hover:text-slate-headline hover:bg-slate-subtle transition active:rotate-180 shrink-0"
          title="Refresh Feed"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Feed Container */}
      <div className="space-y-4 w-full">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-44 bg-slate-200 rounded-2xl" />
            <div className="h-60 bg-slate-200 rounded-2xl" />
            <div className="h-32 bg-slate-200 rounded-2xl" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-border shadow-soft-card">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-primary mx-auto flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-headline mb-1">
              No entries in {activeCategory}
            </h3>
            <p className="text-[13px] text-slate-meta mb-4">
              Be the first student to start the conversation for this topic!
            </p>
            <button
              onClick={onOpenCreate}
              className="px-5 py-2 rounded-full bg-primary hover:bg-primary-hover text-white text-[13px] font-bold shadow-sm transition"
            >
              Post Something
            </button>
          </div>
        ) : (
          posts.map((entry) => {
            if (entry.type === 'confession') {
              return (
                <ConfessionCard
                  key={entry.id}
                  post={entry}
                  onLike={onLike}
                  onBookmark={onBookmark}
                  onOpenComments={onOpenComments}
                  onHidePost={onHidePost}
                  onReportPost={onReportPost}
                />
              );
            }
            if (entry.type === 'event') {
              return (
                <EventCard
                  key={entry.id}
                  post={entry}
                  onBookmark={onBookmark}
                  onRegister={onRegister}
                />
              );
            }
            return (
              <PostCard
                key={entry.id}
                post={entry}
                currentUserId={currentUser?.public_profile_id}
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
          })
        )}
      </div>
    </div>
  );
}
