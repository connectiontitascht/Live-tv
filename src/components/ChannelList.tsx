import React from 'react';
import { Channel } from '../types';
import { Search, Tv } from 'lucide-react';
import { motion } from 'motion/react';

interface ChannelListProps {
  channels: Channel[];
  selectedId: string;
  onSelect: (channel: Channel) => void;
  search: string;
  onSearchChange: (val: string) => void;
}

const ChannelLogo = ({ src, name, isSelected }: { src?: string; name: string; isSelected: boolean }) => {
  const [error, setError] = React.useState(false);

  return (
    <div className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-black/40 border ${isSelected ? 'border-white/20' : 'border-white/5'}`}>
      {src && !error ? (
        <img 
          src={src} 
          alt={name} 
          className="w-full h-full object-contain p-1"
          onError={() => setError(true)}
        />
      ) : (
        <Tv size={20} className="opacity-40" />
      )}
    </div>
  );
};

export default function ChannelList({ channels, selectedId, onSelect, search, onSearchChange }: ChannelListProps) {
  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-full bg-[#141414] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
      <div className="p-4 border-b border-white/5 shrink-0 bg-[#1A1A1A]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="চ্যানেল খুঁজুন..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-sans"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            id="channel-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 p-2 custom-scrollbar">
        {filteredChannels.length > 0 ? (
          filteredChannels.map((channel, index) => (
            <motion.button
               key={channel.id}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: index * 0.02 }}
               onClick={() => onSelect(channel)}
               className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 group ${
                 selectedId === channel.id 
                   ? 'bg-blue-600 text-white' 
                   : 'text-white/60 hover:bg-white/5 hover:text-white'
               }`}
               id={`channel-${channel.id}`}
             >
               <ChannelLogo 
                 src={channel.logo} 
                 name={channel.name} 
                 isSelected={selectedId === channel.id} 
               />
               <div className="flex-1 text-left flex items-center justify-between gap-2">
                <span className="block font-medium text-xs line-clamp-1">{channel.name}</span>
                {selectedId === channel.id && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      repeat: Infinity,
                      repeatType: "reverse",
                      duration: 0.8,
                    }}
                    className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0"
                    id="playing-indicator"
                  />
                )}
              </div>
            </motion.button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-white/20">
            <Search size={48} className="mb-2 opacity-10" />
            <p>চ্যানেল পাওয়া যায়নি</p>
          </div>
        )}
      </div>
    </div>
  );
}
