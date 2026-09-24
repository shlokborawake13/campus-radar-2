import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';

export default function EditPostModal({ isOpen, onClose, post, onSave }) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setContent(post.content || '');
    }
  }, [post]);

  if (!isOpen || !post) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      await onSave(post.id, content.trim());
      onClose();
    } catch (err) {
      alert('Could not update post: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-[16px] text-slate-headline">Edit Post</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-subtle hover:bg-slate-border flex items-center justify-center text-slate-headline"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-headline mb-1.5">Post Content</label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-subtle border border-slate-border text-[14px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-border text-[13px] font-semibold text-slate-body hover:bg-slate-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !content.trim()}
              className="px-5 py-2 rounded-full bg-primary hover:bg-primary-hover text-white text-[13px] font-bold shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
