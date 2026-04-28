import React, { useEffect, useState, useCallback } from 'react';
import { db, auth, googleProvider, handleFirestoreError, OperationType, isFirebaseConfigured } from './lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { Channel, AppConfig } from './types';
import { MOCK_CHANNELS, DEFAULT_CONFIG } from './constants';
import VideoPlayer from './components/VideoPlayer';
import ChannelList from './components/ChannelList';
import AdminPanel from './components/AdminPanel';
import { User, LogOut, Settings, Tv, Terminal, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ADMIN_EMAIL = 'connection.titascht@gmail.com';

export default function App() {
  const [channels, setChannels] = useState<Channel[]>(isFirebaseConfigured ? [] : MOCK_CHANNELS);
  const [config, setConfig] = useState<AppConfig | null>(isFirebaseConfigured ? null : DEFAULT_CONFIG);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(isFirebaseConfigured ? null : MOCK_CHANNELS[0]);
  const [search, setSearch] = useState('');
  const [isAdMode, setIsAdMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  // Fetch Channels
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsub = onSnapshot(collection(db, 'channels'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Channel));
      setChannels(data.length > 0 ? data.sort((a, b) => a.order - b.order) : MOCK_CHANNELS);
      
      if (data.length > 0 && !currentChannel) {
        setCurrentChannel(data.sort((a, b) => a.order - b.order)[0]);
        triggerInitialAd();
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'channels');
      setChannels(MOCK_CHANNELS);
      setLoading(false);
    });

    return () => unsub();
  }, [currentChannel]);

  // Fetch Config
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'configs', 'global'));
        if (snap.exists()) {
          setConfig(snap.data() as AppConfig);
        } else {
          setConfig(DEFAULT_CONFIG);
        }
      } catch (err) {
        console.error("Failed to fetch config", err);
        setConfig(DEFAULT_CONFIG);
      }
    };
    fetchConfig();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });
    return () => unsub();
  }, []);

  // Ad Timers
  const triggerInitialAd = useCallback(() => {
    // We'll wait a bit then show ad
    setTimeout(() => {
      setIsAdMode(true);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      setIsAdMode(true);
    }, config.hourlyAdInterval * 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Remote Control Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!channels.length) return;
      const currentIndex = channels.findIndex(c => c.id === currentChannel?.id);

      if (e.key === 'ArrowDown') {
        const nextIndex = (currentIndex + 1) % channels.length;
        setCurrentChannel(channels[nextIndex]);
      } else if (e.key === 'ArrowUp') {
        const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
        setCurrentChannel(channels[prevIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, currentChannel]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const currentVideoUrl = isAdMode 
    ? (config?.adVideoUrl || 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd') // Placeholder ad if none set
    : (currentChannel?.url || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <h1 className="text-white font-bold text-2xl tracking-tighter">T-TV LIVE</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0A0A0A] text-white selection:bg-blue-500/30 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Tv size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white">T-TV</h1>
        </div>

        <div className="flex items-center gap-4">
          {!isFirebaseConfigured && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-500 text-xs font-medium">
              <AlertTriangle size={14} />
              <span>Preview Mode (No Firebase)</span>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className={`p-2 rounded-lg transition-colors ${showAdmin ? 'bg-blue-600' : 'hover:bg-white/5'}`}
              title="Admin Panel"
            >
              <Settings size={20} />
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white/10" />
              <button 
                onClick={() => signOut(auth)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-red-400"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              <User size={18} />
              Login
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
          {/* Main Content Area */}
          <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                {showAdmin ? (
                  <motion.div
                    key="admin"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                  >
                    <AdminPanel channels={channels} config={config} onRefresh={() => {}} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="player"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="h-full flex items-start"
                  >
                    <div className="w-full">
                      <VideoPlayer 
                        url={currentVideoUrl}
                        isAdMode={isAdMode}
                        adDuration={config?.initialAdDuration || 10}
                        onAdEnd={() => setIsAdMode(false)}
                        title={isAdMode ? 'Advertisement' : currentChannel?.name}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-1 h-full overflow-hidden pb-4">
            <ChannelList 
              channels={channels}
              selectedId={currentChannel?.id || ''}
              onSelect={(c) => {
                setCurrentChannel(c);
                setShowAdmin(false);
              }}
              search={search}
              onSearchChange={setSearch}
            />
          </div>
        </div>
      </main>

      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}
