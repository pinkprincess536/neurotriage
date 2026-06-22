import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, ShieldAlert, KeyRound, ArrowRight } from 'lucide-react';
import BrainMascot from './BrainMascot';

interface LoginProps {
  onLogin: (role: 'admin' | 'doctor', name: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [role, setRole] = useState<'doctor' | 'admin'>('doctor');
  const [username, setUsername] = useState('dr_seymour@neurology.org');
  const [password, setPassword] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleChange = (selected: 'doctor' | 'admin') => {
    setRole(selected);
    if (selected === 'doctor') {
      setUsername('dr_seymour@neurology.org');
    } else {
      setUsername('eeg_admin@mit.edu');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Smooth delay to simulate login check
    setTimeout(() => {
      const displayName = role === 'doctor' ? 'Dr. Seymour' : 'Clinical Director Admin';
      onLogin(role, displayName);
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div id="login_screen" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Title block */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Cerebro<span className="text-rose-500 font-medium">EEG</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">Smart Seizure Triage & Detection Portal</p>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 max-w-md w-full flex flex-col items-center"
      >
        {/* Animated Brain Mascot */}
        <BrainMascot
          mood={isSubmitting ? 'thinking' : 'greetings'}
          className="mb-6 h-40"
          bubbleText={
            isSubmitting 
              ? "Checking security clearance..." 
              : role === 'doctor'
                ? "Welcome, Doctor! Please confirm your clinical portal login!"
                : "Hello, Admin! Switching to ML system metrics control panel."
          }
        />

        {/* Tab switcher */}
        <div className="flex bg-slate-100 rounded-2xl p-1.5 w-full mb-6">
          <button
            type="button"
            onClick={() => handleRoleChange('doctor')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl transition-all duration-200 ${
              role === 'doctor'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={14} className={role === 'doctor' ? 'text-rose-500' : ''} />
            Neurologist Portal
          </button>
          
          <button
            type="button"
            onClick={() => handleRoleChange('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl transition-all duration-200 ${
              role === 'admin'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldAlert size={14} className={role === 'admin' ? 'text-violet-500' : ''} />
            Clinical Admin
          </button>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <User size={16} />
              </span>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 transition-all duration-200"
                placeholder="doctor@hospital.org"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Access Password
              </label>
              <a href="#" className="text-xs text-rose-500 font-medium hover:underline">Forgot?</a>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <KeyRound size={16} />
              </span>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 transition-all duration-200"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-slate-500 text-xs text-center flex flex-col gap-1">
            <span className="font-bold text-slate-700">Demo Quick Credentials Loaded</span>
            <span>Click Login to proceed instantly</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 rounded-2xl text-sm font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-all duration-200 ${
              role === 'doctor'
                ? 'bg-rose-500 hover:bg-rose-600 focus:ring-4 focus:ring-rose-500/20 active:translate-y-0.5'
                : 'bg-violet-600 hover:bg-violet-700 focus:ring-4 focus:ring-violet-600/20 active:translate-y-0.5'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isSubmitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                Enter Platform
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Footer system details strictly based on CONTEXT.md parameters */}
      <div className="text-center mt-8 text-xs text-slate-400 max-w-xs space-y-1">
        <div>1D CNN Inference Core: EEGCNN1D Architecture</div>
        <div>Standardized 22-channel z-score pipeline ready.</div>
      </div>
    </div>
  );
}
