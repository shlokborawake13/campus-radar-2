import React, { useState, useRef, useEffect } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal,
  Edit,
  Trash2,
  EyeOff,
  ShieldAlert,
  UserX
} from 'lucide-react';

export default function PostCard({
  post,
  currentUserId,
  onLike,
  onBookmark,
  onOpenComments,
  onOpenProfile,
  onEditPost,
  onDeletePost,
  onHidePost,
  onReportPost,
  onBlockUser
}) {
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const images = post.images || [];
  const hasMultipleImages = images.length > 1;
  const isOwn = post.author?.public_profile_id && currentUserId && post.author.public_profile_id === currentUserId;

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

  const handlePrevImg = (e) => {
    e.stopPropagation();
    setCurrentImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImg = (e) => {
    e.stopPropagation();
    setCurrentImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleAuthorClick = () => {
    if (post.author?.public_profile_id && onOpenProfile) {
      onOpenProfile(post.author.public_profile_id);
    }
  };

  return (
    <article className="bg-white rounded-2xl border border-slate-border shadow-soft-card overflow-hidden transition-all duration-200 hover:border-slate-300">
      {/* Header Row */}
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button onClick={handleAuthorClick} className="focus:outline-none shrink-0 group">
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-border group-hover:ring-2 group-hover:ring-primary transition"
            />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAuthorClick}
                className="font-semibold text-[14px] text-slate-headline hover:text-primary transition leading-tight text-left"
              >
                {post.author.name}
              </button>
              {post.author.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-secondary fill-secondary/20" />
              )}
              {post.author.badgeText && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary-fixed text-secondary-dark">
                  {post.author.badgeText}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-meta">
              <button onClick={handleAuthorClick} className="hover:underline">
                {post.author.handle}
              </button>
              <span>•</span>
              <span>{post.timestamp}</span>
              {post.isEdited && (
                <>
                  <span>•</span>
                  <span className="text-[10px] font-medium text-slate-400">Edited</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Menu (Context-Sensitive) */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-slate-meta hover:text-slate-headline p-1.5 rounded-full hover:bg-slate-subtle transition"
            aria-label="Post actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-2xl shadow-xl border border-slate-border py-1.5 animate-in fade-in zoom-in-95">
              {/* Save Post */}
              <button
                onClick={() => {
                  onBookmark(post.id);
                  setIsMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-headline hover:bg-slate-subtle flex items-center gap-2"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{post.hasBookmarked ? 'Remove Bookmark' : 'Save Bookmark'}</span>
              </button>

              {isOwn ? (
                <>
                  {/* Edit Own Post */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onEditPost) onEditPost(post);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-headline hover:bg-slate-subtle flex items-center gap-2"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Post</span>
                  </button>

                  {/* Delete Own Post */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (confirm('Are you sure you want to delete this post?')) {
                        if (onDeletePost) onDeletePost(post.id);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-tertiary hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Post</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Hide Peer Post */}
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

                  {/* Report Post */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onReportPost) onReportPost({ type: 'post', id: post.id });
                    }}
                    className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Report Post</span>
                  </button>

                  {/* Block Author */}
                  {post.author?.public_profile_id && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (confirm(`Block ${post.author.name}? You will no longer see their content or profile.`)) {
                          if (onBlockUser) onBlockUser(post.author.public_profile_id);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-left text-[12px] font-medium text-tertiary hover:bg-red-50 flex items-center gap-2 border-t border-slate-100"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Block Author</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text & Title */}
      <div className="px-3.5 pb-2.5">
        {post.title && (
          <h2 className="font-bold text-[16px] text-slate-headline mb-1 leading-snug">
            {post.title}
          </h2>
        )}
        <p className="text-[14px] text-slate-body leading-relaxed whitespace-pre-line">
          {post.content}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[12px] font-medium text-secondary hover:underline cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media Carousel (if any images) */}
      {images.length > 0 && (
        <div className="relative w-full aspect-[4/3] bg-slate-subtle overflow-hidden select-none">
          <img
            src={images[currentImageIdx]}
            alt={`Post media ${currentImageIdx + 1}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-opacity duration-300"
          />

          {hasMultipleImages && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
              {currentImageIdx + 1}/{images.length}
            </div>
          )}

          {hasMultipleImages && (
            <>
              <button
                onClick={handlePrevImg}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-slate-headline flex items-center justify-center shadow-md backdrop-blur-sm transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextImg}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-slate-headline flex items-center justify-center shadow-md backdrop-blur-sm transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {hasMultipleImages && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === currentImageIdx ? 'w-4 bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagement Row */}
      <div className="px-3.5 py-3 border-t border-slate-border/60 flex items-center justify-between text-slate-meta">
        <div className="flex items-center gap-5">
          {/* Like Button */}
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

          {/* Comment Button */}
          <button
            onClick={() => onOpenComments(post)}
            className="flex items-center gap-1.5 text-[13px] font-semibold hover:text-slate-headline transition active:scale-95"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span>{post.commentsCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: post.title, text: post.content, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Post link copied to clipboard!');
              }
            }}
            className="flex items-center gap-1 text-[13px] hover:text-slate-headline transition"
            title="Share"
          >
            <Share2 className="w-[17px] h-[17px]" />
          </button>
        </div>

        {/* Bookmark */}
        <button
          onClick={() => onBookmark(post.id)}
          className={`p-1 transition active:scale-90 ${
            post.hasBookmarked ? 'text-primary' : 'hover:text-slate-headline'
          }`}
          title="Save post"
        >
          <Bookmark className={`w-[19px] h-[19px] ${post.hasBookmarked ? 'fill-primary' : ''}`} />
        </button>
      </div>
    </article>
  );
}
