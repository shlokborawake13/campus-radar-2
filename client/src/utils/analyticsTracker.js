/**
 * Campus Radar — Privacy-Preserving Client Analytics & Active Time Tracker
 * 
 * Rules:
 * 1. Accurately tracks active time using visibilitychange and blur/focus.
 * 2. Pauses timers when tab is hidden, inactive, or backgrounded.
 * 3. Never captures typed keystrokes, passwords, OTPs, or private inputs.
 * 4. Captures semantic clicks (buttons, tabs, navigation) via data-track attributes or button elements.
 * 5. Buffers and flushes telemetry gracefully via fetch and navigator.sendBeacon.
 */

class AnalyticsTracker {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.currentPage = null;
    this.currentRoute = null;
    this.pageEnteredAt = null;
    this.activeTimeMs = 0;
    this.lastActiveTimestamp = null;
    this.isTabActive = !document.hidden;
    this.eventBuffer = [];
    this.heartbeatTimer = null;
    this.initialized = false;
  }

  getOrCreateSessionId() {
    try {
      let sid = sessionStorage.getItem('cr_analytics_session_id');
      if (!sid) {
        sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('cr_analytics_session_id', sid);
      }
      return sid;
    } catch {
      return 'sess_' + Date.now();
    }
  }

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Visibility & Tab Focus Listeners (Active Time Precision)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseActiveTimer();
      } else {
        this.resumeActiveTimer();
      }
    });

    window.addEventListener('blur', () => {
      this.pauseActiveTimer();
    });

    window.addEventListener('focus', () => {
      this.resumeActiveTimer();
    });

    // 2. Unload / Page Exit Flush
    window.addEventListener('beforeunload', () => {
      this.recordPageExit();
      this.flush(true);
    });

    // 3. Heartbeat every 30 seconds to flush active duration
    this.heartbeatTimer = setInterval(() => {
      if (this.isTabActive && this.currentPage) {
        this.accumulateActiveTime();
        this.flush();
      }
    }, 30000);

    // 4. Global Semantic Click Tracker
    document.addEventListener('click', (e) => {
      try {
        const target = e.target.closest('button, a, [role="button"], [data-track]');
        if (!target) return;

        // Skip sensitive inputs completely
        const tagName = target.tagName.toLowerCase();
        if (target.type === 'password' || target.getAttribute('autocomplete')?.includes('one-time-code')) {
          return;
        }

        const trackName = target.getAttribute('data-track') || target.getAttribute('aria-label') || target.id || target.name || target.textContent?.trim().slice(0, 30);
        if (trackName) {
          this.trackEvent('CLICK', {
            elementId: target.id || null,
            targetType: tagName,
            targetId: trackName.slice(0, 50),
            metadata: {
              className: target.className ? String(target.className).slice(0, 50) : null
            }
          });
        }
      } catch (err) {
        // Telemetry must never crash UI
      }
    }, { passive: true });
  }

  pauseActiveTimer() {
    this.accumulateActiveTime();
    this.isTabActive = false;
  }

  resumeActiveTimer() {
    this.lastActiveTimestamp = Date.now();
    this.isTabActive = true;
  }

  accumulateActiveTime() {
    if (this.isTabActive && this.lastActiveTimestamp) {
      const now = Date.now();
      const elapsed = Math.max(0, now - this.lastActiveTimestamp);
      this.activeTimeMs += elapsed;
      this.lastActiveTimestamp = now;
    }
  }

  // Called whenever user navigates between views
  onPageView(pageName, route = window.location.pathname) {
    if (this.currentPage) {
      this.recordPageExit();
    }

    this.currentPage = pageName;
    this.currentRoute = route;
    this.pageEnteredAt = Date.now();
    this.activeTimeMs = 0;
    this.lastActiveTimestamp = this.isTabActive ? Date.now() : null;

    this.trackEvent('PAGE_VIEW', {
      page: pageName,
      route: route,
      enteredAt: new Date(this.pageEnteredAt).toISOString()
    });

    this.flush();
  }

  recordPageExit() {
    if (!this.currentPage || !this.pageEnteredAt) return;

    this.accumulateActiveTime();
    const exitedAt = Date.now();
    const totalDurationMs = Math.max(0, exitedAt - this.pageEnteredAt);
    const activeDurationMs = this.activeTimeMs;

    const payload = {
      type: 'PAGE_EXIT',
      page: this.currentPage,
      route: this.currentRoute,
      enteredAt: new Date(this.pageEnteredAt).toISOString(),
      exitedAt: new Date(exitedAt).toISOString(),
      activeDurationMs,
      totalDurationMs,
      sessionId: this.sessionId
    };

    this.eventBuffer.push(payload);
    this.currentPage = null;
    this.pageEnteredAt = null;
    this.activeTimeMs = 0;
  }

  trackEvent(eventType, details = {}) {
    // Zero-Leakage: explicitly delete any accidentally passed sensitive keys
    const cleanMeta = { ...(details.metadata || {}) };
    delete cleanMeta.password;
    delete cleanMeta.otp;
    delete cleanMeta.token;
    delete cleanMeta.jwt;
    delete cleanMeta.secret;

    const event = {
      eventType,
      page: details.page || this.currentPage || 'app',
      route: details.route || this.currentRoute || window.location.pathname,
      elementId: details.elementId || null,
      targetType: details.targetType || null,
      targetId: details.targetId || null,
      metadata: cleanMeta,
      timestamp: new Date().toISOString()
    };

    this.eventBuffer.push(event);

    // Auto flush if buffer exceeds 10 items
    if (this.eventBuffer.length >= 10) {
      this.flush();
    }
  }

  flush(useBeacon = false) {
    if (this.eventBuffer.length === 0 && !this.currentPage) return;

    this.accumulateActiveTime();

    const eventsToSend = [...this.eventBuffer];
    this.eventBuffer = [];

    const body = JSON.stringify({
      sessionId: this.sessionId,
      page: this.currentPage,
      route: this.currentRoute,
      activeDurationMs: this.activeTimeMs,
      totalDurationMs: this.pageEnteredAt ? Math.max(0, Date.now() - this.pageEnteredAt) : 0,
      events: eventsToSend
    });

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('campusradar_token') : null;

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
    } else {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body,
        keepalive: true
      }).catch(() => {
        // Non-blocking telemetry
      });
    }
  }
}

export const analytics = new AnalyticsTracker();
