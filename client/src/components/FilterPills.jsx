import React from 'react';

const CATEGORIES = [
  { id: 'All', label: 'All', icon: '⚡' },
  { id: 'Trending', label: 'Trending', icon: '🔥' },
  { id: 'Confessions', label: 'Confessions', icon: '🤫' },
  { id: 'Events', label: 'Events', icon: '🎉' },
  { id: 'Academics', label: 'Academics', icon: '📚' },
  { id: 'Clubs', label: 'Clubs', icon: '🏆' },
];

export default function FilterPills({ activeCategory, onSelectCategory }) {
  return (
    <div className="w-full bg-white border-b sm:border sm:rounded-2xl border-slate-border py-2.5 px-3 sm:px-4 overflow-x-auto no-scrollbar sm:overflow-visible shadow-soft-card">
      <div className="flex items-center sm:flex-wrap gap-2 min-w-max sm:min-w-0">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-slate-headline text-white shadow-sm'
                  : 'bg-slate-subtle text-slate-body hover:bg-slate-border/70 hover:text-slate-headline'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
