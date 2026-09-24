import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Sparkles, UserX, Calendar, MapPin, Tag, UploadCloud, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

const PRESET_IMAGES = [
  { label: 'Campus Quad', url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80' },
  { label: 'Library Hall', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&auto=format&fit=crop&q=80' },
  { label: 'Hackathon / Lab', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80' },
  { label: 'Campus Dining', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80' },
];

export default function CreateModal({ isOpen, onClose, onSubmitPost }) {
  const [activeTab, setActiveTab] = useState('post'); // 'post' | 'confession' | 'event'
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Clubs');
  const [flair, setFlair] = useState('Wholesome');
  const [tagInput, setTagInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [eventMonth, setEventMonth] = useState('NOV');
  const [eventDay, setEventDay] = useState('12');
  const [eventTime, setEventTime] = useState('6:00 PM');
  const [eventLocation, setEventLocation] = useState('Memorial Auditorium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPG, PNG, and WebP images are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size exceeds 10MB limit. Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageUrl('');
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Please provide both a title and details.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = imageUrl;

      // Direct device image upload to backend Supabase Storage pipeline
      if (selectedFile) {
        setIsUploading(true);
        try {
          const uploadRes = await apiService.uploadImage(selectedFile);
          finalImageUrl = uploadRes.url;
        } finally {
          setIsUploading(false);
        }
      }

      const tags = tagInput
        ? tagInput.split(',').map((t) => (t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`))
        : [];

      const payload = {
        type: activeTab,
        title: title.trim(),
        content: content.trim(),
        tags,
        images: finalImageUrl ? [finalImageUrl] : [],
        isAnonymous: activeTab === 'confession'
      };

      if (activeTab === 'post') {
        payload.category = category;
      } else if (activeTab === 'confession') {
        payload.category = 'Confessions';
        payload.flair = flair;
      } else if (activeTab === 'event') {
        payload.category = 'Events';
        payload.eventDate = {
          month: eventMonth.toUpperCase(),
          day: eventDay,
          time: eventTime,
          location: eventLocation
        };
      }

      await onSubmitPost(payload);
      // Reset form
      handleRemoveImage();
      setTitle('');
      setContent('');
      setTagInput('');
      onClose();
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-xl md:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-modal-up overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-slate-headline">Create Campus Entry</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-subtle hover:bg-slate-border flex items-center justify-center text-slate-headline transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 p-2 bg-slate-subtle/70 border-b border-slate-border gap-1 text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('post')}
            className={`py-2 rounded-xl transition ${
              activeTab === 'post' ? 'bg-white text-slate-headline shadow-sm' : 'text-slate-meta hover:text-slate-headline'
            }`}
          >
            📸 Feed Post
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confession')}
            className={`py-2 rounded-xl transition ${
              activeTab === 'confession' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-meta hover:text-slate-headline'
            }`}
          >
            🤫 Confession
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('event')}
            className={`py-2 rounded-xl transition ${
              activeTab === 'event' ? 'bg-white text-secondary-dark shadow-sm' : 'text-slate-meta hover:text-slate-headline'
            }`}
          >
            🎉 Event
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Confession Warning / Privacy Banner */}
          {activeTab === 'confession' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[12px]">
              <UserX className="w-5 h-5 text-primary shrink-0" />
              <span>
                <strong>100% Anonymous Mode:</strong> Your name, handle, and avatar will be masked as an anonymous cardinal.
              </span>
            </div>
          )}

          {/* Category / Flair row */}
          {activeTab === 'post' && (
            <div>
              <label className="block text-[12px] font-semibold text-slate-meta mb-1">Campus Topic</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-subtle border border-slate-border text-[13px] font-medium text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Clubs">🏆 Clubs & Student Orgs</option>
                <option value="Academics">📚 Academics & Study Groups</option>
                <option value="Campus Life">🌲 Campus Life</option>
                <option value="Housing">🏠 Housing & Roommates</option>
              </select>
            </div>
          )}

          {activeTab === 'confession' && (
            <div>
              <label className="block text-[12px] font-semibold text-slate-meta mb-1">Confession Flair</label>
              <div className="flex flex-wrap gap-2">
                {['Wholesome', 'Deep Thoughts', 'Roommate Drama', 'Finals', 'Campus Crush'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlair(f)}
                    className={`px-3 py-1 rounded-full text-[12px] font-semibold border transition ${
                      flair === f
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-subtle border-slate-border text-slate-body hover:bg-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Event Specific Fields */}
          {activeTab === 'event' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">Month & Day</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="OCT"
                    value={eventMonth}
                    onChange={(e) => setEventMonth(e.target.value)}
                    className="w-1/2 px-2 py-1.5 rounded-lg border border-indigo-200 text-[13px] text-center uppercase font-bold"
                  />
                  <input
                    type="text"
                    placeholder="28"
                    value={eventDay}
                    onChange={(e) => setEventDay(e.target.value)}
                    className="w-1/2 px-2 py-1.5 rounded-lg border border-indigo-200 text-[13px] text-center font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">Time</label>
                <input
                  type="text"
                  placeholder="6:00 PM"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 text-[13px]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-secondary mb-1">Campus Location</label>
                <input
                  type="text"
                  placeholder="White Plaza or Old Union 102"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 text-[13px]"
                />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-meta mb-1">
              {activeTab === 'confession' ? 'Confession Heading' : 'Headline'}
            </label>
            <input
              type="text"
              required
              placeholder={
                activeTab === 'confession'
                  ? 'e.g. To the person in Meyer Green at midnight...'
                  : activeTab === 'event'
                  ? 'e.g. Midnight Pancake Study Jam 🥞'
                  : 'Catchy headline...'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-subtle border border-slate-border text-[14px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-meta mb-1">
              {activeTab === 'confession' ? 'Confession Details' : 'Description / Discussion'}
            </label>
            <textarea
              required
              rows={4}
              placeholder={
                activeTab === 'confession'
                  ? 'Pour your heart out, tell your story, or share campus wisdom...'
                  : 'Write what students need to know...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-subtle border border-slate-border text-[14px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Device Image Upload for Posts/Events */}
          {activeTab !== 'confession' && (
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold text-slate-meta flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Attach Photo</span>
                </span>
                <span className="text-[11px] text-slate-meta font-normal">JPG, PNG, WebP (Max 10MB)</span>
              </label>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Preview or Upload Dropzone */}
              {previewUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-border group bg-slate-subtle">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-2xl"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-full bg-white text-slate-headline text-[12px] font-bold shadow-md hover:bg-slate-100 transition"
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-md transition"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Photo attached</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-border hover:border-primary/60 bg-slate-subtle/50 hover:bg-emerald-50/30 transition flex flex-col items-center justify-center gap-1.5 text-slate-meta hover:text-slate-headline cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-border group-hover:border-primary/40 flex items-center justify-center text-primary transition shadow-sm">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-bold text-slate-headline">Upload image from device</p>
                      <p className="text-[11px] text-slate-meta">Click to browse your camera roll or device files</p>
                    </div>
                  </button>

                  {/* Campus Presets */}
                  <div>
                    <p className="text-[11px] text-slate-meta font-medium mb-1">Or choose a campus preset:</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {PRESET_IMAGES.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            handleRemoveImage();
                            setImageUrl(preset.url);
                            setPreviewUrl(preset.url);
                          }}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition ${
                            imageUrl === preset.url
                              ? 'bg-primary text-white border-primary'
                              : 'bg-slate-subtle border-slate-border text-slate-body hover:bg-slate-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-meta mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Hashtags (comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="Midterms, Robotics, SanjivaniVibes"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-subtle border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="w-full py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab transition duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading photo to secure storage...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing to Campus...</span>
                </>
              ) : (
                <span>Broadcast {activeTab === 'confession' ? 'Anonymous Confession' : activeTab === 'event' ? 'Event' : 'Post'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
