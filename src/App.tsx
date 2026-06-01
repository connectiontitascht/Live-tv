import React, { useEffect, useState, useCallback } from 'react';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { Channel, AppConfig } from './types';
import VideoPlayer from './components/VideoPlayer';
import ChannelList from './components/ChannelList';
import AdminPanel from './components/AdminPanel';
import { User, LogOut, Settings, Tv, Terminal, Download, Eye, EyeOff, ShieldAlert, X, Power, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ADMIN_EMAIL = 'connection.titascht@gmail.com';

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [search, setSearch] = useState('');
  const [isAdMode, setIsAdMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Auth modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('connection.titascht@gmail.com');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'email' | 'google'>('email');

  // PWA Install Logic
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Ad Timers
  const triggerInitialAd = useCallback(() => {
    // We'll wait a bit then show ad
    setTimeout(() => {
      setIsAdMode(true);
    }, 1000);
  }, []);

  const handleAdEnd = useCallback(() => {
    setIsAdMode(false);
  }, []);

  // TV Remote Channel Change Navigation Handlers (আপ ও ডাউন বাটন দিয়ে চ্যানেল পরিবর্তন)
  const handleRemoteChannelUp = useCallback(() => {
    if (!channels.length || !currentChannel) return;
    const currentIndex = channels.findIndex(c => c.id === currentChannel.id);
    const nextIndex = (currentIndex + 1) % channels.length;
    setCurrentChannel(channels[nextIndex]);
  }, [channels, currentChannel]);

  const handleRemoteChannelDown = useCallback(() => {
    if (!channels.length || !currentChannel) return;
    const currentIndex = channels.findIndex(c => c.id === currentChannel.id);
    const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
    setCurrentChannel(channels[prevIndex]);
  }, [channels, currentChannel]);

  const handleChannelSelectByIndex = useCallback((index: number) => {
    if (channels[index]) {
      setCurrentChannel(channels[index]);
    }
  }, [channels]);

  // Fetch Channels
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'channels'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Channel));
      const sorted = data.sort((a, b) => a.order - b.order);
      setChannels(sorted);
      
      setCurrentChannel((prev) => {
        if (!prev && sorted.length > 0) {
          // Trigger initial ad if configured
          triggerInitialAd();
          return sorted[0];
        }
        if (prev) {
          const exists = sorted.find(c => c.id === prev.id);
          return exists || sorted[0] || null;
        }
        return prev;
      });
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'channels'));

    return () => unsub();
  }, [triggerInitialAd]);

  // Fetch Config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configs', 'global'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as AppConfig);
      }
    }, (err) => console.error("Failed to fetch config", err));
    return () => unsub();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setCheckingAdmin(true);
        // Double check with lower case
        const isHardcodedAdmin = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        
        if (isHardcodedAdmin) {
          setIsAdmin(true);
        } else {
          // Check if user exists in admins collection
          try {
            const adminSnap = await getDoc(doc(db, 'admins', u.uid));
            setIsAdmin(adminSnap.exists());
          } catch (e) {
            setIsAdmin(false);
          }
        }
        setCheckingAdmin(false);
      } else {
        setIsAdmin(false);
        setCheckingAdmin(false);
      }
    });
    return () => unsub();
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

  const handleLogin = () => {
    setAuthError('');
    setAuthPassword('');
    setShowLoginModal(true);
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
      setShowLoginModal(false);
    } catch (err: any) {
      console.error("Google authentication error:", err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError('পপআপ ব্রাউজার দ্বারা ব্লক করা হয়েছে। দয়া করে আপনার ব্রাউজারে পপআপ অনুমোদন দিন অথবা নতুন ট্যাবে ওপেন করে আবার চেষ্টা করুন।');
      } else if (err.code === 'auth/unauthorized-domain') {
        setAuthError('এই ডোমেইনটি Firebase-এ অনুমোদিত নয়। দয়া করে "Email & Password" লগইন অপশনটি ব্যবহার করুন।');
      } else {
        setAuthError(err.message || 'গুগল লগইন সফল হয়নি।');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;

    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setShowLoginModal(false);
    } catch (err: any) {
      console.error("Email authentication error:", err);
      // Fallback auto registration for ease of set up
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, authEmail, authPassword);
          setShowLoginModal(false);
        } catch (createErr: any) {
          console.error("Email user registration error:", createErr);
          if (createErr.code === 'auth/weak-password') {
            setAuthError('পাসওয়ার্ডটি অন্তত ৬ ডিজিটের হতে হবে।');
          } else if (createErr.code === 'auth/operation-not-allowed') {
            setAuthError('Firebase এ Email/Password লগইন পদ্ধতি চালু করা নেই। দয়া করে Firebase Console -> Build -> Authentication -> Sign-in Method এ গিয়ে Email/Password অপশনটি Enable করে দিন।');
          } else if (createErr.code === 'auth/email-already-in-use') {
            setAuthError('ভুল পাসওয়ার্ড! দয়া করে আপনার সেট করা সঠিক পাসওয়ার্ডটি ব্যবহার করুন।');
          } else {
            setAuthError(createErr.message || 'লগইন করতে ব্যর্থ হয়েছে।');
          }
        }
      } else if (err.code === 'auth/wrong-password') {
        setAuthError('ভুল পাসওয়ার্ড! দয়া করে আপনার সেট করা সঠিক পাসওয়ার্ডটি ব্যবহার করুন।');
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError('Firebase এ Email/Password লগইন পদ্ধতি চালু করা নেই। দয়া করে Firebase Console -> Build -> Authentication -> Sign-in Method এ গিয়ে Email/Password অপশনটি Enable করে দিন।');
      } else {
        setAuthError(err.message || 'লগইন করতে ব্যর্থ হয়েছে।');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const currentVideoUrl = (isAdMode && config?.adType !== 'image')
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
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all font-medium text-sm"
              title="Install as App (APK)"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}
          {checkingAdmin ? (
            <div className="w-8 h-8 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : isAdmin && (
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
                    className="flex flex-col gap-5 w-full items-stretch"
                  >
                    <div className="w-full flex flex-col gap-5">
                      <VideoPlayer 
                        url={currentVideoUrl}
                        isAdMode={isAdMode}
                        adType={config?.adType || 'video'}
                        adImageUrl={config?.adImageUrl || ''}
                        adLinkUrl={config?.adLinkUrl || ''}
                        adDuration={config?.initialAdDuration || 10}
                        onAdEnd={handleAdEnd}
                        title={isAdMode ? 'Advertisement' : currentChannel?.name}
                        channels={channels}
                        currentChannelId={currentChannel?.id || ''}
                        onSelectChannel={setCurrentChannel}
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

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden p-6 text-white shadow-2xl"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-all"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Tv size={18} className="text-white" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">এডমিন লগইন (Admin Login)</h2>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('email');
                    setAuthError('');
                  }}
                  className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'email' 
                      ? 'bg-blue-605 bg-blue-605/10 bg-blue-600 text-white shadow' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  ইমেইল ও পাসওয়ার্ড (ইন্টারনাল)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('google');
                    setAuthError('');
                  }}
                  className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'google' 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  গুগল লগইন
                </button>
              </div>

              {activeTab === 'google' ? (
                <div className="space-y-6 py-4">
                  <p className="text-sm text-white/60 leading-relaxed text-center">
                    গুগল সাইন-ইন পপআপ উইন্ডো ব্যবহার করে। যদি আপনার ব্রাউজারে পপআপ ব্লক করা থাকে তবে নিচে নির্দেশিত সাহায্য দেখুন।
                  </p>
                  
                  <button
                    onClick={handleGoogleLogin}
                    disabled={authLoading}
                    className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    {authLoading ? 'লগইন হচ্ছে...' : 'Google দিয়ে লগইন করুন'}
                  </button>

                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400 space-y-1">
                    <p className="font-semibold">💡 পরামর্শ (Tip):</p>
                    <p className="opacity-80 leading-relaxed">
                      গুগল লগইন কাজ না করলে ডানদিকের "Open in New Tab" বাটনে ক্লিক করে অ্যাপটি নতুন ট্যাবে ওপেন করে ট্রাই করুন, অথবা সহজ "ইমেইল ও পাসওয়ার্ড" ব্যবহার করুন।
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                      এডমিন ইমেইল (Admin Email)
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                      পাসওয়ার্ড (Password)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="আপনার পাসওয়ার্ড দিন (অন্তত ৬ ডিজিট)"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-11 py-3 text-sm focus:ring-2 focus:ring-blue-500/50 text-white outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-all"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow cursor-pointer"
                  >
                    {authLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      'এডমিন প্রবেশ করুন / রেজিস্টার'
                    )}
                  </button>

                  <div className="bg-zinc-800 border border-white/5 rounded-xl p-3 text-xs text-white/40 leading-relaxed">
                    🌟 প্রথমবার প্রবেশের ক্ষেত্রে যেকোনো ৬ ডিজিটের পাসওয়ার্ড দিয়ে সাবমিট করলে অ্যাকাউন্টটি স্বয়ংক্রিয়ভাবে তৈরি হয়ে যাবে। পরবর্তী লগইনের জন্য সেই একই পাসওয়ার্ড ব্যবহার করবেন।
                  </div>
                </form>
              )}

              {/* Error messages */}
              <AnimatePresence>
                {authError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-4 p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-xs rounded-xl flex gap-1 items-start"
                  >
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-500" />
                    <span className="leading-relaxed">{authError}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
