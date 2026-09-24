import React, { useState } from 'react';
import { Calendar, MapPin, Clock, Users, Bookmark, Check, Share2 } from 'lucide-react';

export default function EventCard({ post, onBookmark, onRegister }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const eventDate = post.eventDate || { month: 'OCT', day: '28', time: '6:00 PM', location: 'Campus Center' };
  const heroImage = post.images && post.images.length > 0
    ? post.images[0]
    : 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80';

  const handleRegister = async () => {
    setIsRegistering(true);
    await onRegister(post.id);
    setIsRegistering(false);
  };

  return (
    <article className="bg-white rounded-2xl border border-slate-border shadow-soft-card overflow-hidden transition-all duration-200 hover:border-slate-300">
      {/* Header Image with Linear Gradient Overlay for legibility */}
      <div className="relative w-full h-44 sm:h-52 bg-slate-subtle overflow-hidden">
        <img
          src={heroImage}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        {/* Subtle linear gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Category Pill Tag */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-headline text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          {post.category || 'Event'}
        </div>

        {/* Top Right Save Bookmark */}
        <button
          onClick={() => onBookmark(post.id)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white backdrop-blur-md flex items-center justify-center text-slate-headline shadow-sm transition active:scale-95"
          title="Bookmark Event"
        >
          <Bookmark className={`w-4 h-4 ${post.hasBookmarked ? 'fill-primary text-primary' : ''}`} />
        </button>

        {/* Bottom Title on Image */}
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h2 className="text-[17px] font-bold leading-snug drop-shadow-sm line-clamp-1">
            {post.title}
          </h2>
          <p className="text-[12px] text-white/80 flex items-center gap-1.5 mt-0.5">
            <span className="font-semibold">{post.author.name}</span>
          </p>
        </div>
      </div>

      {/* Date Split & Details Section */}
      <div className="p-3.5 flex gap-3.5 items-center justify-between">
        {/* Left: Date Badge Column */}
        <div className="flex items-center gap-3">
          <div className="w-13 min-w-[52px] h-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-center p-1">
            <span className="text-[10px] font-extrabold uppercase text-primary tracking-wider leading-none">
              {eventDate.month}
            </span>
            <span className="text-[18px] font-black text-slate-headline leading-tight">
              {eventDate.day}
            </span>
          </div>

          {/* Center Details */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-headline">
              <Clock className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span className="line-clamp-1">{eventDate.time}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-meta">
              <MapPin className="w-3.5 h-3.5 text-tertiary shrink-0" />
              <span className="line-clamp-1">{eventDate.location}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-meta font-medium mt-0.5">
              <Users className="w-3 h-3 text-primary shrink-0" />
              <span>{post.attendeesCount || 120} students registered</span>
            </div>
          </div>
        </div>

        {/* Right: CTA Pill Button */}
        <button
          onClick={handleRegister}
          disabled={isRegistering}
          className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-bold transition duration-200 active:scale-95 flex items-center gap-1 shadow-sm ${
            post.isRegistered
              ? 'bg-emerald-100 text-primary-dark border border-emerald-300'
              : 'bg-primary hover:bg-primary-hover text-white'
          }`}
        >
          {post.isRegistered ? (
            <>
              <Check className="w-4 h-4" />
              <span>Registered</span>
            </>
          ) : (
            <span>Interested</span>
          )}
        </button>
      </div>

      {/* Description Snippet */}
      {post.content && (
        <div className="px-3.5 pb-3">
          <p className="text-[13px] text-slate-body leading-normal line-clamp-2">
            {post.content}
          </p>
        </div>
      )}
    </article>
  );
}
