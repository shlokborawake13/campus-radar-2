import React, { useState, useEffect } from 'react';
import { X, Send, UserX, Trash2, ShieldAlert, CornerDownRight } from 'lucide-react';
import { apiService } from '../services/api';

export default function CommentsModal({ 
  isOpen, 
  onClose, 
  post, 
  currentUser,
  onOpenProfile,
  onReportItem,
  onCommentCountChange
}) {
  const [commentText, setCommentText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(post?.type === 'confession');
  const [isSending, setIsSending] = useState(false);
  const [comments, setComments] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadThread() {
      if (post && post.id) {
        setIsLoading(true);
        try {
          const res = await apiService.getComments(post.id);
          if (res.comments) {
            setComments(res.comments);
          }
        } catch (err) {
          console.error('Failed to load comments:', err);
        } finally {
          setIsLoading(false);
        }
      }
    }
    if (isOpen) {
      loadThread();
      setIsAnonymous(post?.type === 'confession');
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSending(true);
    try {
      const res = await apiService.addComment(post.id, {
        text: commentText.trim(),
        isAnonymous,
        parent_comment_id: replyingTo ? replyingTo.id : null
      });
      if (res.comment) {
        setComments(prev => [...prev, res.comment]);
        setCommentText('');
        setReplyingTo(null);
        if (onCommentCountChange) onCommentCountChange(1);
      }
    } catch (err) {
      alert('Could not submit comment: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await apiService.deleteComment(post.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (onCommentCountChange) onCommentCountChange(-1);
    } catch (err) {
      alert('Failed to delete comment: ' + err.message);
    }
  };

  // Group top-level and replies
  const topLevelComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div 
        className="w-full sm:max-w-xl md:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-modal-up overflow-hidden flex flex-col h-[80vh] max-h-[680px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[16px] text-slate-headline">Discussion Thread</h3>
            <p className="text-[12px] text-slate-meta line-clamp-1">{post.title || post.content}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-subtle hover:bg-slate-border flex items-center justify-center text-slate-headline transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {isLoading ? (
            <div className="text-center py-12 text-slate-meta animate-pulse">Loading discussion...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-slate-meta">
              <p className="text-[14px]">No replies yet.</p>
              <p className="text-[12px] mt-1">Be the first to share your thoughts!</p>
            </div>
          ) : (
            topLevelComments.map((c) => {
              const replies = getReplies(c.id);
              return (
                <div key={c.id} className="space-y-2">
                  <div className="flex gap-2.5 items-start">
                    {c.isAnonymous ? (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <UserX className="w-4 h-4" />
                      </div>
                    ) : (
                      <button
                        onClick={() => c.public_profile_id && onOpenProfile && onOpenProfile(c.public_profile_id)}
                        className="focus:outline-none shrink-0"
                      >
                        <img
                          src={c.avatar}
                          alt={c.author}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-border hover:ring-2 hover:ring-primary transition"
                        />
                      </button>
                    )}
                    <div className="flex-1 bg-slate-subtle p-3 rounded-2xl">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => c.public_profile_id && onOpenProfile && onOpenProfile(c.public_profile_id)}
                            className="font-bold text-[13px] text-slate-headline hover:text-primary transition text-left"
                          >
                            {c.author}
                          </button>
                          <span className="text-[11px] text-slate-meta">{c.handle}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-meta">{c.timestamp}</span>
                          {c.isOwn && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="text-slate-meta hover:text-tertiary transition p-0.5"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!c.isOwn && (
                            <button
                              onClick={() => onReportItem && onReportItem({ type: 'comment', id: c.id })}
                              className="text-slate-meta hover:text-amber-700 transition p-0.5"
                              title="Report comment"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[13px] text-slate-body leading-relaxed">{c.text}</p>

                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => setReplyingTo(c)}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <CornerDownRight className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Render Nested Replies */}
                  {replies.length > 0 && (
                    <div className="pl-8 space-y-2 border-l-2 border-slate-border/60 ml-4">
                      {replies.map(r => (
                        <div key={r.id} className="flex gap-2 items-start">
                          <img
                            src={r.avatar}
                            alt={r.author}
                            className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-border"
                          />
                          <div className="flex-1 bg-slate-subtle/80 p-2.5 rounded-xl">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-bold text-[12px] text-slate-headline">{r.author}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-meta">{r.timestamp}</span>
                                {r.isOwn && (
                                  <button
                                    onClick={() => handleDeleteComment(r.id)}
                                    className="text-slate-meta hover:text-tertiary transition p-0.5"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-[12px] text-slate-body leading-relaxed">{r.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Reply Box */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-slate-border bg-white">
          {/* Replying banner */}
          {replyingTo && (
            <div className="flex items-center justify-between bg-emerald-50 px-3 py-1 rounded-lg mb-2 text-[11px] text-emerald-900">
              <span>Replying to <strong>{replyingTo.author}</strong></span>
              <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition ${
                isAnonymous
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-subtle text-slate-meta hover:text-slate-headline'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>
                {isAnonymous 
                  ? 'Masked Reply (Anonymous)' 
                  : `Replying as ${currentUser?.display_name || 'Student'}`}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={isAnonymous ? "Say something anonymously..." : "Write a peer reply..."}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 px-4 py-2 rounded-full bg-slate-subtle border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={isSending || !commentText.trim()}
              className="w-9 h-9 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
