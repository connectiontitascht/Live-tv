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
  WifiOff,
  Crop
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
  onFullscreenChange?: (expanded: boolean) => void;
  isTvMode?: boolean;
  tvFocusIndex?: number;
  setTvFocusIndex?: (index: number) => void;
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
  onSelectChannel,
  onFullscreenChange,
  isTvMode = false,
  tvFocusIndex = 0,
  setTvFocusIndex
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [timeLeft, setTimeLeft] = useState(adDuration || 0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom volume & OSD state
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('playerVolume');
    return saved ? parseFloat(saved) : 1.0;
  });

  // Custom aspect ratio state (contain = default 16:9, cover = zoom, fill = stretch)
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>(() => {
    const saved = localStorage.getItem('playerAspectRatio');
    return (saved as 'contain' | 'cover' | 'fill') || 'contain';
  });

  const [osdMessage, setOsdMessage] = useState<{ text: string; mode: 'mute' | 'unmute' | 'play' | 'pause' | 'volume' | 'fullscreen' | 'sidebar' | 'info' | 'aspect'; val?: string; id: number } | null>(null);
  const osdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerOsd = (text: string, mode: 'mute' | 'unmute' | 'play' | 'pause' | 'volume' | 'fullscreen' | 'sidebar' | 'info' | 'aspect', val?: string) => {
    setOsdMessage({ text, mode, val, id: Date.now() });
    if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      setOsdMessage(null);
    }, 1500);
  };

  const cycleAspectRatio = () => {
    setAspectRatio((prev) => {
      let next: 'contain' | 'cover' | 'fill' = 'contain';
      let caption = '';
      if (prev === 'contain') {
        next = 'fill';
        caption = 'Stretch Mode';
      } else if (prev === 'fill') {
        next = 'cover';
        caption = 'Zoom / Crop';
      } else {
        next = 'contain';
        caption = 'Original Contain (16:9)';
      }
      localStorage.setItem('playerAspectRatio', next);
      triggerOsd(`Screen Fit: ${caption}`, 'aspect');
      return next;
    });
  };

  // Sync actual video element volume when the state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    localStorage.setItem('playerVolume', String(volume));
  }, [volume]);

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
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobilePortrait(isPortrait && isSmallScreen);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const shouldForceLandscapeRotate = (isFullscreen || isWebFullscreen) && isMobilePortrait;
  const isPlayerExpanded = isFullscreen || isWebFullscreen || isForcedLandscape || shouldForceLandscapeRotate;

  useEffect(() => {
    onFullscreenChange?.(isPlayerExpanded);
  }, [isPlayerExpanded, onFullscreenChange]);

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

    // Auto-hide controls and overlays on top of the player after 2 seconds
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, [url]);

  // Clean up controls timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

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
    let active = true;
    let watchdogTimer: NodeJS.Timeout | null = null;

    const triggerOffline = () => {
      if (!active) return;
      console.log('Playback failure detected: triggering offline overlay.');
      triggerOfflineSwitch();
    };

    const resetWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
      }
      watchdogTimer = setTimeout(() => {
        if (!active) return;
        // If the stream is still stalled, not playing, or stuck at 0 time
        if (video.paused || video.currentTime === 0 || video.readyState < 3) {
          console.log('Watchdog timeout: Video has failed to start playing within 5 seconds.');
          triggerOffline();
        }
      }, 5000);
    };

    // Initialize watchdog timer as soon as loading starts
    resetWatchdog();

    const handleNativeError = () => {
      if (!active) return;
      console.log('Video element native error triggered');
      triggerOffline();
    };

    const handlePlaying = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const handleWaiting = () => {
      if (!watchdogTimer && !isOfflineRef.current) {
        resetWatchdog();
      }
    };

    video.addEventListener('error', handleNativeError);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleWaiting);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        manifestLoadingTimeOut: 4000,
        levelLoadingTimeOut: 4000,
      });
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!active) return;
        console.error('HLS error event:', data);
        // Trigger offline immediately on fatal or loading-related errors
        if (
          data.fatal || 
          data.details === 'manifestLoadError' || 
          data.details === 'manifestParsingError' || 
          data.details === 'levelLoadError' || 
          data.details === 'manifestLoadTimeOut' ||
          data.details === 'levelLoadTimeOut'
        ) {
          triggerOffline();
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!active) return;
        if (!userMutedRef.current) {
          video.muted = false;
          setIsMuted(false);
        } else {
          video.muted = true;
          setIsMuted(true);
        }
        // Attempt autoplay; if unmuted is rejected, try muted autoplay
        video.play().catch((err) => {
          if (!active) return;
          if (err.name === 'AbortError') {
            console.log('Play request was aborted/interrupted by a new load request (normal behavior during channel changes).');
            return;
          }
          console.warn('Unmuted autoplay rejected, falling back to muted autoplay:', err);
          video.muted = true;
          setIsMuted(true);
          autoplayMutedRef.current = true;
          video.play().catch((e) => {
            if (!active) return;
            if (e.name === 'AbortError') return;
            console.error('Muted autoplay also rejected:', e);
            setIsPlaying(false);
          });
        });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      const handleLoadedMetadata = () => {
        if (!active) return;
        if (!userMutedRef.current) {
          video.muted = false;
          setIsMuted(false);
        } else {
          video.muted = true;
          setIsMuted(true);
        }
        // Attempt autoplay; if unmuted is rejected, try muted autoplay
        video.play().catch((err) => {
          if (!active) return;
          if (err.name === 'AbortError') return;
          console.warn('Unmuted autoplay rejected, falling back to muted autoplay:', err);
          video.muted = true;
          setIsMuted(true);
          autoplayMutedRef.current = true;
          video.play().catch((e) => {
            if (!active) return;
            if (e.name === 'AbortError') return;
            console.error('Muted autoplay also rejected:', e);
            setIsPlaying(false);
          });
        });
      };
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    return () => {
      active = false;
      if (hls) hls.destroy();
      if (watchdogTimer) clearTimeout(watchdogTimer);
      video.removeEventListener('error', handleNativeError);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleWaiting);
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

  // Listen to Escape / Space / Enter / Arrow Keys / letters for rich computer keyboard hortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if user is typing in search or config inputs
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const keyLower = e.key.toLowerCase();

      // 'a' or 'A' - Cycle Aspect Ratio
      if (keyLower === 'a') {
        e.preventDefault();
        cycleAspectRatio();
        return;
      }

      // 'f' or 'F' - Fullscreen
      if (keyLower === 'f') {
        e.preventDefault();
        handleToggleFullscreen();
        triggerOsd(
          isPlayerExpanded ? "Exit Fullscreen" : "Fullscreen Mode", 
          'fullscreen'
        );
        return;
      }

      // 'm' or 'M' - Mute Toggle
      if (keyLower === 'm') {
        e.preventDefault();
        toggleMute();
        return;
      }

      // 'c' or 'C' - Toggle Sidebar in Fullscreen
      if (keyLower === 'c') {
        if (isPlayerExpanded) {
          e.preventDefault();
          const nextSidebar = !showSidebar;
          setShowSidebar(nextSidebar);
          triggerOsd(
            nextSidebar ? "Show Sidebar" : "Hide Sidebar", 
            'sidebar'
          );
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isPlayerExpanded) {
          e.preventDefault();
          setIsWebFullscreen(false);
          setIsForcedLandscape(false);
          triggerOsd("Exit Fullscreen", 'fullscreen');
        }
      } else if (e.key === ' ' || e.key === 'Enter' || keyLower === 'k') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'A') {
          return;
        }
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume, isTvMode, isPlayerExpanded, showSidebar]);

  // Support auto-scrolling focused items in fullscreen TV mode sidebar
  useEffect(() => {
    if (isTvMode && isPlayerExpanded && showSidebar) {
      const el = document.getElementById(`fs-channel-card-${tvFocusIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [tvFocusIndex, isTvMode, isPlayerExpanded, showSidebar]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      const nextVal = !isPlaying;
      setIsPlaying(nextVal);
      triggerOsd(nextVal ? "Play" : "Pause", nextVal ? 'play' : 'pause');
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      userMutedRef.current = nextMuted;
      triggerOsd(
        nextMuted ? "Muted" : `Sound Unmuted`, 
        nextMuted ? 'mute' : 'unmute', 
        nextMuted ? undefined : `${Math.round(volume * 100)}%`
      );
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
      // Try native video element fullscreen fallback (extremely helpful on iOS Safari)
      if (videoRef.current) {
        const videoAny = videoRef.current as any;
        if (videoAny.webkitEnterFullscreen) {
          try {
            videoAny.webkitEnterFullscreen();
          } catch (e) {
            console.warn('webkitEnterFullscreen error:', e);
          }
        }
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

  const rotationStyle: React.CSSProperties = isForcedLandscape || shouldForceLandscapeRotate ? {
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
            className={`w-full h-full cursor-pointer transition-all duration-300 ${
              aspectRatio === 'cover' ? 'object-cover' : aspectRatio === 'fill' ? 'object-fill' : 'object-contain'
            }`}
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
            <h3 className="text-xl font-bold tracking-tight mb-2">No Channel Selected</h3>
            <p className="text-sm text-zinc-400">Please select a channel from the list</p>
          </div>
        )}

        {/* Offline Overlay - চ্যানেল অফলাইন থাকলে দেখাবে এবং পরবর্তী চ্যানেলে অটো স্যুইচ হবে */}
        <AnimatePresence>
          {isOffline && !isAdMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center text-center p-6 select-none overflow-hidden"
              id="offline-overlay"
            >
              {/* Background Animated Video - fully active and clearly visible */}
              <video
                className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-85 z-0 scale-100"
                src="https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-loop-41850-large.mp4"
                autoPlay
                loop
                muted
                playsInline
              />
              
              {/* Gradient Overlay for high readability while keeping video active */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-zinc-950/40 to-black/70 backdrop-blur-[2px] z-10" />

              {/* Only the glowing, animating OFFLINE text remains */}
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 150 }}
                className="relative z-20 text-center select-none"
              >
                <span className="text-5xl sm:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-600 drop-shadow-[0_2px_30px_rgba(239,68,68,0.85)] uppercase animate-pulse">
                  OFFLINE
                </span>
              </motion.div>
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
                        <span>Visit Website</span>
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
                  {isPlayerExpanded && channels && channels.length > 0 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSidebar(!showSidebar);
                      }}
                      className={`p-2 rounded-lg text-white transition-colors ${
                        showSidebar ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white/10 hover:bg-white/20'
                      }`}
                      title={showSidebar ? 'Hide Channel List' : 'Show Channel List'}
                      id="fullscreen-sidebar-toggle-btn"
                    >
                      <List size={20} />
                    </button>
                  )}
                  {/* Aspect Ratio Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleAspectRatio();
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all flex items-center gap-1.5"
                    title="Aspect Ratio / Fit Mode (Press A)"
                    id="aspect-ratio-btn"
                  >
                    <Crop size={18} className="text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-tight bg-white/10 px-1 py-0.5 rounded text-zinc-300">
                      {aspectRatio === 'contain' ? '16:9' : aspectRatio === 'fill' ? 'Stretch' : 'Zoom'}
                    </span>
                  </button>

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
                        title="Previous Channel (Keyboard Down)"
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
                        title="Next Channel (Keyboard Up)"
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
                    {isForcedLandscape ? 'Rotated Landscape' : 'Fullscreen'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OSD (On-Screen Display) Alert */}
        <AnimatePresence>
          {osdMessage && (
            <motion.div
              key={osdMessage.id}
              initial={{ opacity: 0, scale: 0.85, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/85 backdrop-blur-md rounded-2xl border border-white/10 px-5 py-3 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] select-none pointer-events-none"
            >
              <div className="text-blue-500">
                {osdMessage.mode === 'play' && <Play size={20} className="fill-current text-blue-400" />}
                {osdMessage.mode === 'pause' && <Pause size={20} className="fill-current text-blue-400" />}
                {osdMessage.mode === 'mute' && <VolumeX size={20} className="text-red-400" />}
                {osdMessage.mode === 'unmute' && <Volume2 size={20} className="text-emerald-400" />}
                {osdMessage.mode === 'volume' && <Volume2 size={20} className="text-blue-400" />}
                {osdMessage.mode === 'fullscreen' && <Maximize2 size={20} className="text-amber-400" />}
                {osdMessage.mode === 'sidebar' && <List size={20} className="text-purple-400" />}
                {osdMessage.mode === 'aspect' && <Crop size={20} className="text-amber-400" />}
              </div>
              <div className="flex flex-col">
                <span className="text-white text-xs font-extrabold tracking-tight font-sans">
                  {osdMessage.text}
                </span>
                {osdMessage.val && (
                  <div className="w-24 bg-white/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-150"
                      style={{ width: osdMessage.val }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT SECTION / SIDEBAR: Fullscreen Channel list */}
      {isPlayerExpanded && showSidebar && channels && channels.length > 0 && (
        <div 
          className="w-72 sm:w-80 h-full border-l border-white/10 bg-zinc-950/95 backdrop-blur-md flex flex-col z-[45] shrink-0 relative" 
          onClick={(e) => e.stopPropagation()}
          id="fullscreen-channel-sidebar"
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
                <Tv size={16} className="text-blue-400" />
                Channel List
              </span>
              <span className="text-[10px] text-white/40 mt-0.5">Channel List ({channels.length})</span>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="text-white/60 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              title="Close list"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-white/5 relative">
            <Search size={14} className="absolute left-6.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchInFullscreen}
              onChange={(e) => setSearchInFullscreen(e.target.value)}
              placeholder="Search Channel..."
              className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white placeholder-white/30 rounded-xl text-xs pl-9 pr-4 py-2 border border-white/5 focus:border-blue-500/50 outline-none transition-all"
            />
          </div>

          {/* Channels list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 font-sans">
            {filteredChannels.sort((a, b) => a.order - b.order).map((channel) => {
              const active = currentChannelId === channel.id;
              const overallIndex = channels.findIndex(c => c.id === channel.id);
              const isFocused = isTvMode && tvFocusIndex === overallIndex;

              return (
                <button
                  key={channel.id}
                  id={`fs-channel-card-${overallIndex}`}
                  onClick={() => {
                    onSelectChannel?.(channel);
                    if (setTvFocusIndex) setTvFocusIndex(overallIndex);
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer text-left outline-none ${
                    isFocused
                      ? 'ring-4 ring-amber-500 bg-amber-500/20 font-bold text-white shadow-lg border-amber-500/50 scale-[1.01]'
                      : active 
                      ? 'bg-blue-600 font-bold text-white shadow-lg shadow-blue-600/10' 
                      : 'hover:bg-white/5 text-white/70 hover:text-white'
                  }`}
                >
                  <div className="w-10 h-7 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {channel.logo ? (
                      <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                    ) : (
                      <Tv size={14} className="opacity-40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-xs font-semibold truncate leading-tight">{channel.name}</span>
                    <span className={`text-[9px] uppercase tracking-wider font-mono mt-0.5 ${
                      isFocused ? 'text-amber-300 font-bold' : active ? 'text-white/70' : 'text-white/30'
                    }`}>
                      NO. {overallIndex + 1}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredChannels.length === 0 && (
              <div className="text-center py-8 text-white/40 text-xs">
                No channel found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
