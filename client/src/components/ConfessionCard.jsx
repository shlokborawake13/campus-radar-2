import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Bookmark, ShieldAlert, EyeOff, MoreHorizontal, UserX, Sparkles } from 'lucide-react';

export default function ConfessionCard({ 
  post, 
  onLike, 
  onBookmark, 
  onOpenComments,
  onHidePost,
  onReportPost
}) {
  const [isLiking, setIsLiking] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleLike = () => {
    setIsLiking(true);
    setTimeout(() => setIsLiking(false), 300);
    onLike(post.id);
  };

  return (
    <article className="bg-white rounded-2xl border border-slate-border shadow-soft-card p-4 transition-all duration-200 hover:border-slate-300 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-100 shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[14px] text-slate-headline">
                {post.author.name || 'Anonymous Student'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-primary-dark">
                Masked
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-meta">
              <span>{post.author.handle || '@masked_user'}</span>
              <span>•</span>
              <span>{post.timestamp}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {post.flair && (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-subtle border border-slate-border text-slate-body flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-secondary" />
              {post.flair}
            </span>
          )}

          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-meta hover:text-slate-headline p-1.5 rounded-full hover:bg-slate-subtle transition"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-8 z-30 w-44 bg-white rounded-2xl shadow-xl border border-slate-border py-1.5 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    onBookmark(post.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-headline hover:bg-slate-subtle flex items-center gap-2"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{post.hasBookmarked ? 'Remove Bookmark' : 'Save Confession'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onHidePost) onHidePost(post.id);
                  }}
                  className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-headline hover:bg-slate-subtle flex items-center gap-2"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide from Feed</span>
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onReportPost) onReportPost({ type: 'confession', id: post.id });
                  }}
                  className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Report Confession</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mb-3">
        {post.title && (
          <h2 className="font-bold text-[15px] text-slate-headline mb-1.5 leading-snug">
            "{post.title}"
          </h2>
        )}
        <p className="text-[14px] text-slate-body leading-relaxed whitespace-pre-line bg-surface-container-low/50 p-3 rounded-xl border border-surface-container">
          {post.content}
        </p>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[12px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Engagement */}
      <div className="relative z-10 pt-2 border-t border-slate-border/70 flex items-center justify-between text-slate-meta">
        <div className="flex items-center gap-5">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-[13px] font-semibold transition active:scale-90 ${
              post.hasLiked ? 'text-tertiary' : 'hover:text-tertiary'
            }`}
          >
            <Heart
              className={`w-[18px] h-[18px] ${
                post.hasLiked ? 'fill-tertiary text-tertiary' : ''
              } ${isLiking ? 'animate-heart-pop' : ''}`}
            />
            <span>{post.likes}</span>
          </button>

          <button
            onClick={() => onOpenComments(post)}
            className="flex items-center gap-1.5 text-[13px] font-semibold hover:text-slate-headline transition active:scale-95"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span>{post.commentsCount} replies</span>
          </button>
        </div>

        <button
          onClick={() => onBookmark(post.id)}
          className={`p-1 transition active:scale-90 ${
            post.hasBookmarked ? 'text-primary' : 'hover:text-slate-headline'
          }`}
          title="Save confession"
        >
          <Bookmark className={`w-[19px] h-[19px] ${post.hasBookmarked ? 'fill-primary' : ''}`} />
        </button>
      </div>
    </article>
  );
}
