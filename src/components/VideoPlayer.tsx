import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Tv, 
  List, 
  Search, 
  X,
  ChevronUp,
  ChevronDown,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Channel } from '../types';

interface VideoPlayerProps {
  url: string;
  isAdMode?: boolean;
  adType?: 'video' | 'image';
  adImageUrl?: string;
  adLinkUrl?: string;
  adDuration?: number;
  onAdEnd?: () => void;
  title?: string;
  channels?: Channel[];
  currentChannelId?: string;
  onSelectChannel?: (channel: Channel) => void;
}

export default function VideoPlayer({ 
  url, 
  isAdMode, 
  adType = 'video',
  adImageUrl,
  adLinkUrl,
  adDuration,
  onAdEnd, 
  title,
  channels,
  currentChannelId,
  onSelectChannel
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [timeLeft, setTimeLeft] = useState(adDuration || 0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Offline handler states
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCountdown, setOfflineCountdown] = useState(5);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleChannelUp = () => {
    if (!channels || !channels.length || !onSelectChannel) return;
    const currentIndex = channels.findIndex(c => c.id === currentChannelId);
    const nextIndex = (currentIndex + 1) % channels.length;
    onSelectChannel(channels[nextIndex]);
  };

  const handleChannelDown = () => {
    if (!channels || !channels.length || !onSelectChannel) return;
    const currentIndex = channels.findIndex(c => c.id === currentChannelId);
    const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
    onSelectChannel(channels[prevIndex]);
  };

  const handleChannelUpRef = useRef(handleChannelUp);
  const isAdModeRef = useRef(isAdMode);
  const isOfflineRef = useRef(isOffline);

  useEffect(() => {
    handleChannelUpRef.current = handleChannelUp;
    isAdModeRef.current = isAdMode;
    isOfflineRef.current = isOffline;
  });

  const triggerOfflineSwitch = () => {
    if (isAdModeRef.current) return;
    if (isOfflineRef.current) return;
    
    setIsOffline(true);
    setOfflineCountdown(5);
    
    if (offlineTimerRef.current) {
      clearInterval(offlineTimerRef.current);
    }
    
    let count = 5;
    offlineTimerRef.current = setInterval(() => {
      count -= 1;
      setOfflineCountdown(count >= 0 ? count : 0);
      if (count <= 0) {
        if (offlineTimerRef.current) {
          clearInterval(offlineTimerRef.current);
          offlineTimerRef.current = null;
        }
        handleChannelUpRef.current();
      }
    }, 1000);
  };

  // Expanded and Rotation States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [isForcedLandscape, setIsForcedLandscape] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchInFullscreen, setSearchInFullscreen] = useState('');

  const isPlayerExpanded = isFullscreen || isWebFullscreen || isForcedLandscape;

  const userMutedRef = useRef(false);
  const autoplayMutedRef = useRef(false);

  // Sync isPlaying when URL changes
  useEffect(() => {
    setIsOffline(false);
    setOfflineCountdown(5);
    if (offlineTimerRef.current) {
      clearInterval(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
    setIsPlaying(true);
    // If the user hasn't explicitly muted, we restore the sound when a new channel is clicked/selected
    if (!userMutedRef.current) {
      setIsMuted(false);
      autoplayMutedRef.current = false;
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
    }
  }, [url]);

  // Automatically unmute as soon as any user interaction occurs on the document
  useEffect(() => {
    const handleInteraction = () => {
      if (autoplayMutedRef.current && videoRef.current) {
        videoRef.current.muted = false;
        setIsMuted(false);
        autoplayMutedRef.current = false;
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return cleanup;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const handleNativeError = () => {
      console.log('Video element native error triggered');
      triggerOfflineSwitch();
    };

    video.addEventListener('error', handleNativeError);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
      });
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error event:', data);
        if (data.fatal) {
          triggerOfflineSwitch();
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!userMutedRef.current) {
          video.muted = false;
          setIsMuted(false);
        } else {
          video.muted = true;
          setIsMuted(true);
        }
        // Attempt autoplay; if unmuted is rejected, try muted autoplay
        video.play().catch((err) => {
          console.warn('Unmuted autoplay rejected, falling back to muted autoplay:', err);
          video.muted = true;
          setIsMuted(true);
          autoplayMutedRef.current = true;
          video.play().catch((e) => {
            console.error('Muted autoplay also rejected:', e);
            setIsPlaying(false);
          });
        });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        if (!userMutedRef.current) {
          video.muted = false;
          setIsMuted(false);
        } else {
          video.muted = true;
          setIsMuted(true);
        }
        // Attempt autoplay; if unmuted is rejected, try muted autoplay
        video.play().catch((err) => {
          console.warn('Unmuted autoplay rejected, falling back to muted autoplay:', err);
          video.muted = true;
          setIsMuted(true);
          autoplayMutedRef.current = true;
          video.play().catch((e) => {
            console.error('Muted autoplay also rejected:', e);
            setIsPlaying(false);
          });
        });
      });
    }

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener('error', handleNativeError);
    };
  }, [url]);

  const onAdEndRef = useRef(onAdEnd);
  useEffect(() => {
    onAdEndRef.current = onAdEnd;
  }, [onAdEnd]);

  // Handle Ads
  useEffect(() => {
    if (isAdMode && adDuration) {
      setTimeLeft(adDuration);
      let localTimeLeft = adDuration;
      const timer = setInterval(() => {
        localTimeLeft -= 1;
        setTimeLeft(localTimeLeft >= 0 ? localTimeLeft : 0);
        if (localTimeLeft <= 0) {
          clearInterval(timer);
          onAdEndRef.current?.();
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isAdMode, adDuration]);

  // Native Fullscreen Event Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      
      const screenAny = screen as any;
      // Auto orientation lock on mobile
      if (active && screenAny.orientation && screenAny.orientation.lock) {
        screenAny.orientation.lock('landscape').catch((e: any) => {
          console.warn('Orientation lock rejected/unsupported:', e);
        });
      } else if (!active && screenAny.orientation && screenAny.orientation.unlock) {
        try {
          screenAny.orientation.unlock();
        } catch (e) {
          console.warn('Orientation unlock failed:', e);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Listen to Escape Key to dismiss web fullscreens/rotations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWebFullscreen(false);
        setIsForcedLandscape(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      userMutedRef.current = nextMuted;
    }
  };

  const handleToggleFullscreen = () => {
    if (isPlayerExpanded) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsWebFullscreen(false);
      setIsForcedLandscape(false);
    } else {
      setIsWebFullscreen(true);
      // Try entering native full screen on parent container
      if (containerRef.current) {
        const req = containerRef.current.requestFullscreen || 
                    (containerRef.current as any).webkitRequestFullscreen;
        if (req) {
          req.call(containerRef.current).catch((err) => {
            console.warn('Native fullscreen request rejected/unsupported:', err);
          });
        }
      }
      // On mobile, also automatically try device orientation lock
      const screenAny = screen as any;
      if (screenAny.orientation && screenAny.orientation.lock) {
        screenAny.orientation.lock('landscape').catch(() => {});
      }
    }
  };

  const handleToggleRotation = () => {
    const nextVal = !isForcedLandscape;
    setIsForcedLandscape(nextVal);
    // If turning on visual landscape rotation, make sure web fullscreen is active too for maximum effect
    if (nextVal) {
      setIsWebFullscreen(true);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
  };

  // Switch channels inside fullscreen
  const filteredChannels = (channels || []).filter(c => 
    c.name.toLowerCase().includes(searchInFullscreen.toLowerCase())
  );

  const rotationStyle: React.CSSProperties = isForcedLandscape ? {
    position: 'fixed',
    top: '50%',
    left: '50%',
    width: '100vh',
    height: '100vw',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    zIndex: 99999,
    borderRadius: 0,
  } : {};

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black overflow-hidden group shadow-2xl transition-all duration-300 flex ${
        isPlayerExpanded 
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none' 
          : 'w-full aspect-video rounded-xl border border-white/5'
      }`}
      style={rotationStyle}
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
      onTouchStart={handleMouseMove}
      id="video-container"
    >
      {/* LEFT SECTION: Video & controls */}
      <div className="flex-1 h-full relative bg-black flex items-center justify-center">
        {url ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain cursor-pointer"
            playsInline
            autoPlay
            muted={isAdMode && adType === 'image' ? true : isMuted}
            onClick={() => {
              if (isMuted && !userMutedRef.current) {
                toggleMute();
              } else {
                togglePlay();
              }
            }}
            onError={() => {
              console.log('Native onError callback triggered on video element');
              triggerOfflineSwitch();
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white/80 p-6 text-center select-none" id="no-channel-placeholder">
            <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 mb-4 animate-pulse">
              <Tv size={36} />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">কোনো লাইভ চ্যানেল নির্বাচন করা হয়নি</h3>
            <p className="text-sm text-white/40 max-w-sm mb-4">
              অনুগ্রহ করে ডানপাশের চ্যানেল তালিকা থেকে একটি চ্যানেল নির্বাচন করুন অথবা এডমিন হিসেবে লগইন করে নতুন চ্যানেল যোগ করুন।
            </p>
            <div className="text-xs text-blue-400 font-mono bg-blue-500/5 px-2.5 py-1 rounded-full border border-blue-500/10">
              T-TV PLAY • Live Stream Server
            </div>
          </div>
        )}

        {/* Offline Overlay - চ্যানেল খেলা না হলে অফলাইন লেখা দেখাবে এবং পরবর্তী চ্যানেলে অটো সুইচ করবে */}
        <AnimatePresence>
          {isOffline && !isAdMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-zinc-950/98 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 select-none"
              id="offline-overlay"
            >
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-550 mb-4 animate-bounce">
                <WifiOff size={32} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white mb-2 font-sans">চ্যানেলটি অফলাইন আছে (Offline)</h3>
              <p className="text-sm text-white/50 max-w-sm mb-6 leading-relaxed font-sans">
                এই চ্যানেলটির সম্প্রচার এই মুহূর্তে বন্ধ রয়েছে অথবা সোর্স সংযোগটি সক্রিয় নেই।
              </p>
              <div className="flex items-center gap-2 text-xs bg-red-500/10 px-4.5 py-2.5 rounded-full border border-red-500/20 text-red-500 font-sans font-bold shadow-lg shadow-black/40">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                <span>{offlineCountdown} সেকেন্ডের মধ্যে পরবর্তী চ্যানেলে স্যুইচ করা হচ্ছে...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ad Overlay */}
        <AnimatePresence>
          {isAdMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white select-none"
            >
              {adType === 'image' && adImageUrl ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
                  {adLinkUrl ? (
                    <a
                      href={adLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-full h-full flex items-center justify-center cursor-pointer group"
                    >
                      <img
                        src={adImageUrl}
                        alt="Advertisement"
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.01]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs sm:text-sm font-semibold px-4.5 py-2 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.6)] border border-blue-500/30 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 animate-pulse">
                        <span>বিজ্ঞাপনে যেতে এখানে ক্লিক করুন (Visit Website)</span>
                      </div>
                    </a>
                  ) : (
                    <img
                      src={adImageUrl}
                      alt="Advertisement"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85">
                  <div className="text-2xl font-bold mb-4 tracking-wide">Advertisement</div>
                  <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin mb-4" />
                </div>
              )}

              {/* Timer Badge (Always display timer clearly over any mode) */}
              <div className="absolute bottom-4 right-4 z-[60] bg-black/80 backdrop-blur-md text-white font-sans text-xs font-bold px-3.5 py-2 rounded-full border border-white/10 shadow-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Skip in {timeLeft}s</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Overlay */}
        <AnimatePresence>
          {(showControls || !isPlaying) && !isAdMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/50 p-4 sm:p-6 flex flex-col justify-between"
            >
              {/* Top Bar */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-medium text-sm sm:text-base md:text-lg line-clamp-1">{title || 'Live Stream'}</h3>
                  <span className="flex items-center gap-2 text-red-500 text-xs sm:text-sm font-bold uppercase tracking-widest mt-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Live
                  </span>
                </div>
                
                {/* Control Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Channels Sidebar Toggle (only in Expanded Mode) */}
                  {isPlayerExpanded && channels && channels.length > 0 && (
                    <button
                      onClick={() => setShowSidebar(!showSidebar)}
                      className={`p-2 rounded-lg text-white transition-colors ${
                        showSidebar ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'
                      }`}
                      title={showSidebar ? "চ্যানেল তালিকা লুকান" : "চ্যানেল তালিকা দেখুন"}
                    >
                      <List size={20} />
                    </button>
                  )}

                  {/* Fullscreen Button */}
                  <button 
                    onClick={handleToggleFullscreen}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                    id="fullscreen-btn"
                  >
                    {isPlayerExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                </div>
              </div>

              {/* Bottom Bar: Play/Pause/Mute */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
                    id="play-pause-btn"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="text-white hover:opacity-80 transition-opacity"
                    id="mute-btn"
                  >
                    {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  </button>

                  {/* Tactile On-Screen Channel Change Buttons (Tv Remote style) */}
                  {channels && channels.length > 0 && (
                    <div className="flex items-center gap-0.5 bg-black/40 border border-white/10 rounded-full p-0.5 shadow-lg">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChannelDown();
                        }}
                        className="p-1.5 hover:bg-white/15 rounded-full text-white/80 hover:text-white transition-all flex items-center gap-1 text-xs"
                        title="পূর্ববর্তী চ্যানেল (Keyboard Down)"
                        id="player-ch-down"
                      >
                        <ChevronDown size={18} />
                        <span className="text-[10px] font-black pr-1 hidden sm:inline">CH -</span>
                      </button>
                      <div className="w-[1px] h-4 bg-white/10 self-center" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChannelUp();
                        }}
                        className="p-1.5 hover:bg-white/15 rounded-full text-white/80 hover:text-white transition-all flex items-center gap-1 text-xs"
                        title="পরবর্তী চ্যানেল (Keyboard Up)"
                        id="player-ch-up"
                      >
                        <ChevronUp size={18} />
                        <span className="text-[10px] font-black pr-1 hidden sm:inline">CH +</span>
                      </button>
                    </div>
                  )}
                </div>

                {isPlayerExpanded && (
                  <div className="text-xs text-white/50 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                    {isForcedLandscape ? 'ল্যান্ডস্কেপ ভিউ (Rotated)' : 'ফুলস্ক্রিন ভিউ (Fullscreen)'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT SECTION: Compact Scrollable Channels List inside Fullscreen */}
      {isPlayerExpanded && showSidebar && channels && channels.length > 0 && (
        <div className="w-[260px] sm:w-[300px] h-full shrink-0 border-l border-white/10 bg-[#0A0A0A]/95 backdrop-blur-md flex flex-col z-30 transition-all duration-300">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2">
              <Tv size={16} className="text-blue-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide">লাইভ চ্যানেলসমূহ</span>
            </div>
            <button 
              onClick={() => setShowSidebar(false)}
              className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-all"
              title="লুকান"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search bar */}
          <div className="p-2 border-b border-white/5 bg-black/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" size={13} />
              <input
                type="text"
                placeholder="চ্যানেল খুঁজুন..."
                className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-sans"
                value={searchInFullscreen}
                onChange={(e) => setSearchInFullscreen(e.target.value)}
              />
            </div>
          </div>

          {/* Scrollable channels */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {filteredChannels.length > 0 ? (
              filteredChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    onSelectChannel?.(channel);
                    // On small mobile, auto close sidebar to focus on stream
                    if (window.innerWidth < 640) {
                      setShowSidebar(false);
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left duration-200 ${
                    currentChannelId === channel.id 
                      ? 'bg-blue-600 text-white font-medium shadow' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-black/40 flex items-center justify-center border ${
                    currentChannelId === channel.id ? 'border-white/20' : 'border-white/5'
                  }`}>
                    {channel.logo ? (
                      <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                    ) : (
                      <Tv size={14} className="opacity-40" />
                    )}
                  </div>
                  <span className="text-xs line-clamp-1 flex-1 font-sans font-medium">{channel.name}</span>
                  {currentChannelId === channel.id && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.8 }}
                      className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0"
                    />
                  )}
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-white/20 text-xs">
                <Search size={22} className="mb-2 opacity-10" />
                <span>চ্যানেল পাওয়া যায়নি</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
