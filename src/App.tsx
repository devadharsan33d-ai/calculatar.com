import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Calculator } from './components/Calculator';
import { Vault } from './components/Vault';
import { IntruderCapture } from './components/IntruderCapture';
import { Shield, Lock, Calculator as CalcIcon, LogIn, Key, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isFakeVault, setIsFakeVault] = useState(false);
  const [vaultPin, setVaultPin] = useState('1234');
  const [fakePin, setFakePin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState<'real' | 'fake' | null>(null);
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [shouldCapture, setShouldCapture] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Real-time listener for user settings
        const settingsRef = doc(db, 'user_settings', u.uid);
        unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setVaultPin(data.vaultPin || '1234');
            setFakePin(data.fakePin || '');
          } else {
            // Initialize with default PIN
            setDoc(settingsRef, { userId: u.uid, vaultPin: '1234', fakePin: '' });
            setVaultPin('1234');
            setFakePin('');
          }
          setIsAuthReady(true);
        });
      } else {
        setIsAuthReady(true);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, []);

  const handlePinEntered = (pin: string) => {
    // Special code to change PIN
    if (pin === '996548') {
      setIsChangingPin('real');
      return;
    }
    
    // Special code to set Fake PIN
    if (pin === '887412') {
      setIsChangingPin('fake');
      return;
    }

    if (pin === vaultPin) {
      if (isConfirmingLogout) {
        performLogout();
      } else {
        setIsVaultOpen(true);
        setIsFakeVault(false);
        setFailedAttempts(0);
      }
    } else if (fakePin && pin === fakePin) {
      setIsVaultOpen(true);
      setIsFakeVault(true);
      setFailedAttempts(0);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setShouldCapture(true);
        setFailedAttempts(0);
      }
    }
  };

  const handleSetNewPin = async () => {
    if (newPin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (user) {
      const settingsRef = doc(db, 'user_settings', user.uid);
      const updateData = isChangingPin === 'real' 
        ? { vaultPin: newPin } 
        : { fakePin: newPin };
      
      await setDoc(settingsRef, updateData, { merge: true });
      
      if (isChangingPin === 'real') setVaultPin(newPin);
      else setFakePin(newPin);
      
      setIsChangingPin(null);
      setNewPin('');
      setConfirmPin('');
      setError('');
      alert(`${isChangingPin === 'real' ? 'Vault' : 'Fake'} PIN updated!`);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogoutRequest = () => {
    setIsConfirmingLogout(true);
    setIsVaultOpen(false);
  };

  const performLogout = async () => {
    await signOut(auth);
    setIsVaultOpen(false);
    setIsConfirmingLogout(false);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-900/50 border border-white/10 rounded-3xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Smart Vault</h1>
          <p className="text-zinc-500 mb-8">Secure your private files behind a functional calculator.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-zinc-800 rounded-xl text-zinc-400">
                <Lock className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">AES-256</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-zinc-800 rounded-xl text-zinc-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Intruder</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-zinc-800 rounded-xl text-zinc-400">
                <CalcIcon className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Stealth</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {isChangingPin ? (
          <motion.div 
            key="change-pin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-xl ${isChangingPin === 'real' ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                <Key className={`w-6 h-6 ${isChangingPin === 'real' ? 'text-orange-500' : 'text-blue-500'}`} />
              </div>
              <h2 className="text-xl font-bold text-white">
                {isChangingPin === 'real' ? 'Change Vault PIN' : 'Set Fake PIN'}
              </h2>
            </div>

            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
              {isChangingPin === 'real' 
                ? 'This PIN will open your primary secure vault.' 
                : 'Entering this PIN will open a decoy vault with dummy data to protect your real files.'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">New PIN</label>
                <input 
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-xl p-4 text-white focus:border-emerald-500/50 outline-none transition-colors"
                  placeholder="Enter 4+ digits"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">Confirm PIN</label>
                <input 
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-xl p-4 text-white focus:border-emerald-500/50 outline-none transition-colors"
                  placeholder="Confirm PIN"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => { setIsChangingPin(null); setError(''); }}
                  className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSetNewPin}
                  className={`flex-1 py-3 text-white rounded-xl font-medium transition-colors ${isChangingPin === 'real' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  Save PIN
                </button>
              </div>
            </div>
          </motion.div>
        ) : !isVaultOpen ? (
          <motion.div 
            key="calculator"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="w-full max-w-md relative"
          >
            {isConfirmingLogout && (
              <div className="absolute -top-12 left-0 right-0 text-center text-orange-500 text-sm font-medium animate-pulse">
                Enter PIN to confirm logout
              </div>
            )}
            <Calculator onPinEntered={handlePinEntered} />
            {isConfirmingLogout && (
              <button 
                onClick={() => setIsConfirmingLogout(false)}
                className="mt-4 w-full py-2 text-zinc-500 hover:text-zinc-300 text-xs uppercase tracking-widest transition-colors"
              >
                Cancel Logout
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="vault"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-4xl"
          >
            <Vault onLogout={handleLogoutRequest} isFake={isFakeVault} />
          </motion.div>
        )}
      </AnimatePresence>

      {shouldCapture && (
        <IntruderCapture onCaptureComplete={() => setShouldCapture(false)} />
      )}

      {/* Security Overlay for Vault */}
      {isVaultOpen && (
        <div className="fixed inset-0 pointer-events-none z-[100] border-[20px] border-emerald-500/5" />
      )}
    </div>
  );
}
