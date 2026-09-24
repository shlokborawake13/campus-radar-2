import React, { useState, useEffect, useCallback } from 'react';
import TopNav from './components/TopNav';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import BottomNav from './components/BottomNav';
import CreateModal from './components/CreateModal';
import CommentsModal from './components/CommentsModal';
import EditPostModal from './components/EditPostModal';
import ReportModal from './components/ReportModal';
import FeedView from './views/FeedView';
import ExploreView from './views/ExploreView';
import NotificationsView from './views/NotificationsView';
import ProfileView from './views/ProfileView';
import SettingsView from './views/SettingsView';
import AuthView from './views/AuthView';
import { apiService } from './services/api';
import { analytics } from './utils/analyticsTracker';

// Code splitting / lazy loading AdminView for optimal student bundle performance
const AdminView = React.lazy(() => import('./views/AdminView'));

export default function App() {
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed' | 'explore' | 'notifications' | 'saved' | 'profile' | 'settings' | 'admin'
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingProfileId, setViewingProfileId] = useState(null);
  
  // Authentication & Session
  const [isAuthenticated, setIsAuthenticated] = useState(!!apiService.getToken());
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Data state
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [trendingTags, setTrendingTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [reportingTarget, setReportingTarget] = useState(null);

  // URL Hash Synchronizer
  const syncHashToState = useCallback(() => {
    const hash = window.location.hash.replace('#', '') || '/radar';
    if (hash.startsWith('/profile/')) {
      const targetId = hash.replace('/profile/', '');
      setViewingProfileId(targetId);
      setCurrentTab('profile');
    } else if (hash === '/explore') {
      setCurrentTab('explore');
    } else if (hash === '/trending') {
      setCurrentTab('feed');
      setActiveCategory('Trending');
    } else if (hash === '/confessions') {
      setCurrentTab('feed');
      setActiveCategory('Confessions');
    } else if (hash === '/events') {
      setCurrentTab('feed');
      setActiveCategory('Events');
    } else if (hash === '/saved') {
      setCurrentTab('saved');
    } else if (hash === '/alerts') {
      setCurrentTab('notifications');
    } else if (hash === '/settings') {
      setCurrentTab('settings');
    } else if (hash === '/admin') {
      setCurrentTab('admin');
    } else if (hash === '/profile') {
      setViewingProfileId(null);
      setCurrentTab('profile');
    } else {
      setCurrentTab('feed');
      setActiveCategory('All');
    }
  }, []);

  useEffect(() => {
    syncHashToState();
    window.addEventListener('popstate', syncHashToState);
    return () => window.removeEventListener('popstate', syncHashToState);
  }, [syncHashToState]);

  // Initialize privacy-preserving client analytics and active duration tracker
  useEffect(() => {
    analytics.init();
  }, []);

  // Track page views on route and view changes
  useEffect(() => {
    if (isAuthenticated) {
      const pageName = currentTab === 'profile' && viewingProfileId
        ? 'profile_user'
        : (currentTab === 'feed' ? `feed_${activeCategory.toLowerCase()}` : currentTab);
      analytics.onPageView(pageName, window.location.hash || window.location.pathname);
    }
  }, [currentTab, activeCategory, viewingProfileId, isAuthenticated]);

  // Listen for unauthorized events to smoothly redirect to Login
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUserProfile(null);
    };
    window.addEventListener('campusradar:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('campusradar:unauthorized', handleUnauthorized);
  }, []);

  // Synchronize avatar updates globally across header, sidebar, and views
  useEffect(() => {
    const handleAvatarUpdated = (e) => {
      const newAvatarUrl = e.detail?.avatarUrl;
      if (newAvatarUrl) {
        setUserProfile(prev => prev ? { ...prev, avatar: newAvatarUrl } : prev);
      }
    };
    window.addEventListener('campusradar:avatar-updated', handleAvatarUpdated);
    return () => window.removeEventListener('campusradar:avatar-updated', handleAvatarUpdated);
  }, []);

  // Tab & Category navigation
  const handleSelectTab = (tab) => {
    if (tab === 'feed') window.location.hash = '/radar';
    else if (tab === 'explore') window.location.hash = '/explore';
    else if (tab === 'notifications') window.location.hash = '/alerts';
    else if (tab === 'saved') window.location.hash = '/saved';
    else if (tab === 'settings') window.location.hash = '/settings';
    else if (tab === 'admin') window.location.hash = '/admin';
    else if (tab === 'profile') {
      setViewingProfileId(null);
      window.location.hash = '/profile';
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectCategory = (cat) => {
    setActiveCategory(cat);
    if (cat === 'Trending') window.location.hash = '/trending';
    else if (cat === 'Confessions') window.location.hash = '/confessions';
    else if (cat === 'Events') window.location.hash = '/events';
    else window.location.hash = '/radar';
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleOpenProfile = (publicProfileId) => {
    setViewingProfileId(publicProfileId);
    window.location.hash = `/profile/${publicProfileId}`;
    setCurrentTab('profile');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Load Feed
  const loadPosts = useCallback(async (cat = activeCategory, search = '') => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const data = await apiService.getPosts({ category: cat, search });
      if (data && data.posts) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.warn('API fetch warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, isAuthenticated]);

  // Load Initial Global Data
  const loadInitialData = async () => {
    const token = apiService.getToken();
    if (!token) {
      setIsAuthenticated(false);
      setIsAuthChecking(false);
      return;
    }

    try {
      const meData = await apiService.getMe();
      if (meData && meData.user) {
        setUserProfile(meData.user);
        setIsAuthenticated(true);

        // Fetch remaining secondary data concurrently
        const [notifsData, savedData] = await Promise.allSettled([
          apiService.getNotifications(),
          apiService.getSavedPosts()
        ]);

        if (notifsData.status === 'fulfilled' && notifsData.value.notifications) {
          setNotifications(notifsData.value.notifications);
        }
        if (savedData.status === 'fulfilled' && savedData.value.savedPosts) {
          setSavedPosts(savedData.value.savedPosts);
        }

        setTrendingTags([
          { tag: '#HackRadar26', count: '1.4k posts', category: 'Events' },
          { tag: '#CentralLibrary', count: '892 posts', category: 'Campus' },
          { tag: '#CS229', count: '650 posts', category: 'Academics' },
          { tag: '#Robotics', count: '420 posts', category: 'Clubs' },
          { tag: '#Confession', count: '310 posts', category: 'Confessions' }
        ]);
      }
    } catch (e) {
      console.warn('Initial session validation error:', e);
      setIsAuthenticated(false);
      setUserProfile(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadPosts(activeCategory, searchQuery);
    }
  }, [activeCategory, isAuthenticated, loadPosts, searchQuery]);

  // Post Actions
  const handleLike = async (id) => {
    let nextLiked = false;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          nextLiked = !p.hasLiked;
          return {
            ...p,
            hasLiked: nextLiked,
            likes: p.likes + (nextLiked ? 1 : -1)
          };
        }
        return p;
      })
    );

    analytics.trackEvent(nextLiked ? 'LIKE' : 'UNLIKE', {
      targetType: 'post',
      targetId: id
    });

    try {
      await apiService.toggleLike(id);
    } catch (err) {
      console.error('Error toggling like:', err);
      loadPosts(activeCategory, searchQuery);
    }
  };

  const handleBookmark = async (id) => {
    let nextBookmarked = false;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          nextBookmarked = !p.hasBookmarked;
          return {
            ...p,
            hasBookmarked: nextBookmarked,
            bookmarksCount: p.bookmarksCount + (nextBookmarked ? 1 : -1)
          };
        }
        return p;
      })
    );

    analytics.trackEvent(nextBookmarked ? 'SAVE' : 'UNSAVE', {
      targetType: 'post',
      targetId: id
    });

    try {
      await apiService.toggleBookmark(id);
      const savedRes = await apiService.getSavedPosts();
      if (savedRes.savedPosts) setSavedPosts(savedRes.savedPosts);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
      loadPosts(activeCategory, searchQuery);
    }
  };

  const handleCreatePost = async (newPostData) => {
    try {
      const created = await apiService.createPost(newPostData);
      if (created.post) {
        setPosts((prev) => [created.post, ...prev]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        analytics.trackEvent('CREATE_POST', {
          targetType: newPostData.category === 'Confession' ? 'confession' : 'post',
          targetId: created.post.id
        });
      }
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    }
  };

  const handleEditPost = (post) => {
    setEditingPost(post);
  };

  const handleSaveEditedPost = async (id, updatedContent) => {
    try {
      await apiService.editPost(id, updatedContent);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, content: updatedContent, isEdited: true } : p
        )
      );
      setEditingPost(null);
    } catch (err) {
      alert('Failed to edit post: ' + err.message);
    }
  };

  const handleDeletePost = async (id) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await apiService.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setSavedPosts((prev) => prev.filter((p) => p.id !== id));
      analytics.trackEvent('DELETE_POST', {
        targetType: 'post',
        targetId: id
      });
    } catch (err) {
      alert('Failed to delete post: ' + err.message);
    }
  };

  const handleHidePost = async (id) => {
    try {
      await apiService.hidePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert('Failed to hide post: ' + err.message);
    }
  };

  const handleBlockUser = async (targetPublicId) => {
    if (!confirm('Are you sure you want to block this student? Their content and interactions will be completely removed.')) return;
    try {
      await apiService.blockUser(targetPublicId);
      loadPosts(activeCategory, searchQuery);
      alert('Student blocked.');
    } catch (err) {
      alert('Failed to block: ' + err.message);
    }
  };

  const handleRegister = (eventId) => {
    alert(`Registration confirmed for event #${eventId}! A pass has been issued.`);
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const handleSelectNotification = (notif) => {
    if (notif.actionUrl) {
      const postId = notif.actionUrl.replace('post-', '');
      const targetPost = posts.find((p) => p.id === postId);
      if (targetPost) {
        setActiveCommentPost(targetPost);
      }
    }
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Render AuthView if not authenticated or loading initial auth
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center animate-bounce">
            <span className="text-xl font-bold">R</span>
          </div>
          <p className="text-[13px] font-semibold text-slate-meta">Initializing Campus Radar...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !userProfile) {
    return (
      <AuthView
        onAuthenticated={(user) => {
          setUserProfile(user);
          setIsAuthenticated(true);
          loadInitialData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-headline flex flex-col selection:bg-emerald-100 overflow-x-hidden">
      {/* Top Navigation Bar: Sticky, Full-Width, 64px compact height */}
      <TopNav
        unreadCount={unreadCount}
        currentTab={currentTab}
        onSearchClick={() => handleSelectTab('explore')}
        onBellClick={() => handleSelectTab('notifications')}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q && currentTab !== 'explore') {
            handleSelectTab('explore');
          }
        }}
        onOpenCreate={() => setIsCreateOpen(true)}
        userProfile={userProfile}
        onProfileClick={() => handleSelectTab('profile')}
      />

      {/* Main Responsive Body Layout */}
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex gap-6 lg:gap-8 justify-center items-start flex-1 min-w-0">
        {/* Left Column: Navigation Sidebar */}
        <LeftSidebar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          onOpenCreate={() => setIsCreateOpen(true)}
          unreadNotifs={unreadCount}
          userProfile={userProfile}
          onOpenSettings={() => handleSelectTab('settings')}
        />

        {/* Center Column: Main Content Feed (Max 740px) */}
        <main className="flex-1 w-full max-w-[740px] min-w-0">
          {currentTab === 'feed' && (
            <FeedView
              posts={posts}
              activeCategory={activeCategory}
              onSelectCategory={handleSelectCategory}
              currentUser={userProfile}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onRegister={handleRegister}
              onOpenComments={setActiveCommentPost}
              onOpenProfile={handleOpenProfile}
              onOpenCreate={() => setIsCreateOpen(true)}
              onEditPost={handleEditPost}
              onDeletePost={handleDeletePost}
              onHidePost={handleHidePost}
              onReportPost={setReportingTarget}
              onBlockUser={handleBlockUser}
              isLoading={isLoading}
              onRefresh={() => loadPosts(activeCategory, searchQuery)}
            />
          )}

          {currentTab === 'explore' && (
            <ExploreView
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              trendingTags={trendingTags}
              onSelectTag={(tag) => {
                setSearchQuery(tag);
                handleSelectTab('explore');
              }}
              searchResults={posts}
              currentUserId={userProfile?.public_profile_id}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onRegister={handleRegister}
              onOpenComments={setActiveCommentPost}
              onOpenProfile={handleOpenProfile}
              onEditPost={handleEditPost}
              onDeletePost={handleDeletePost}
              onHidePost={handleHidePost}
              onReportPost={setReportingTarget}
              onBlockUser={handleBlockUser}
            />
          )}

          {currentTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onSelectNotification={handleSelectNotification}
            />
          )}

          {currentTab === 'saved' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-border shadow-soft-card">
                <h1 className="text-[17px] font-bold text-slate-headline">Saved Bookmarks</h1>
                <p className="text-[12px] text-slate-meta">Posts and discussions you have bookmarked</p>
              </div>
              {savedPosts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-border p-6 shadow-soft-card">
                  <p className="text-[14px] font-bold text-slate-headline">No saved posts yet</p>
                  <p className="text-[12px] text-slate-meta mt-1">Tap the bookmark ribbon on any post to save it here.</p>
                </div>
              ) : (
                savedPosts.map(p => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={userProfile?.public_profile_id}
                    onLike={handleLike}
                    onBookmark={handleBookmark}
                    onOpenComments={setActiveCommentPost}
                    onOpenProfile={handleOpenProfile}
                    onEditPost={handleEditPost}
                    onDeletePost={handleDeletePost}
                    onHidePost={handleHidePost}
                    onReportPost={setReportingTarget}
                    onBlockUser={handleBlockUser}
                  />
                ))
              )}
            </div>
          )}

          {currentTab === 'profile' && (
            <ProfileView
              targetPublicProfileId={viewingProfileId}
              currentUser={userProfile}
              savedPosts={savedPosts}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onRegister={handleRegister}
              onOpenComments={setActiveCommentPost}
              onOpenSettings={() => handleSelectTab('settings')}
              onEditPost={handleEditPost}
              onDeletePost={handleDeletePost}
              onHidePost={handleHidePost}
              onReportPost={setReportingTarget}
              onBlockUser={handleBlockUser}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              user={userProfile}
              onProfileUpdated={loadInitialData}
            />
          )}

          {currentTab === 'admin' && (
            <React.Suspense fallback={<div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">Loading Campus Radar Console...</div>}>
              <AdminView currentUser={userProfile} />
            </React.Suspense>
          )}
        </main>

        {/* Right Column: Widgets Sidebar */}
        <RightSidebar
          trendingTags={trendingTags}
          onSelectTag={(tag) => {
            setSearchQuery(tag);
            handleSelectTab('explore');
          }}
          events={posts.filter((p) => p.type === 'event')}
          onRegister={handleRegister}
          onExploreMore={() => handleSelectTab('explore')}
        />
      </div>

      {/* Bottom Navigation for Mobile & Tablet (< 1024px) */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenCreate={() => setIsCreateOpen(true)}
        unreadNotifs={unreadCount}
      />

      {/* Create Post Modal */}
      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmitPost={handleCreatePost}
      />

      {/* Threaded Comments Modal */}
      <CommentsModal
        isOpen={!!activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        post={activeCommentPost}
        currentUser={userProfile}
        onOpenProfile={handleOpenProfile}
        onReportItem={setReportingTarget}
        onCommentCountChange={(delta) => {
          if (!activeCommentPost) return;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === activeCommentPost.id
                ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) + delta) }
                : p
            )
          );
        }}
      />

      {/* Edit Post Modal */}
      <EditPostModal
        isOpen={!!editingPost}
        onClose={() => setEditingPost(null)}
        post={editingPost}
        onSave={handleSaveEditedPost}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportingTarget}
        onClose={() => setReportingTarget(null)}
        target={reportingTarget}
      />
    </div>
  );
}
