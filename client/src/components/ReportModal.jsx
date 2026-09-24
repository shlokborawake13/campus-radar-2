import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';

const REASONS = [
  'Harassment or Bullying',
  'Spam or Scam',
  'Impersonation',
  'Inappropriate Content',
  'Threat or Violence',
  'Academic Dishonesty',
  'Other'
];

export default function ReportModal({ isOpen, onClose, target }) {
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiService.reportItem({
        target_type: target.type || 'post',
        target_id: target.id,
        reason: selectedReason,
        details: details.trim()
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setDetails('');
        onClose();
      }, 1500);
    } catch (err) {
      alert('Could not submit report: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-tertiary" />
            <h3 className="font-bold text-[16px] text-slate-headline">Report Content</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-subtle hover:bg-slate-border flex items-center justify-center text-slate-headline"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto animate-bounce" />
            <h4 className="font-bold text-[16px] text-slate-headline">Report Submitted</h4>
            <p className="text-[12px] text-slate-meta">
              Thank you for keeping Campus Radar safe. Our student moderation team will review this report.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-[12px] text-slate-meta">
              Help us understand what is wrong with this entry. Your identity is kept strictly confidential.
            </p>

            <div>
              <label className="block text-[12px] font-semibold text-slate-headline mb-1.5">Reason</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-subtle border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {REASONS.map((r, i) => (
                  <option key={i} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-headline mb-1.5">Additional Details (Optional)</label>
              <textarea
                rows={3}
                placeholder="Provide context or explanation..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-subtle border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-full border border-slate-border text-[13px] font-semibold text-slate-body hover:bg-slate-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-full bg-tertiary hover:bg-tertiary-hover text-white text-[13px] font-bold shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
