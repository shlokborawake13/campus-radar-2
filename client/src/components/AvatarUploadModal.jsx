import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Camera, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Image as ImageIcon 
} from 'lucide-react';
import { apiService } from '../services/api';

export default function AvatarUploadModal({ 
  isOpen, 
  onClose, 
  currentAvatar, 
  onAvatarUpdated 
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // 1. Client-side Size Validation (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large. Maximum file size is 5MB.');
      return;
    }

    // 2. Client-side Type Check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported image format. Please select a JPG, PNG, or WebP image.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSave = async () => {
    if (!selectedFile || isLoading) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiService.uploadAvatar(selectedFile);
      setSuccess('Profile picture updated successfully!');
      
      // Notify parent view and dispatch global event
      if (onAvatarUpdated) {
        onAvatarUpdated(res.avatarUrl);
      }
      window.dispatchEvent(new CustomEvent('campusradar:avatar-updated', {
        detail: { avatarUrl: res.avatarUrl }
      }));

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (isLoading) return;
    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiService.removeAvatar();
      setSuccess('Profile picture removed.');
      
      if (onAvatarUpdated) {
        onAvatarUpdated(res.avatarUrl);
      }
      window.dispatchEvent(new CustomEvent('campusradar:avatar-updated', {
        detail: { avatarUrl: res.avatarUrl }
      }));

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to remove avatar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const displayAvatar = previewUrl || currentAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl border border-slate-border shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-headline">Change Profile Picture</h2>
              <p className="text-[11px] text-slate-meta">Upload a custom avatar from your device</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-meta hover:text-slate-headline transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          {/* Avatar Preview */}
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary ring-4 ring-emerald-100 shadow-soft-card bg-slate-100 flex items-center justify-center">
              <img
                src={displayAvatar}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="absolute bottom-1 right-1 p-2 rounded-full bg-slate-headline hover:bg-slate-800 text-white shadow-lg transition active:scale-95 cursor-pointer"
              title="Select image from device"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Feedback Messages */}
          {error && (
            <div className="w-full p-2.5 rounded-xl bg-red-50 border border-red-200 text-tertiary text-[12px] font-medium flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="w-full p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-primary-dark text-[12px] font-medium flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
              <span>{success}</span>
            </div>
          )}

          {selectedFile ? (
            <div className="w-full p-3 rounded-xl bg-slate-subtle border border-slate-border text-left">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-slate-headline truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <span className="text-slate-meta font-mono">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <p className="text-[11px] text-slate-meta mt-1">
                Will be converted to high-performance WebP and EXIF metadata stripped.
              </p>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 rounded-xl border-2 border-dashed border-slate-border hover:border-primary/50 hover:bg-emerald-50/30 transition cursor-pointer flex flex-col items-center"
            >
              <UploadCloud className="w-6 h-6 text-slate-meta mb-1" />
              <span className="text-[13px] font-bold text-slate-headline">
                Click to browse photo
              </span>
              <span className="text-[11px] text-slate-meta mt-0.5">
                Supports JPG, PNG, or WebP (up to 5MB)
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-2 pt-2">
            {selectedFile ? (
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-[13px] font-bold shadow-emerald-fab flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Optimizing & Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Profile Picture</span>
                  </>
                )}
              </button>
            ) : null}

            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={isLoading}
                className="flex-1 py-2 px-3 rounded-xl border border-red-200 hover:bg-red-50 text-tertiary text-[12px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Avatar</span>
              </button>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-border hover:bg-slate-100 text-slate-body text-[12px] font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
