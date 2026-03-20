import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, Image as ImageIcon, Video, FileText, 
  Plus, Trash2, LogOut, Shield, AlertTriangle, X, Eye,
  StickyNote, ChevronRight, Search, Settings, Lock,
  Globe, Smartphone, Download, Check, ExternalLink,
  MoreVertical, Filter, Grid, List as ListIcon,
  Clock, Heart, Share2, Info, Key
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, onSnapshot, 
  addDoc, deleteDoc, doc, serverTimestamp, orderBy,
  updateDoc, getDoc, setDoc
} from 'firebase/firestore';
import { VaultItem, IntruderAlert, VaultNote, BrowserBookmark, AppLockItem } from '../types';
import { encryptFile, decryptFile } from '../services/encryption';

interface VaultProps {
  onLogout: () => void;
  isFake?: boolean;
}

type TabType = 'files' | 'notes' | 'alerts' | 'browser' | 'applock' | 'settings';
type CategoryType = 'all' | 'image' | 'video' | 'document';

export const Vault: React.FC<VaultProps> = ({ onLogout, isFake = false }) => {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [alerts, setAlerts] = useState<IntruderAlert[]>([]);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [appLocks, setAppLocks] = useState<AppLockItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [selectedNote, setSelectedNote] = useState<VaultNote | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Browser state
  const [browserUrl, setBrowserUrl] = useState('');
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '' });

  // Settings state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState<'real' | 'fake' | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const qFiles = query(
      collection(db, 'vault_items'), 
      where('userId', '==', auth.currentUser.uid),
      where('isFake', '==', isFake)
    );
    const unsubscribeFiles = onSnapshot(qFiles, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VaultItem));
      setItems(newItems);
    });

    const qNotes = query(
      collection(db, 'vault_notes'), 
      where('userId', '==', auth.currentUser.uid),
      where('isFake', '==', isFake)
    );
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      const newNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VaultNote));
      setNotes(newNotes);
    });

    const qAlerts = query(
      collection(db, 'intruder_alerts'), 
      where('userId', '==', auth.currentUser.uid),
      where('isFake', '==', isFake)
    );
    const unsubscribeAlerts = onSnapshot(qAlerts, (snapshot) => {
      const newAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IntruderAlert));
      setAlerts(newAlerts);
    });

    const qBookmarks = query(
      collection(db, 'browser_bookmarks'),
      where('userId', '==', auth.currentUser.uid),
      where('isFake', '==', isFake)
    );
    const unsubscribeBookmarks = onSnapshot(qBookmarks, (snapshot) => {
      const newBookmarks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrowserBookmark));
      setBookmarks(newBookmarks);
    });

    const qAppLocks = query(
      collection(db, 'app_locks'),
      where('userId', '==', auth.currentUser.uid),
      where('isFake', '==', isFake)
    );
    const unsubscribeAppLocks = onSnapshot(qAppLocks, (snapshot) => {
      const newAppLocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppLockItem));
      if (newAppLocks.length === 0) {
        // Seed some apps if empty
        const defaultApps = [
          { name: 'WhatsApp', packageName: 'com.whatsapp', isLocked: true },
          { name: 'Instagram', packageName: 'com.instagram.android', isLocked: false },
          { name: 'Facebook', packageName: 'com.facebook.katana', isLocked: true },
          { name: 'Gallery', packageName: 'com.android.gallery3d', isLocked: true },
          { name: 'Messages', packageName: 'com.android.mms', isLocked: false },
        ];
        defaultApps.forEach(app => {
          addDoc(collection(db, 'app_locks'), {
            ...app,
            userId: auth.currentUser?.uid,
            isFake
          });
        });
      }
      setAppLocks(newAppLocks);
    });

    return () => {
      unsubscribeFiles();
      unsubscribeNotes();
      unsubscribeAlerts();
      unsubscribeBookmarks();
      unsubscribeAppLocks();
    };
  }, [isFake]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    const MAX_FILE_SIZE = 600 * 1024; 
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / 1024).toFixed(0)}KB). Maximum allowed size is 600KB.`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const encrypted = encryptFile(content);
        
        if (new Blob([encrypted]).size > 1000 * 1024) {
          setError("Encrypted file size exceeds storage limits.");
          setIsUploading(false);
          setTimeout(() => setError(null), 5000);
          return;
        }

        let type: 'image' | 'video' | 'document' = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';

        await addDoc(collection(db, 'vault_items'), {
          name: file.name,
          type,
          encryptedData: encrypted,
          mimeType: file.type,
          createdAt: new Date().toISOString(),
          userId: auth.currentUser?.uid,
          isFake
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.title || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'vault_notes'), {
        title: newNote.title,
        content: encryptFile(newNote.content),
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid,
        isFake
      });
      setNewNote({ title: '', content: '' });
      setIsAddingNote(false);
    } catch (err) {
      console.error("Failed to add note:", err);
    }
  };

  const handleAddBookmark = async () => {
    if (!newBookmark.title || !newBookmark.url || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'browser_bookmarks'), {
        ...newBookmark,
        userId: auth.currentUser.uid,
        isFake
      });
      setNewBookmark({ title: '', url: '' });
      setIsAddingBookmark(false);
    } catch (err) {
      console.error("Failed to add bookmark:", err);
    }
  };

  const toggleAppLock = async (app: AppLockItem) => {
    try {
      await updateDoc(doc(db, 'app_locks', app.id), {
        isLocked: !app.isLocked
      });
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteDoc(doc(db, 'vault_items', id));
      if (selectedItem?.id === id) setSelectedItem(null);
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteDoc(doc(db, 'vault_notes', id));
      if (selectedNote?.id === id) setSelectedNote(null);
    }
  };

  const handleDownload = (item: VaultItem) => {
    try {
      const decrypted = decryptFile(item.encryptedData);
      const link = document.createElement('a');
      link.href = decrypted;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Failed to decrypt and download file.");
    }
  };

  const handleUpdatePin = async () => {
    if (!auth.currentUser) return;
    if (newPin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    try {
      const settingsRef = doc(db, 'user_settings', auth.currentUser.uid);
      const updateData = isChangingPin === 'real' 
        ? { vaultPin: newPin } 
        : { fakePin: newPin };
      
      await setDoc(settingsRef, updateData, { merge: true });
      alert("PIN updated successfully!");
      setIsChangingPin(null);
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      console.error("PIN update failed:", err);
      setError("Failed to update PIN.");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-6 h-6 text-emerald-400" />;
      case 'video': return <Video className="w-6 h-6 text-blue-400" />;
      default: return <FileText className="w-6 h-6 text-orange-400" />;
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    decryptFile(note.content).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[85vh] bg-zinc-950 text-white rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
      {/* Sidebar */}
      <div className="w-20 sm:w-64 bg-zinc-900/50 border-r border-white/5 flex flex-col p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <Shield className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold">Smart Vault</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              {isFake ? 'Decoy Mode' : 'Secure Mode'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'files', icon: Folder, label: 'My Files' },
            { id: 'notes', icon: StickyNote, label: 'Secure Notes' },
            { id: 'browser', icon: Globe, label: 'Private Browser' },
            { id: 'applock', icon: Smartphone, label: 'App Lock' },
            { id: 'alerts', icon: AlertTriangle, label: 'Intruder Alerts', badge: alerts.length },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group ${
                activeTab === tab.id 
                  ? 'bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-black' : 'group-hover:scale-110 transition-transform'}`} />
              <span className="hidden sm:block text-sm">{tab.label}</span>
              {tab.badge && tab.badge > 0 && activeTab !== tab.id && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button 
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 p-3 text-zinc-500 hover:text-red-400 transition-colors group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:block text-sm font-medium">Exit Vault</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'files' && (
              <motion.div 
                key="files"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex gap-2">
                    {['all', 'image', 'video', 'document'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat as CategoryType)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                          activeCategory === cat 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl text-sm font-bold cursor-pointer hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
                    <Plus className="w-4 h-4" />
                    Upload
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                </div>

                <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
                  {filteredItems.map((item) => (
                    <motion.div
                      layoutId={item.id}
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={viewMode === 'grid' 
                        ? "group relative aspect-square rounded-3xl bg-zinc-900/50 border border-white/5 p-4 flex flex-col items-center justify-center gap-3 hover:bg-zinc-800/80 transition-all cursor-pointer"
                        : "group flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800/80 transition-all cursor-pointer"
                      }
                    >
                      <div className={viewMode === 'grid' ? "p-4 bg-zinc-950 rounded-2xl" : "p-2 bg-zinc-950 rounded-xl"}>
                        {getIcon(item.type)}
                      </div>
                      <div className={viewMode === 'list' ? "flex-1 min-w-0" : "text-center"}>
                        <p className={`text-xs font-medium text-zinc-300 truncate ${viewMode === 'grid' ? 'px-2' : ''}`}>{item.name}</p>
                        {viewMode === 'list' && (
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button 
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'notes' && (
              <motion.div 
                key="notes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Secure Notes</h2>
                  <button 
                    onClick={() => setIsAddingNote(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl text-sm font-bold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    New Note
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredNotes.map((note) => (
                    <div 
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      className="group p-6 rounded-3xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800/80 transition-all cursor-pointer relative"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-500/10 rounded-xl">
                          <StickyNote className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="font-bold truncate pr-8">{note.title}</h3>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">
                        {decryptFile(note.content)}
                      </p>
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                        <button 
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          className="p-1.5 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'browser' && (
              <motion.div 
                key="browser"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text"
                      value={browserUrl}
                      onChange={(e) => setBrowserUrl(e.target.value)}
                      placeholder="Enter URL or search..."
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                    />
                  </div>
                  <button className="p-3 bg-zinc-900 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                    <Search className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 bg-zinc-900/30 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-24 h-24 bg-emerald-500/5 rounded-[2rem] flex items-center justify-center mb-6">
                    <Globe className="w-12 h-12 text-emerald-500/40" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Private Browser</h3>
                  <p className="text-zinc-500 max-w-sm mb-8">
                    Browse the web securely. Your history, cookies, and cache are automatically cleared when you exit the vault.
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl">
                    {[
                      { name: 'Google', url: 'google.com' },
                      { name: 'DuckDuckGo', url: 'duckduckgo.com' },
                      { name: 'Wikipedia', url: 'wikipedia.org' },
                      { name: 'Reddit', url: 'reddit.com' },
                    ].map(site => (
                      <button key={site.name} className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl hover:bg-zinc-800 transition-all group">
                        <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center mx-auto mb-2 text-zinc-500 group-hover:text-emerald-500 transition-colors">
                          <ExternalLink className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-zinc-400">{site.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'applock' && (
              <motion.div 
                key="applock"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">App Lock</h2>
                    <p className="text-xs text-zinc-500">Secure your installed applications</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/5 rounded-xl text-xs font-bold text-emerald-500">
                    <Shield className="w-4 h-4" />
                    Protection Active
                  </div>
                </div>

                <div className="space-y-2">
                  {appLocks.map(app => (
                    <div key={app.id} className="flex items-center gap-4 p-4 rounded-3xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800/50 transition-all">
                      <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center text-zinc-500">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-sm">{app.name}</h3>
                        <p className="text-[10px] text-zinc-600 font-mono">{app.packageName}</p>
                      </div>
                      <button 
                        onClick={() => toggleAppLock(app)}
                        className={`w-14 h-8 rounded-full p-1 transition-all ${app.isLocked ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full transition-all shadow-lg ${app.isLocked ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div 
                key="alerts"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold mb-6">Intruder Alerts</h2>
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                    <Shield className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-sm font-medium">No unauthorized access attempts</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="group relative overflow-hidden rounded-[2rem] bg-zinc-900/50 border border-white/5">
                        <img src={alert.photo} alt="Intruder" className="w-full aspect-video object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                          <div className="flex items-center gap-2 text-red-500 mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Intruder Detected</span>
                          </div>
                          <p className="text-sm font-medium text-white">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-xl space-y-8"
              >
                <h2 className="text-xl font-bold mb-6">Vault Settings</h2>
                
                <div className="space-y-4">
                  <div className="p-6 rounded-[2rem] bg-zinc-900/50 border border-white/5 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                          <Lock className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">Vault PIN</h3>
                          <p className="text-xs text-zinc-500">Primary access code</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsChangingPin('real')}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Change
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">Fake PIN</h3>
                          <p className="text-xs text-zinc-500">Decoy access code</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsChangingPin('fake')}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        {isFake ? 'Manage' : 'Set Up'}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-[2rem] bg-zinc-900/50 border border-white/5 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">Intruder Selfie</h3>
                          <p className="text-xs text-zinc-500">Capture photo on failed login</p>
                        </div>
                      </div>
                      <div className="w-12 h-6 bg-emerald-500 rounded-full p-1">
                        <div className="w-4 h-4 bg-white rounded-full translate-x-6" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-zinc-800 rounded-2xl text-zinc-400">
                          <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">Auto-Trash</h3>
                          <p className="text-xs text-zinc-500">Clear trash after 30 days</p>
                        </div>
                      </div>
                      <div className="w-12 h-6 bg-zinc-800 rounded-full p-1">
                        <div className="w-4 h-4 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {isChangingPin && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-8 rounded-[2.5rem] bg-zinc-900 border border-emerald-500/20 shadow-2xl shadow-emerald-500/5 space-y-6"
                  >
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Key className="w-5 h-5 text-emerald-500" />
                      {isChangingPin === 'real' ? 'Change Vault PIN' : 'Set Fake PIN'}
                    </h3>
                    <div className="space-y-4">
                      <input 
                        type="password"
                        placeholder="New PIN"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none"
                      />
                      <input 
                        type="password"
                        placeholder="Confirm PIN"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none"
                      />
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setIsChangingPin(null)}
                          className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold hover:bg-zinc-700 transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleUpdatePin}
                          className="flex-1 py-4 bg-emerald-500 text-black rounded-2xl font-bold hover:bg-emerald-400 transition-all"
                        >
                          Save PIN
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Item View Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md"
          >
            <motion.div 
              className="relative max-w-4xl w-full bg-zinc-900 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-8 right-8 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="flex flex-col md:flex-row h-[70vh]">
                <div className="flex-1 bg-black/40 flex items-center justify-center p-12 overflow-hidden">
                  {selectedItem.type === 'image' ? (
                    <img 
                      src={decryptFile(selectedItem.encryptedData)} 
                      alt={selectedItem.name} 
                      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-32 h-32 bg-zinc-800 rounded-[2.5rem] flex items-center justify-center shadow-xl">
                        {getIcon(selectedItem.type)}
                      </div>
                      <p className="text-zinc-500 font-mono text-sm">{selectedItem.mimeType}</p>
                    </div>
                  )}
                </div>

                <div className="w-full md:w-80 p-10 flex flex-col border-l border-white/5">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2 truncate">{selectedItem.name}</h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-8">
                      Added on {new Date(selectedItem.createdAt).toLocaleDateString()}
                    </p>

                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">File Type</p>
                        <p className="text-sm font-bold capitalize">{selectedItem.type}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Security</p>
                        <p className="text-sm font-bold text-emerald-500 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          AES-256 Encrypted
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-8">
                    <button 
                      onClick={() => handleDownload(selectedItem)}
                      className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Download className="w-5 h-5" />
                      Download & Decrypt
                    </button>
                    <button 
                      onClick={(e) => handleDeleteItem(selectedItem.id, e as any)}
                      className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete Permanently
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note View Modal */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              className="relative max-w-2xl w-full bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/10"
            >
              <button 
                onClick={() => setSelectedNote(null)}
                className="absolute top-6 right-6 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-orange-500/10 rounded-2xl">
                    <StickyNote className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedNote.title}</h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      {new Date(selectedNote.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="bg-black/20 rounded-3xl p-8 border border-white/5 min-h-[300px]">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {decryptFile(selectedNote.content)}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Note Modal */}
      <AnimatePresence>
        {isAddingNote && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              className="relative max-w-xl w-full bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/10"
            >
              <div className="p-10">
                <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
                  <Plus className="w-6 h-6 text-emerald-500" />
                  New Secure Note
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">Title</label>
                    <input 
                      type="text"
                      value={newNote.title}
                      onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                      className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none transition-all"
                      placeholder="Note title..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">Content</label>
                    <textarea 
                      value={newNote.content}
                      onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                      className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none transition-all min-h-[200px] resize-none"
                      placeholder="Write your secret note here..."
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsAddingNote(false)}
                      className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-700 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddNote}
                      className="flex-1 py-4 bg-emerald-500 text-black rounded-2xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
