import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Award, 
  Shield, 
  Settings, 
  Calendar, 
  CheckCircle2, 
  UserPlus, 
  UserCheck, 
  FileText, 
  Sparkles,
  Camera
} from 'lucide-react';
import PostCard from '../components/PostCard';
import ConfessionCard from '../components/ConfessionCard';
import EventCard from '../components/EventCard';
import AvatarUploadModal from '../components/AvatarUploadModal';
import { apiService } from '../services/api';

export default function ProfileView({
  targetPublicProfileId,
  currentUser,
  savedPosts = [],
  onLike,
  onBookmark,
  onRegister,
  onOpenComments,
  onOpenSettings,
  onEditPost,
  onDeletePost,
  onHidePost,
  onReportPost,
  onBlockUser
}) {
  const [profileData, setProfileData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('posts'); // 'posts' | 'saved'
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [error, setError] = useState(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const isOwnProfile = !targetPublicProfileId || targetPublicProfileId === currentUser?.public_profile_id;
  const profileIdToLoad = targetPublicProfileId || currentUser?.public_profile_id;

  const handleAvatarUpdated = (newAvatarUrl) => {
    setProfileData(prev => prev ? { ...prev, avatar: newAvatarUrl } : prev);
  };

  useEffect(() => {
    async function loadProfile() {
      if (!profileIdToLoad) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiService.getPublicProfile(profileIdToLoad);
        if (res.profile) {
          setProfileData(res.profile);
          setIsFollowing(!!res.profile.isFollowing);
          setFollowersCount(res.profile.followersCount || 0);
          setFollowingCount(res.profile.followingCount || 0);
        }
        if (res.posts) {
          setUserPosts(res.posts);
        }
      } catch (err) {
        setError(err.message || 'This profile is unavailable.');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [profileIdToLoad]);

  const handleToggleFollow = async () => {
    if (!profileData || isFollowPending) return;

    const nextFollow = !isFollowing;
    setIsFollowing(nextFollow);
    setFollowersCount(prev => prev + (nextFollow ? 1 : -1));
    setIsFollowPending(true);

    try {
      if (nextFollow) {
        await apiService.followProfile(profileData.public_profile_id);
      } else {
        await apiService.unfollowProfile(profileData.public_profile_id);
      }
    } catch (err) {
      // Rollback on failure
      setIsFollowing(!nextFollow);
      setFollowersCount(prev => prev + (!nextFollow ? 1 : -1));
      alert('Action failed: ' + err.message);
    } finally {
      setIsFollowPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto space-y-4 animate-pulse">
        <div className="bg-white rounded-2xl border border-slate-border p-6 h-48" />
        <div className="bg-white rounded-2xl border border-slate-border p-6 h-32" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto">
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-border p-6 shadow-soft-card">
          <Shield className="w-10 h-10 text-slate-meta mx-auto mb-3" />
          <h2 className="text-[17px] font-bold text-slate-headline mb-1">Profile Unavailable</h2>
          <p className="text-[13px] text-slate-meta max-w-sm mx-auto">
            {error || 'This student profile could not be loaded or has been restricted by privacy settings.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto">
      {/* Profile Header Card */}
      <div className="bg-white border-b sm:border sm:rounded-2xl border-slate-border p-5 shadow-soft-card mb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <img
                src={profileData.avatar}
                alt={profileData.display_name}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary ring-2 ring-emerald-100"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-primary border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white">
                ✓
              </span>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                  title="Change Profile Picture"
                >
                  <Camera className="w-5 h-5 drop-shadow" />
                </button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[17px] font-bold text-slate-headline">{profileData.display_name}</h2>
                <CheckCircle2 className="w-4 h-4 text-primary fill-primary/10" />
              </div>
              <p className="text-[12px] text-slate-meta">{profileData.handle} • {profileData.campus}</p>
              {(profileData.department || profileData.year) && (
                <p className="text-[12px] font-medium text-secondary mt-0.5">
                  {[profileData.department, profileData.year].filter(Boolean).join(' • ')}
                </p>
              )}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-hover hover:underline cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  <span>Change Profile Picture</span>
                </button>
              )}
            </div>
          </div>

          {/* Action: Follow / Unfollow OR Edit Settings */}
          {isOwnProfile ? (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full bg-slate-subtle hover:bg-slate-border text-slate-headline"
              title="Settings & Privacy"
            >
              <Settings className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleToggleFollow}
              disabled={isFollowPending}
              className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition duration-200 active:scale-95 flex items-center gap-1.5 shadow-sm ${
                isFollowing
                  ? 'bg-slate-subtle text-slate-headline hover:bg-slate-200 border border-slate-border'
                  : 'bg-primary hover:bg-primary-hover text-white'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Bio (Conditional on privacy settings) */}
        {profileData.bio && (
          <p className="text-[13px] text-slate-body mt-3 leading-relaxed">
            {profileData.bio}
          </p>
        )}

        {/* Stats Grid: Real Database Counts! */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-border/70 text-center">
          <div className="p-2 rounded-xl bg-slate-subtle">
            <span className="block text-[15px] font-black text-slate-headline">{followersCount}</span>
            <span className="text-[10px] font-semibold text-slate-meta">Followers</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-subtle">
            <span className="block text-[15px] font-black text-slate-headline">{followingCount}</span>
            <span className="text-[10px] font-semibold text-slate-meta">Following</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-subtle">
            <span className="block text-[15px] font-black text-slate-headline">{profileData.postsCount || userPosts.length}</span>
            <span className="text-[10px] font-semibold text-slate-meta">Posts</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-subtle">
            <span className="block text-[15px] font-black text-slate-headline">{profileData.karma}</span>
            <span className="text-[10px] font-semibold text-slate-meta">Karma</span>
          </div>
        </div>

        {/* Badges Pill Row */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profileData.badges && profileData.badges.map((badge, idx) => (
            <span
              key={idx}
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-primary-dark border border-emerald-200 flex items-center gap-1"
            >
              <Award className="w-3 h-3 text-primary" />
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className={`grid ${isOwnProfile ? 'grid-cols-2' : 'grid-cols-1'} bg-white border-b sm:border sm:rounded-2xl border-slate-border text-[13px] font-bold overflow-hidden shadow-soft-card mb-3`}>
        <button
          onClick={() => setActiveSubTab('posts')}
          className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeSubTab === 'posts'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-meta hover:text-slate-headline'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Public Posts ({userPosts.length})</span>
        </button>

        {isOwnProfile && (
          <button
            onClick={() => setActiveSubTab('saved')}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeSubTab === 'saved'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-meta hover:text-slate-headline'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved Bookmarks ({savedPosts.length})</span>
          </button>
        )}
      </div>

      {/* Content Rendering */}
      <div className="space-y-4">
        {activeSubTab === 'posts' ? (
          userPosts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-border p-6 shadow-soft-card">
              <Sparkles className="w-8 h-8 text-slate-meta mx-auto mb-2" />
              <p className="text-[14px] font-bold text-slate-headline">No public posts yet</p>
              <p className="text-[12px] text-slate-meta mt-1">
                Posts published by this student will appear here.
              </p>
            </div>
          ) : (
            userPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUser?.public_profile_id}
                onLike={onLike}
                onBookmark={onBookmark}
                onOpenComments={onOpenComments}
                onEditPost={onEditPost}
                onDeletePost={onDeletePost}
                onHidePost={onHidePost}
                onReportPost={onReportPost}
                onBlockUser={onBlockUser}
              />
            ))
          )
        ) : (
          savedPosts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-border p-6 shadow-soft-card">
              <Bookmark className="w-8 h-8 text-slate-meta mx-auto mb-2" />
              <p className="text-[14px] font-bold text-slate-headline">No saved posts yet</p>
              <p className="text-[12px] text-slate-meta mt-1">
                Save interesting posts and announcements by clicking the bookmark ribbon.
              </p>
            </div>
          ) : (
            savedPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUser?.public_profile_id}
                onLike={onLike}
                onBookmark={onBookmark}
                onOpenComments={onOpenComments}
                onEditPost={onEditPost}
                onDeletePost={onDeletePost}
                onHidePost={onHidePost}
                onReportPost={onReportPost}
                onBlockUser={onBlockUser}
              />
            ))
          )
        )}
      </div>

      {/* Profile Picture Upload & Replace Modal */}
      {isOwnProfile && (
        <AvatarUploadModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          currentAvatar={profileData.avatar}
          onAvatarUpdated={handleAvatarUpdated}
        />
      )}
    </div>
  );
}
