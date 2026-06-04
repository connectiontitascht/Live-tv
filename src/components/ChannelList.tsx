import React from 'react';
import { Search, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import { Channel } from '../types';

interface ChannelListProps {
  channels: Channel[];
  selectedId: string;
  onSelect: (channel: Channel) => void;
  search: string;
  onSearchChange: (value: string) => void;
  transparentBg?: boolean;
  isTvMode?: boolean;
  tvFocusIndex?: number;
  setTvFocusIndex?: (index: number) => void;
}

export default function ChannelList({
  channels,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  transparentBg = false,
  isTvMode = false,
  tvFocusIndex = 0,
  setTvFocusIndex,
}: ChannelListProps) {
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    if (isTvMode && filteredChannels.length > 0) {
      const focusedEl = document.getElementById(`channel-card-${tvFocusIndex}`);
      if (focusedEl) {
        focusedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [tvFocusIndex, isTvMode, filteredChannels.length]);

  return (
    <div className={`flex flex-col h-full overflow-hidden ${
      transparentBg ? 'bg-transparent border-none rounded-none' : 'bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-white/5'
    }`}>
      {/* Search Header */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
          <input
            type="text"
            placeholder="চ্যানেল খুঁজুন (Search channels...)"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-sans placeholder:text-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {filteredChannels.length > 0 ? (
          filteredChannels.map((channel, index) => {
            const isFocused = isTvMode && tvFocusIndex === index;
            const isPlaying = selectedId === channel.id;

            return (
              <motion.button
                key={channel.id}
                id={`channel-card-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => {
                  onSelect(channel);
                  if (setTvFocusIndex) {
                    setTvFocusIndex(index);
                  }
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 group outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isFocused
                    ? 'ring-4 ring-amber-500 bg-amber-500/20 text-white scale-[1.02] border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.6)] font-extrabold z-10'
                    : isPlaying
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/40 flex items-center justify-center border transition-colors ${
                    isFocused
                      ? 'border-amber-400'
                      : isPlaying
                      ? 'border-white/20'
                      : 'border-white/5 group-hover:border-white/10'
                  }`}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Tv size={18} className="opacity-40" />
                  )}
                </div>

                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-bold truncate leading-snug tracking-tight">
                    {channel.name}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-mono ${
                      isFocused ? 'text-amber-300 font-bold' : isPlaying ? 'text-white/70' : 'text-white/30'
                    }`}
                  >
                    NO. {channels.findIndex(c => c.id === channel.id) + 1}
                  </span>
                </div>

                {isPlaying && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}
                    className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0 mr-1"
                  />
                )}
              </motion.button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-white/20">
            <Tv size={40} className="mb-3 opacity-20" />
            <p className="text-sm">কোনো চ্যানেল পাওয়া যায়নি</p>
          </div>
        )}
      </div>
    </div>
  );
}
