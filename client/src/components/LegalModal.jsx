import React, { useState } from 'react';
import { X, Shield, FileText, Lock, CheckCircle2 } from 'lucide-react';

export default function LegalModal({ isOpen, onClose, initialTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'terms' | 'privacy'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl border border-slate-border shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              {activeTab === 'terms' ? <FileText className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-headline leading-tight">
                {activeTab === 'terms' ? 'Campus Radar — Terms of Service' : 'Campus Radar — Privacy Policy'}
              </h2>
              <p className="text-[11px] text-slate-meta mt-0.5">
                Last Updated: 25 September 2026 • Sanjivani University
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-meta hover:text-slate-headline transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-border bg-slate-100/70 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-[12px] font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'terms'
                ? 'bg-white text-slate-headline shadow-sm'
                : 'text-slate-meta hover:text-slate-headline'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-[12px] font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-white text-slate-headline shadow-sm'
                : 'text-slate-meta hover:text-slate-headline'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-[13px] text-slate-body leading-relaxed">
          {activeTab === 'terms' ? (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-primary-dark text-[12px]">
                Welcome to <strong>Campus Radar</strong> — a student-focused social platform designed for students of Sanjivani University to discover campus activities, share posts, participate in discussions, share confessions, and engage with the campus community.
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">1. Eligibility</h3>
                <p>Campus Radar is intended primarily for students of Sanjivani University. To create an account, you must provide your official Sanjivani University email address (@sanjivani.edu.in), phone number, name, department, and create a strong password. You must not impersonate another person.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">2. Account Registration & Security</h3>
                <p>You are responsible for maintaining the confidentiality of your authentication credentials. You must use your own official university email and phone number. Campus Radar administrators will never ask you for your password or OTP.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">3. Account Verification</h3>
                <p>Campus Radar enforces verified email and phone OTPs. Verification codes are temporary and must not be shared. Duplicate or fraudulent accounts will be restricted.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">4. Public and Anonymous Identity</h3>
                <p>Campus Radar features an anonymous public pseudonym mask system. Your real name, email, and phone number are strictly private and not displayed to ordinary students. You must not attempt to discover, expose, or publish another student's private identity.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">5. User Content & Images</h3>
                <p>You remain responsible for content you upload. You must not upload content that infringes copyright, contains malware, harasses others, reveals private student information, or contains unlawful material. When uploading an image, you confirm you have the right to share it.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">6. Prohibited Activities</h3>
                <p>You may not guess passwords, circumvent authentication, attempt IDOR/BOLA attacks, scrape private student records, circumvent rate limits, abuse OTP systems, or attempt to access administrative tools without authorization.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">7. Content Moderation & Reporting</h3>
                <p>Campus Radar may remove posts, comments, confessions, or images, and suspend accounts that violate these Terms or community guidelines. Students may report inappropriate content for review.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">8. Intellectual Property & License</h3>
                <p>You grant Campus Radar a limited license to host, store, display, and process your content as reasonably necessary to operate the platform. Campus Radar branding, software, and design are protected.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">9. Contact Information</h3>
                <p>For questions or account-related inquiries: Campus Radar Support, Sanjivani University, Kopargaon. Email: support@sanjivani.edu.in</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[12px]">
                This Privacy Policy explains how Campus Radar collects, uses, stores, and protects personal information under applicable data protection frameworks including India's Digital Personal Data Protection (DPDP) Act.
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">1. Information We Collect</h3>
                <p>We collect your full name, Sanjivani University email address (@sanjivani.edu.in), phone number, department, password hash (OWASP-compliant scrypt), and public profile mask. Passwords are never stored in plaintext.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">2. Verification & OTP Information</h3>
                <p>We process temporary email and SMS OTPs for account verification. Actual OTP values are securely hashed in the database, expire promptly, and are never logged or exposed via API.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">3. Student Privacy by Default</h3>
                <p>Peers only see your public handle, anonymous mask pseudonym, and public posts. Real name, email, and phone number are accessible only to you as the account owner and authorized campus administrators for legitimate safety/compliance reasons.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">4. Confidential Confessions</h3>
                <p>When you post a confession, your real identity is completely detached and not displayed to students. Confessions are moderated to prevent harassment and abuse.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">5. Profile Pictures & Media</h3>
                <p>Uploaded profile pictures are stripped of EXIF and GPS metadata, resized, and converted to modern WebP format before storage in secure cloud storage. Old avatars are deleted upon replacement or removal.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">6. Usage Analytics & Security Telemetry</h3>
                <p>Campus Radar collects privacy-preserving operational analytics (page views, session durations) to maintain service performance. Keystrokes, passwords, and arbitrary inputs are never collected.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">7. Data Minimization & Retention</h3>
                <p>We retain personal information only as long as necessary to provide the service and satisfy safety obligations. Users can request account deletion at any time in Settings.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-headline text-[14px]">8. Privacy Rights & Contact</h3>
                <p>To exercise your data privacy rights or file a grievance: Campus Radar Grievance Officer, Sanjivani University, Kopargaon. Email: privacy@sanjivani.edu.in</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-border bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-meta flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            Official Sanjivani University collegiate policy
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-headline hover:bg-slate-800 text-white text-[12px] font-bold transition"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
