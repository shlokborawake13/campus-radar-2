import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';

/**
 * ProtectedAdminRoute
 * Defense-in-depth client-side route guard:
 * 1. If checking auth: renders clean neutral loading state with ZERO admin UI leakage
 * 2. If unauthenticated: redirects to login
 * 3. If authenticated student (non-admin): renders a generic 404 Not Found page with no admin leakage
 * 4. Only renders children (AdminView) if server-verified admin role is present
 */
export default function ProtectedAdminRoute({
  currentUser,
  isAuthenticated,
  isAuthChecking,
  onRedirectHome,
  children
}) {
  // 1. Loading state: neutral, no admin UI or layout rendered
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-slate-meta font-medium">Checking authorization...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: prompt sign-in / redirect home
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] w-full px-4">
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-border p-8 max-w-md w-full shadow-soft-card">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-headline mb-1">Sign In Required</h2>
          <p className="text-xs text-slate-meta mb-6">
            Please sign in with your verified Sanjivani University credentials to continue.
          </p>
          <button
            onClick={() => {
              if (onRedirectHome) onRedirectHome();
              else window.location.hash = '/radar';
            }}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // 3. Authenticated Student (Non-Admin): Strict Generic 404 Not Found
  // Never reveals that this is an admin route, never leaks admin interface or buttons
  const isAuthorizedAdmin = ['admin', 'super_admin'].includes(currentUser?.role?.toLowerCase());

  if (!isAuthorizedAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4 py-12">
        <div className="text-center py-16 px-6 bg-white rounded-3xl border border-slate-border max-w-md w-full shadow-soft-card">
          <div className="w-14 h-14 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <AlertCircle className="w-7 h-7 stroke-[1.75]" />
          </div>
          <h1 className="text-2xl font-black text-slate-headline mb-2 tracking-tight">404</h1>
          <h2 className="text-sm font-bold text-slate-headline mb-1">Page Not Found</h2>
          <p className="text-xs text-slate-meta max-w-xs mx-auto mb-6 leading-relaxed">
            The page you are looking for does not exist, has been removed, or is temporarily unavailable.
          </p>
          <button
            onClick={() => {
              if (onRedirectHome) onRedirectHome();
              else {
                window.location.hash = '/radar';
                window.history.replaceState(null, '', '/#/radar');
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition duration-150 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Feed</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Authorized Admin: Render admin view
  return children;
}
