import React, { useState } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Channel, AppConfig } from '../types';
import { Plus, Trash2, Edit2, X, Save, Settings, Tv, Upload, Loader2 } from 'lucide-react';
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
  const [configData, setConfigData] = useState<AppConfig>(config || { initialAdDuration: 10, hourlyAdInterval: 3600, adVideoUrl: '' });
  const [view, setView] = useState<'channels' | 'settings'>('channels');
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData({ ...formData, logo: url });
    } catch (err) {
      console.error("Upload failed", err);
      alert("Logo upload failed. Please check your storage rules.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const channelRef = doc(db, 'channels', isEditing);
        await updateDoc(channelRef, { ...formData });
      } else {
        await addDoc(collection(db, 'channels'), { ...formData, order: channels.length });
      }
      resetForm();
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'channels');
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
    try {
      await setDoc(doc(db, 'configs', 'global'), configData);
      onRefresh();
      alert('Settings saved!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'configs/global');
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setShowAddForm(false);
    setFormData({ name: '', url: '', logo: '', order: channels.length });
  };

  const startEdit = (channel: Channel) => {
    setIsEditing(channel.id);
    setFormData(channel);
    setShowAddForm(true);
  };

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5 text-white shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="text-blue-500" />
          Admin Panel
        </h2>
        <div className="flex bg-white/5 rounded-lg p-1">
          <button 
            onClick={() => setView('channels')}
            className={`px-4 py-2 rounded-md transition-all ${view === 'channels' ? 'bg-blue-600' : 'hover:bg-white/5'}`}
          >
            Channels
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`px-4 py-2 rounded-md transition-all ${view === 'settings' ? 'bg-blue-600' : 'hover:bg-white/5'}`}
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
      ) : (
        <div className="space-y-6 max-w-md mx-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/40 mb-2">Initial Ad Duration (seconds)</label>
              <input
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2"
                value={configData.initialAdDuration}
                onChange={(e) => setConfigData({ ...configData, initialAdDuration: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm text-white/40 mb-2">Hourly Ad Interval (seconds)</label>
              <input
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2"
                value={configData.hourlyAdInterval}
                onChange={(e) => setConfigData({ ...configData, hourlyAdInterval: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm text-white/40 mb-2">Ad Overlay Video URL (M3U8/MP4)</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2"
                value={configData.adVideoUrl}
                onChange={(e) => setConfigData({ ...configData, adVideoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <button
              onClick={handleSaveConfig}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
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
