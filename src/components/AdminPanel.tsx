import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Channel, AppConfig } from '../types';
import { Plus, Trash2, Edit2, X, Save, Settings, Tv, Upload, Loader2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  channels: Channel[];
  config: AppConfig | null;
  onRefresh: () => void;
}

export default function AdminPanel({ channels, config, onRefresh }: AdminPanelProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Channel>>({ name: '', url: '', logo: '', order: 0 });
  const [configData, setConfigData] = useState<AppConfig>(config || { initialAdDuration: 10, hourlyAdInterval: 3600, adVideoUrl: '', adType: 'video', adImageUrl: '', adLinkUrl: '', apkUrl: '' });
  const [view, setView] = useState<'channels' | 'settings' | 'visitors'>('channels');
  const [visitors, setVisitors] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'presence'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = list.sort((a: any, b: any) => (b.lastActive || 0) - (a.lastActive || 0));
      setVisitors(sorted);
    }, (err) => console.error("Presence snapshot error", err));

    return () => unsub();
  }, []);
  const [adUploading, setAdUploading] = useState(false);
  const [adImageUploading, setAdImageUploading] = useState(false);
  const [apkUploading, setApkUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setConfigData((prev) => ({ ...prev, ...config }));
    }
  }, [config]);

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.apk')) {
      setSettingsError("Please select a valid APK file (.apk).");
      return;
    }

    setApkUploading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const storageRef = ref(storage, `apks/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setConfigData((prev) => ({ ...prev, apkUrl: url }));
      setSettingsSuccess("APK file uploaded successfully!");
    } catch (err: any) {
      console.error("APK upload failed", err);
      let errMsg = "APK upload failed. Please check your storage rules.";
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('Permission denied') || err.message.includes('insufficient permissions'))) {
        errMsg = "You do not have permission to upload files. Please make sure you are logged in as an Admin.";
      }
      setSettingsError(errMsg);
    } finally {
      setApkUploading(false);
    }
  };

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSettingsError("অনুগ্রহ করে একটি সঠিক ছবি ফাইল (.png, .jpg, .jpeg, .webp ইত্যাদি) নির্বাচন করুন।");
      return;
    }

    setAdImageUploading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const storageRef = ref(storage, `ad_images/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setConfigData((prev) => ({ ...prev, adImageUrl: url }));
      setSettingsSuccess("অ্যাড ফটো ফাইল সফলভাবে আপলোড হয়েছে!");
    } catch (err: any) {
      console.error("Ad image upload failed", err);
      let errMsg = "অ্যাড ফটো আপলোড ব্যর্থ হয়েছে। অনুগ্রহ করে স্টোরেজ রুলস চেক করুন।";
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('Permission denied') || err.message.includes('insufficient permissions'))) {
        errMsg = "অ্যাড ফটো আপলোড করার অনুমতি নেই। অনুগ্রহ করে নিশ্চিত করুন যে আপনি এডমিন ইমেইল দিয়ে লগইন করেছেন।";
      }
      setSettingsError(errMsg);
    } finally {
      setAdImageUploading(false);
    }
  };

  const handleAdFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setSettingsError("অনুগ্রহ করে একটি সঠিক ভিডিও ফাইল (.mp4, .mov ইত্যাদি) নির্বাচন করুন।");
      return;
    }

    setAdUploading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const storageRef = ref(storage, `ads/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setConfigData((prev) => ({ ...prev, adVideoUrl: url }));
      setSettingsSuccess("অ্যাড ভিডিও ফাইল সফলভাবে আপলোড হয়েছে!");
    } catch (err: any) {
      console.error("Ad video upload failed", err);
      let errMsg = "অ্যাড ভিডিও আপলোড ব্যর্থ হয়েছে। অনুগ্রহ করে স্টোরেজ রুলস চেক করুন।";
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('Permission denied') || err.message.includes('insufficient permissions'))) {
        errMsg = "অ্যাড ভিডিও আপলোড করার অনুমতি নেই। অনুগ্রহ করে নিশ্চিত করুন যে আপনি এডমিন ইমেইল দিয়ে লগইন করেছেন।";
      }
      setSettingsError(errMsg);
    } finally {
      setAdUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData({ ...formData, logo: url });
    } catch (err) {
      console.error("Upload failed", err);
      setError("Logo upload failed. Please check your storage rules.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const cleanData = {
        name: (formData.name || '').trim(),
        url: (formData.url || '').trim(),
        logo: (formData.logo || '').trim(),
        order: typeof formData.order === 'number' && !isNaN(formData.order) ? formData.order : channels.length,
      };

      if (!cleanData.name) {
        throw new Error('চ্যানেলের নাম অবশ্যই দিতে হবে।');
      }
      if (!cleanData.url) {
        throw new Error('চ্যানেলের স্ট্রিমিং URL অবশ্যই দিতে হবে।');
      }

      if (isEditing) {
        const channelRef = doc(db, 'channels', isEditing);
        await updateDoc(channelRef, cleanData);
      } else {
        await addDoc(collection(db, 'channels'), cleanData);
      }
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error("Submit error", err);
      let errMsg = err.message || 'চ্যানেল সংরক্ষণ করতে ব্যর্থ হয়েছে।';
      if (errMsg.includes('permission-denied') || errMsg.includes('Permission denied') || errMsg.includes('insufficient permissions')) {
        errMsg = 'চ্যানেল সংরক্ষণ করার অনুমতি নেই। অনুগ্রহ করে নিশ্চিত করুন যে আপনি এডমিন ইমেইল (connection.titascht@gmail.com) দিয়ে লগইন করেছেন।';
      }
      setError(errMsg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    try {
      await deleteDoc(doc(db, 'channels', id));
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `channels/${id}`);
    }
  };

  const handleSaveConfig = async () => {
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      await setDoc(doc(db, 'configs', 'global'), configData);
      onRefresh();
      setSettingsSuccess('গ্লোবাল সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      console.error("Save config failed", err);
      let errMsg = 'সেটিংস সংরক্ষণ করতে ব্যর্থ হয়েছে।';
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('Permission denied') || err.message.includes('insufficient permissions'))) {
        errMsg = "সেটিংস সংরক্ষণ করার অনুমতি নেই। অনুগ্রহ করে নিশ্চিত করুন যে আপনি এডমিন ইমেইল দিয়ে লগইন করেছেন।";
      }
      setSettingsError(errMsg);
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setShowAddForm(false);
    setError(null);
    setFormData({ name: '', url: '', logo: '', order: channels.length });
  };

  const startEdit = (channel: Channel) => {
    setIsEditing(channel.id);
    setFormData(channel);
    setError(null);
    setShowAddForm(true);
  };

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5 text-white shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="text-blue-500" />
          Admin Panel
        </h2>
        <div className="flex bg-white/5 rounded-lg p-1 gap-1">
          <button 
            onClick={() => setView('channels')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md transition-all ${view === 'channels' ? 'bg-blue-600' : 'hover:bg-white/5'}`}
          >
            Channels
          </button>
          <button 
            onClick={() => setView('visitors')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1.5 ${view === 'visitors' ? 'bg-emerald-600' : 'hover:bg-white/5'}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Viewers ({visitors.filter(v => Date.now() - (v.lastActive || 0) < 45000).length})
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md transition-all ${view === 'settings' ? 'bg-blue-600' : 'hover:bg-white/5'}`}
          >
            Settings
          </button>
        </div>
      </div>

      {view === 'channels' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium opacity-60">Manage Channels ({channels.length})</h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
              id="add-channel-btn"
            >
              <Plus size={20} />
              Add Channel
            </button>
          </div>

          <div className="grid gap-3">
            {channels.sort((a, b) => a.order - b.order).map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-black rounded flex items-center justify-center overflow-hidden border border-white/5">
                    {channel.logo ? <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-1" /> : <Tv size={20} className="opacity-20" />}
                  </div>
                  <div>
                    <div className="font-medium">{channel.name}</div>
                    <div className="text-xs opacity-40 truncate max-w-[200px]">{channel.url}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(channel)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"><Edit2 size={18} /></button>
                  <button onClick={() => handleDelete(channel.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : view === 'visitors' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-lg font-medium opacity-65">Live Viewers List</h3>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full animate-pulse flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {visitors.filter(v => Date.now() - (v.lastActive || 0) < 45000).length}
            </span>
          </div>

          <div className="grid gap-3">
            {visitors.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4 text-center select-none">No live viewers found.</p>
            ) : (
              visitors.map((visitor) => {
                const isActive = Date.now() - (visitor.lastActive || 0) < 45000;
                return (
                  <div key={visitor.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-300">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-zinc-600'}`} />
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-zinc-400 truncate">Visitor ID: {visitor.id}</div>
                        <div className="text-xs text-white/50 mt-1 truncate">
                          Current Channel: <span className="text-blue-400 font-semibold">{visitor.viewingChannel || 'Home Page'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0 pl-3">
                      <span className={`text-[10px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded-md ${isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>
                        {isActive ? 'Active' : 'Offline'}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 mt-1">
                        {visitor.lastActive ? new Date(visitor.lastActive).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-md mx-auto">
          {settingsError && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl flex gap-1.5 items-start">
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-500" />
              <span className="leading-relaxed">{settingsError}</span>
            </div>
          )}
          {settingsSuccess && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex gap-1.5 items-start">
              <span className="shrink-0 mt-0.5 text-emerald-500">✓</span>
              <span className="leading-relaxed">{settingsSuccess}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/40 mb-2">Initial Ad Duration (seconds)</label>
              <input
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                value={configData.initialAdDuration}
                onChange={(e) => setConfigData({ ...configData, initialAdDuration: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm text-white/40 mb-2">Hourly Ad Interval (seconds)</label>
              <input
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                value={configData.hourlyAdInterval}
                onChange={(e) => setConfigData({ ...configData, hourlyAdInterval: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm text-white/40 mb-2">বিজ্ঞাপনের ধরন (Ad Type)</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setConfigData({ ...configData, adType: 'video' })}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    (configData.adType === 'video' || !configData.adType)
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  ভিডিও বিজ্ঞাপন (Video Ad)
                </button>
                <button
                  type="button"
                  onClick={() => setConfigData({ ...configData, adType: 'image' })}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    configData.adType === 'image'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  ছবি বিজ্ঞাপন (Image Ad)
                </button>
              </div>
            </div>

            {(configData.adType === 'video' || !configData.adType) ? (
              <div>
                <label className="block text-sm text-white/40 mb-2">Ad Overlay Video URL (M3U8/MP4 বা আপলোড)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    value={configData.adVideoUrl}
                    onChange={(e) => {
                      setSettingsError(null);
                      setSettingsSuccess(null);
                      setConfigData({ ...configData, adVideoUrl: e.target.value });
                    }}
                    placeholder="https://... (M3U8 বা MP4 লিংক)"
                  />
                  <label className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center border border-white/5" title="ভিডিও ফাইল আপলোড করুন">
                    <input type="file" className="hidden" accept="video/*" onChange={handleAdFileUpload} disabled={adUploading} />
                    {adUploading ? <Loader2 size={18} className="animate-spin text-blue-400" /> : <Upload size={18} />}
                  </label>
                </div>
                <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
                  সরাসরি ভিডিওর লিংক দিতে পারেন অথবা ডানদিকের আপলোড আইকনে ক্লিক করে ডিভাইস থেকে যেকোনো অ্যাড ভিডিও (.mp4/etc) সরাসরি আপলোড করতে পারেন।
                </p>
                {configData.adVideoUrl && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 mt-3 space-y-1">
                    <span className="text-xs text-white/40 block">বর্তমান অ্যাড ভিডিও লিংক (Current Ad Video):</span>
                    <span className="text-xs text-blue-400 font-mono break-all block">{configData.adVideoUrl}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/40 mb-2">Ad Image URL (ফটো লিংক বা আপলোড)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                      value={configData.adImageUrl || ''}
                      onChange={(e) => {
                        setSettingsError(null);
                        setSettingsSuccess(null);
                        setConfigData({ ...configData, adImageUrl: e.target.value });
                      }}
                      placeholder="https://... (PNG/JPG ছবির লিংক)"
                    />
                    <label className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center border border-white/5" title="বিজ্ঞাপনের ছবি আপলোড করুন">
                      <input type="file" className="hidden" accept="image/*" onChange={handleAdImageUpload} disabled={adImageUploading} />
                      {adImageUploading ? <Loader2 size={18} className="animate-spin text-blue-400" /> : <Upload size={18} />}
                    </label>
                  </div>
                  <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
                    সরাসরি যেকোনো ছবির লিংক দিতে পারেন অথবা ডানদিকের আপলোড আইকনে ক্লিক করে ডিভাইস থেকে বিজ্ঞাপন হিসেবে ছবি আপলোড করতে পারেন।
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-white/40 mb-2">বিজ্ঞাপনে ক্লিক করলে যে লিংক ওপেন হবে (Optional Ad Link)</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    value={configData.adLinkUrl || ''}
                    onChange={(e) => setConfigData({ ...configData, adLinkUrl: e.target.value })}
                    placeholder="https://mywebsite.com (Optional)"
                  />
                  <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
                    ভিজিটর যখন ছবি বিজ্ঞাপনের উপর ট্যাপ করবে তখন এই লিংকে নিয়ে যাবে।
                  </p>
                </div>

                {configData.adImageUrl && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 space-y-2">
                    <span className="text-xs text-white/40 block">বর্তমান অ্যাড ছবি (Current Ad Image Preview):</span>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/10">
                      <img src={configData.adImageUrl} alt="Ad Preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-xs text-blue-400 font-mono break-all block">{configData.adImageUrl}</span>
                  </div>
                )}
              </div>
            )}

            {/* APK Download Settings */}
            <div className="pt-4 border-t border-white/5 space-y-4">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">APK Download Settings</h4>
              <div>
                <label className="block text-sm text-white/40 mb-2">Android APK URL or Upload file (.apk)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono"
                    value={configData.apkUrl || ''}
                    onChange={(e) => {
                      setSettingsError(null);
                      setSettingsSuccess(null);
                      setConfigData({ ...configData, apkUrl: e.target.value });
                    }}
                    placeholder="https://... (APK URL or upload)"
                  />
                  <label className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl cursor-pointer transition-colors shrink-0 flex items-center justify-center border border-white/5" title="Upload APK File">
                    <input type="file" className="hidden" accept=".apk" onChange={handleApkUpload} disabled={apkUploading} />
                    {apkUploading ? <Loader2 size={18} className="animate-spin text-blue-400" /> : <Upload size={18} />}
                  </label>
                </div>
                <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
                  Provide a direct APK download link or upload your compiled .apk file directly so that users can instantly download and run it on their devices.
                </p>
                {configData.apkUrl && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 mt-3 space-y-1">
                    <span className="text-xs text-white/40 block font-semibold text-emerald-400">✓ Active APK URL:</span>
                    <span className="text-[11px] text-zinc-400 font-mono break-all block">{configData.apkUrl}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/15"
            >
              Save Global Settings
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              onSubmit={handleSubmit}
              className="bg-[#2A2A2A] w-full max-w-lg rounded-3xl p-8 border border-white/10 relative shadow-2xl"
            >
              <button
                type="button"
                onClick={resetForm}
                className="absolute right-6 top-6 text-white/40 hover:text-white"
              >
                <X size={24} />
              </button>

              <h3 className="text-xl font-bold mb-6">{isEditing ? 'চ্যানেল সম্পাদনা' : 'নতুন চ্যানেল যোগ করুন'}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/40 mb-1">চ্যানেলের নাম</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-1">স্ট্রিমিং URL (M3U8)</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="block text-sm text-white/40 mb-1">লোগো (URL বা আপলোড)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                        value={formData.logo}
                        onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                        placeholder="https://..."
                      />
                      <label className="bg-white/10 hover:bg-white/20 p-3 rounded-xl cursor-pointer transition-colors shrink-0">
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                        {uploading ? <Loader2 size={24} className="animate-spin text-blue-400" /> : <Upload size={24} />}
                      </label>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-black rounded-xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {formData.logo ? (
                      <img src={formData.logo} alt="Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Tv size={24} className="opacity-20" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-1">সিরিয়াল নম্বর</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-4 p-3.5 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl flex gap-1.5 items-start"
                  >
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-500" />
                    <span className="leading-relaxed">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
