import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Upload, FileText, CheckCircle2, XCircle, AlertCircle, 
  ArrowLeft, Brain, Calendar, Clock, Sliders, ChevronRight, Activity, 
  Settings, Play, Info, Check, X, Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { Patient, SessionLog, EegSegment, EEG_CHANNELS, MODEL_THRESHOLDS_SWEEP } from '../types';
import BrainMascot, { MascotMood } from './BrainMascot';

interface DoctorDashboardProps {
  patientsList: Patient[];
  onAddPatient: (patient: Patient) => void;
  onSaveLog: (patientId: string, updatedLog: SessionLog) => void;
  displayName: string;
  onLogout: () => void;
}

export default function DoctorDashboard({
  patientsList,
  onAddPatient,
  onSaveLog,
  displayName,
  onLogout
}: DoctorDashboardProps) {
  // Navigation & selection state
  const [selectedPatientId, setSelectedPatientId] = useState<string>('chb01');
  const [activeLog, setActiveLog] = useState<SessionLog | null>(null);
  
  // Search & Filter Patients
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'M' | 'F'>('all');
  
  // Patient Creation Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('18');
  const [newPatientGender, setNewPatientGender] = useState<'M' | 'F'>('F');
  const [newPatientNotes, setNewPatientNotes] = useState('');

  // Mascot dynamic controls
  const [mascotMood, setMascotMood] = useState<MascotMood>('waving');
  const [mascotCustomText, setMascotCustomText] = useState<string | undefined>(undefined);

  // File uploading states
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState<number>(0); // 0=idle, 1=uploading, 2=cleaning, 3=processing, 4=done
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active workspace parameter adjustment
  const [clinicalThreshold, setClinicalThreshold] = useState<number>(0.50);
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null);
  const [visibleChannelsCount, setVisibleChannelsCount] = useState<number>(6); // Show top 6 channels to fit nicely

  const currentPatient = patientsList.find(p => p.id === selectedPatientId) || patientsList[0];

  // Mascot greeting upon patient change
  useEffect(() => {
    setMascotMood('waving');
    setMascotCustomText(`Viewing records for ${currentPatient.name}. Age ${currentPatient.age}, ${currentPatient.gender === 'F' ? 'Female' : 'Male'}.`);
  }, [selectedPatientId, currentPatient.name]);

  // EEG simulation functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      simulateUpload(e.dataTransfer.files[0].name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      simulateUpload(e.target.files[0].name);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Step-by-step EEG Processing Pipeline Simulation matching actual notebook configs
  const simulateUpload = (fileName: string) => {
    // If not ending in .edf, give error but proceed for ease of testing with nice comment
    const nameToUse = fileName.toLowerCase().endsWith('.edf') ? fileName : `${fileName.split('.')[0] || 'recording'}.edf`;
    setUploadedFileName(nameToUse);
    setUploadProgressStep(1);
    setMascotMood('thinking');
    setMascotCustomText("Receiving file stream... standardizing bipolar electrode arrays...");

    // Stage 1: Uploading
    setTimeout(() => {
      setUploadProgressStep(2);
      setMascotCustomText("Applying Bandpass Filter 0.5–40 Hz & Notch Filter 60 Hz on 22 channels.");
      
      // Stage 2: Bandpass & Notch filter
      setTimeout(() => {
        setUploadProgressStep(3);
        setMascotMood('analyzing');
        setMascotCustomText("Segmenting into 7-second overlapping windows. Running EEGCNN1D neural weights inference...");

        // Stage 3: Neural network 1D CNN classifier execution
        setTimeout(() => {
          setUploadProgressStep(4);
          setMascotMood('success');
          setMascotCustomText("Analysis complete! Identified 3 potentially critical seizure nodes. Surface results generated.");

          // Create new simulated recording session log
          const newSession: SessionLog = {
            id: `new_log_${Date.now()}`,
            fileName: nameToUse,
            uploadDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
            durationSeconds: 3600, // 1 hour
            detectedCount: 3,
            isReviewed: false,
            status: 'Needs Review',
            thresholdUsed: 0.50,
            confirmedSeizures: 0,
            rejectedSeizures: 0,
            segments: [
              {
                id: 'new_seg_1',
                startTime: 412,
                duration: 7,
                confidence: 91.2,
                reviewStatus: 'pending',
                channels: ['FP1-F7', 'F7-T7', 'FT9-FT10'],
                topSpikeChannels: ['FP1-F7']
              },
              {
                id: 'new_seg_2',
                startTime: 1845,
                duration: 7,
                confidence: 84.7,
                reviewStatus: 'pending',
                channels: ['FP2-F4', 'CP1-CP2', 'T8-O2'],
                topSpikeChannels: ['CP1-CP2']
              },
              {
                id: 'new_seg_3',
                startTime: 2980,
                duration: 7,
                confidence: 72.1,
                reviewStatus: 'pending',
                channels: ['FT9-FT10', 'FC5-FC6', 'T9-T10'],
                topSpikeChannels: ['FT9-FT10']
              }
            ]
          };

          // Automatically open the recién triaged session log!
          setActiveLog(newSession);
          // Auto highlight first segment
          setFocusedSegmentId(newSession.segments[0].id);
        }, 2200);
      }, 1500);
    }, 1500);
  };

  // Create Patient Form Action
  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;

    const patientId = `chb${String(patientsList.length + 1).padStart(2, '0')}`;
    const newPatient: Patient = {
      id: patientId,
      name: `${newPatientName} (${patientId.toUpperCase()})`,
      age: parseInt(newPatientAge, 10) || 20,
      gender: newPatientGender,
      totalRecordings: 0,
      avgSeizuresPerDay: 0,
      notes: newPatientNotes || 'Self-created ambulatory EEG monitoring subject.',
      seizureLogs: []
    };

    onAddPatient(newPatient);
    setSelectedPatientId(patientId);
    setShowAddModal(false);
    
    // Reset fields
    setNewPatientName('');
    setNewPatientAge('18');
    setNewPatientGender('F');
    setNewPatientNotes('');

    setMascotMood('success');
    setMascotCustomText(`Fantastic! Created record for patient ${newPatient.name} successfully!`);
  };

  // Handle Review Actions (Feedback Loop)
  const handleVerifyEvent = (segmentId: string, isConfirmed: boolean) => {
    if (!activeLog) return;
    
    const updatedSegments = activeLog.segments.map(seg => {
      if (seg.id === segmentId) {
        return { 
          ...seg, 
          reviewStatus: isConfirmed ? ('confirmed' as const) : ('rejected' as const) 
        };
      }
      return seg;
    });

    const confirmedCount = updatedSegments.filter(s => s.reviewStatus === 'confirmed').length;
    const rejectedCount = updatedSegments.filter(s => s.reviewStatus === 'rejected').length;
    const pendingCount = updatedSegments.filter(s => s.reviewStatus === 'pending').length;

    const updatedLog: SessionLog = {
      ...activeLog,
      segments: updatedSegments,
      confirmedSeizures: confirmedCount,
      rejectedSeizures: rejectedCount,
      isReviewed: pendingCount === 0,
      status: pendingCount === 0 
        ? (confirmedCount > 0 ? 'Critical Alert' : 'Low Risk') 
        : 'Needs Review'
    };

    setActiveLog(updatedLog);

    if (isConfirmed) {
      setMascotMood('success');
      setMascotCustomText("Segment confirmed! This training window label is tagged with standard true EEG indicators.");
    } else {
      setMascotMood('waving');
      setMascotCustomText("Marked as noise artifact. This will prevent false warnings on temporal delta-waves.");
    }
  };

  // Save the full log stats back to the main patient logs array of applet state
  const handleSaveWorkspaceReport = () => {
    if (!activeLog || !selectedPatientId) return;

    onSaveLog(selectedPatientId, activeLog);
    
    // Close log workspace, go back to patient details page
    setActiveLog(null);
    setMascotMood('success');
    setMascotCustomText(`Report for ${activeLog.fileName} archived securely! Metrics updated in the live patient dashboard.`);
  };

  // Filtered Patient List
  const filteredPatients = patientsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || p.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  // Generate mock waves for 22 channels based on some frequency offsets
  const renderMockEegSignal = () => {
    if (!activeLog) return null;
    const currentSegment = activeLog.segments.find(s => s.id === focusedSegmentId) || activeLog.segments[0];
    if (!currentSegment) return null;

    // Use a fixed high amplitude spike for confirmed segments or high confidence ones
    const isHighSeizureZone = currentSegment.confidence > (clinicalThreshold * 100);

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-inner">
        {/* Top header stats */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-white text-xs font-mono font-medium tracking-wide">
              MONITORING AXIS: Bipolar 22-Channel raw signal output
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div>Window: 7.0 seconds (1792 samples @ 256Hz)</div>
            <div className="text-rose-400 bg-rose-950/40 border border-rose-900/40 px-2 py-0.5 rounded">
              Center: UTC {currentSegment.startTime}s - {currentSegment.startTime + 7}s
            </div>
          </div>
        </div>

        {/* 22 Bipolar Channels list, clipped based on visibility */}
        <div className="space-y-4">
          {EEG_CHANNELS.slice(0, visibleChannelsCount).map((channel, cIdx) => {
            const isSpikeChannel = currentSegment.channels.includes(channel) || currentSegment.topSpikeChannels.includes(channel);
            
            // Build visual mathematical SVG path for EEG recording wave
            let pathString = `M 0 25`;
            const width = 600;
            const pointsCount = 120;
            for (let i = 0; i <= pointsCount; i++) {
              const x = (i / pointsCount) * width;
              
              // Base wave components
              let amp = 3;
              let freq1 = 0.15;
              let freq2 = 0.45;
              
              // If it's a seizure zone, apply synchronous high amplitude spike discharge patterns (3Hz spike wave sequences)
              if (isHighSeizureZone && isSpikeChannel) {
                // Seizure spikes are highly rhythmic and high amplitude
                const distanceToCenter = Math.abs(i - pointsCount / 2);
                const envelop = Math.max(0, 1 - distanceToCenter / (pointsCount * 0.4)); // Concentrated near center of window
                const seizureFrequency = 0.6; // Rhythmic
                const spikeComponent = Math.abs(Math.sin((i / 8) * Math.PI)) > 0.85 ? -25 : 8; // Sharp negative spike discharges
                amp = amp + envelop * (Math.sin(i * seizureFrequency) * 12 + spikeComponent);
              } else {
                // Dynamic normal background activity waves
                amp = amp + Math.sin(i * freq1 + cIdx) * 3 + Math.cos(i * freq2 - cIdx) * 2;
                // occasional minor random artifact spikes
                if (i % 25 === 0) amp += (Math.random() - 0.5) * 6;
              }

              pathString += ` L ${x} ${25 + amp}`;
            }

            return (
              <div key={channel} className="flex items-center gap-4 border-b border-slate-800/60 pb-3 last:border-0 last:pb-0">
                {/* Channel Label */}
                <div className="w-24 flex flex-col">
                  <span className={`text-[11px] font-mono font-bold ${isSpikeChannel && isHighSeizureZone ? 'text-rose-400' : 'text-slate-400'}`}>
                    {channel}
                  </span>
                  <span className="text-[9px] font-mono font-medium text-slate-600">
                    {isSpikeChannel && isHighSeizureZone ? 'Eliciting spike' : 'Filtered trace'}
                  </span>
                </div>

                {/* Live SVG Graph Canvas */}
                <div className="flex-1 h-12 bg-slate-950/60 rounded-xl relative overflow-hidden flex items-center px-1">
                  {/* Grid lines backdrop */}
                  <div className="absolute inset-0 grid grid-cols-6 pointer-events-none opacity-5">
                    <div className="border-r border-teal-400 h-full" />
                    <div className="border-r border-teal-400 h-full" />
                    <div className="border-r border-teal-400 h-full" />
                    <div className="border-r border-teal-400 h-full" />
                    <div className="border-r border-teal-400 h-full" />
                    <div className="border-r border-teal-400 h-full" />
                  </div>

                  {/* Amplitude calibration guide lines */}
                  {isSpikeChannel && isHighSeizureZone && (
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-rose-500/10 pointer-events-none" />
                  )}

                  <svg viewBox={`0 0 ${width} 50`} className="w-full h-full overflow-visible">
                    <motion.path
                      d={pathString}
                      fill="none"
                      stroke={isSpikeChannel && isHighSeizureZone ? '#F87171' : '#14B8A6'}
                      strokeWidth={isSpikeChannel && isHighSeizureZone ? 1.8 : 1}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </svg>

                  {/* Flag warning */}
                  {isSpikeChannel && isHighSeizureZone && (
                    <span className="absolute right-3 top-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-bold font-mono px-1.5 py-0.5 rounded uppercase">
                      Spike discharge
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* View toggle for more channels */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center">
          <div className="text-[10px] text-slate-500 font-mono">
            *Z-score normalized stats applied. Electrodes mapped using bipolar montage standard configuration.
          </div>
          <button
            type="button"
            onClick={() => setVisibleChannelsCount(prev => prev === 6 ? 12 : prev === 12 ? 22 : 6)}
            className="text-xs text-cyan-400 font-mono hover:underline font-bold flex items-center gap-1.5"
          >
            <RefreshCw size={11} />
            Montage view: {visibleChannelsCount}/22 Channels
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="doctor_portal" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-rose-500 p-2.5 rounded-2xl text-white shadow-md">
            <Brain size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-800">CerebroEEG</h1>
              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Clinician Portal
              </span>
            </div>
            <p className="text-xs text-slate-500">Subject triage, model verification, & feedback loop</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-slate-500 uppercase">Logged Staff</span>
            <span className="text-sm font-semibold text-slate-700">{displayName}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold px-4 py-2 rounded-xl transition duration-150"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div id="main_layout_split" className="flex-1 flex flex-col lg:flex-row">
        
        {/* Left Column: Patient Selector Side Rail */}
        <div className="w-full lg:w-80 bg-white border-r border-slate-100 p-6 flex flex-col gap-4 shrink-0">
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm">
              <Users size={16} className="text-rose-500" />
              CHB Subject Cohort ({patientsList.length})
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition duration-150 inline-flex items-center gap-1"
              title="Add New Patient Subject"
            >
              <UserPlus size={16} />
              <span className="text-xs font-bold">New</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10"
              placeholder="Search Subject (chb01, chb24)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Filter size={14} />
            </span>
          </div>

          {/* Gender filter */}
          <div className="flex bg-slate-50 rounded-xl p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setGenderFilter('all')}
              className={`flex-1 py-1 text-center rounded-lg ${genderFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('F')}
              className={`flex-1 py-1 text-center rounded-lg ${genderFilter === 'F' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
            >
              Female
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('M')}
              className={`flex-1 py-1 text-center rounded-lg ${genderFilter === 'M' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
            >
              Male
            </button>
          </div>

          {/* Patient Scroll Area */}
          <div className="flex-1 overflow-y-auto max-h-[250px] lg:max-h-[calc(100vh-290px)] space-y-1.5 pr-1">
            {filteredPatients.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">No matching patients found.</div>
            ) : (
              filteredPatients.map((patient) => {
                const isSelected = patient.id === selectedPatientId;
                const totalLogs = patient.seizureLogs.length;
                const unreviewedCount = patient.seizureLogs.filter(l => !l.isReviewed).length;

                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(patient.id);
                      setActiveLog(null); // Return to landing page of patient
                    }}
                    className={`w-full text-left p-3 rounded-xl transition duration-150 flex items-center justify-between border ${
                      isSelected 
                        ? 'bg-rose-50/50 border-rose-200 text-rose-900 shadow-xs' 
                        : 'border-transparent bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate">
                        {patient.name}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                        {patient.age} y/o • {patient.gender === 'F' ? 'Female' : 'Male'} • {totalLogs} uploads
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {unreviewedCount > 0 && (
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping absolute block" />
                      )}
                      {unreviewedCount > 0 ? (
                        <span className="relative bg-rose-500 text-white text-[9px] font-black tracking-tight px-1.5 py-0.5 rounded-full">
                          {unreviewedCount}
                        </span>
                      ) : totalLogs > 0 ? (
                        <span className="text-emerald-600 bg-emerald-50 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          Done
                        </span>
                      ) : null}
                      <ChevronRight size={12} className={isSelected ? 'text-rose-500' : 'text-slate-400'} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Section: Core Triage Sandbox Area */}
        <div id="workspace_right_container" className="flex-1 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-80px)]">
          
          <AnimatePresence mode="wait">
            {!activeLog ? (
              
              /* ==============================================================
                 VIEW A: PATIENT LANDING HOME & HISTORIC LOGS (LANDING PAGE)
                 ============================================================== */
              <motion.div
                key="patient_landing"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Patient Summary Header Profile */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-xs font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-lg uppercase tracking-wide">
                        Active Case File: {currentPatient.id.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{currentPatient.name}</h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                      {currentPatient.notes}
                    </p>
                  </div>

                  {/* Demographic specs */}
                  <div className="flex gap-4 border-l border-slate-100 pl-6 shrink-0">
                    <div className="text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Age</span>
                      <span className="text-lg font-black text-slate-700">{currentPatient.age}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Sex</span>
                      <span className="text-lg font-black text-slate-700">{currentPatient.gender}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Baseline Seizures</span>
                      <span className="text-lg font-black text-amber-600">{currentPatient.avgSeizuresPerDay}/day</span>
                    </div>
                  </div>
                </div>

                {/* Dashboard Stats Panel */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Total records uploaded */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                    <div className="bg-rose-50 text-rose-500 p-3 rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">EDF Datasets</span>
                      <span className="text-xl font-bold text-slate-700">{currentPatient.seizureLogs.length} processed</span>
                    </div>
                  </div>

                  {/* Confirmed seizures total */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                    <div className="bg-emerald-50 text-emerald-500 p-3 rounded-xl">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">True Positives</span>
                      <span className="text-xl font-bold text-slate-700">
                        {currentPatient.seizureLogs.reduce((sum, log) => sum + log.confirmedSeizures, 0)} confirmed
                      </span>
                    </div>
                  </div>

                  {/* False positives total */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                    <div className="bg-amber-50 text-amber-500 p-3 rounded-xl">
                      <XCircle size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">False Alarms</span>
                      <span className="text-xl font-bold text-slate-700">
                        {currentPatient.seizureLogs.reduce((sum, log) => sum + log.rejectedSeizures, 0)} discarded
                      </span>
                    </div>
                  </div>

                  {/* EEG free status */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                    <div className="bg-cyan-50 text-cyan-500 p-3 rounded-xl">
                      <Activity size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current montage</span>
                      <span className="text-xl font-bold text-slate-700">22 Bipolar</span>
                    </div>
                  </div>
                </div>

                {/* Primary Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left block - Upload Zone & Mascot Interactivity */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Interactive Cerebro Mascot Card */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col items-center">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Interactive Digital Assistant</h3>
                      <BrainMascot 
                        mood={mascotMood} 
                        bubbleText={mascotCustomText}
                        className="h-44 w-full"
                        onClick={() => {
                          setMascotMood('waving');
                          setMascotCustomText("Yay! Thanks for clicking me! Hover or configure thresholds, and I will calculate saved triage hours.");
                        }}
                      />
                      <div className="text-center mt-3 text-[10px] text-slate-400 font-medium">
                        *Cerebro reacts automatically to your processing workflow. Click him for greeting!
                      </div>
                    </div>

                    {/* Standard Drag & Drop File Upload Region */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Upload Raw EEG Log Data</h3>
                      
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition duration-150 cursor-pointer ${
                          isDragOver 
                            ? 'border-rose-400 bg-rose-50/50' 
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
                        }`}
                        onClick={triggerUploadClick}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".edf,.bin,.npy"
                          onChange={handleFileSelect}
                        />

                        {uploadProgressStep === 0 ? (
                          <div className="space-y-2">
                            <div className="text-rose-500 flex justify-center mb-1">
                              <Upload size={36} className="animate-bounce" />
                            </div>
                            <span className="block text-xs font-bold text-slate-700">Drag or click to choose EEG file</span>
                            <span className="block text-[10px] text-slate-400">Supports .edf formats (CHB-MIT standard)</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-center">
                              <Activity size={32} className="text-rose-500 animate-pulse" />
                            </div>
                            
                            <span className="block text-xs font-bold text-slate-700 truncate max-w-full">
                              {uploadedFileName}
                            </span>

                            {/* Processing Progress Bar stepper */}
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-rose-500 h-full rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${
                                    uploadProgressStep === 1 ? '25%' :
                                    uploadProgressStep === 2 ? '50%' :
                                    uploadProgressStep === 3 ? '80%' : '100%'
                                  }` 
                                }} 
                              />
                            </div>
                            
                            <span className="block text-[10px] font-bold font-mono text-rose-500">
                              {uploadProgressStep === 1 && "ALIGNED ELECTRODES..."}
                              {uploadProgressStep === 2 && "BANDPASS 0.5-40Hz & Notch 60Hz..."}
                              {uploadProgressStep === 3 && "INFERENCE MODEL ACTIVE..."}
                              {uploadProgressStep === 4 && "COMPLETE!"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Diagnostic trigger simulation */}
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => simulateUpload(`chb${currentPatient.id.slice(3)}_untested_24h.edf`)}
                          className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold py-2 rounded-xl border border-rose-200/40 inline-flex items-center justify-center gap-1.5"
                        >
                          <Play size={10} />
                          Simulate Fast EDF Stream
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right block - Historic Logs List */}
                  <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Patient Recording History & Archived Triages
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Saved persistent reports: {currentPatient.seizureLogs.length}
                      </span>
                    </div>

                    {currentPatient.seizureLogs.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                        <FileText size={40} className="text-slate-300 mb-3" />
                        <span className="block text-xs font-bold text-slate-500">No triage reports cataloged</span>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                          Drag/drop or simulate an EEG file on the left side rails to initiate triage detection.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                        {currentPatient.seizureLogs.map((log) => {
                          const percentDone = log.segments.length > 0 
                            ? Math.round(((log.confirmedSeizures + log.rejectedSeizures) / log.segments.length) * 100) 
                            : 100;

                          return (
                            <div 
                              key={log.id} 
                              className="border border-slate-100 rounded-2xl p-4 hover:border-rose-100 bg-slate-50/40 hover:bg-white transition duration-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-slate-800 tracking-tight truncate block max-w-[180px] sm:max-w-none">
                                    {log.fileName}
                                  </span>
                                  {log.isReviewed ? (
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                      Reviewed
                                    </span>
                                  ) : (
                                    <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                                      Pending ({log.segments.length})
                                    </span>
                                  )}
                                  
                                  {log.detectedCount > 3 && (
                                    <span className="bg-rose-50 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                      Symptomatic spike
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} /> {log.uploadDate}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} /> {log.durationSeconds / 3600} hr recording
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                                <div className="text-right">
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Seizure results</span>
                                  <span className="text-xs font-bold text-slate-700">
                                    {log.isReviewed 
                                      ? `${log.confirmedSeizures} true / ${log.rejectedSeizures} noise`
                                      : `${log.detectedCount} candidate segments`
                                    }
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    // Make a local clone so editing doesn't mutate baseline directly unless saved
                                    setActiveLog(JSON.parse(JSON.stringify(log)));
                                    setMascotMood('waving');
                                    setMascotCustomText(`Workspace resumed. Loading EEG waveforms and 22-channel montage. Adjust the threshold parameters.`);
                                  }}
                                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition duration-150 flex items-center gap-1"
                                >
                                  Open Report
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              
              /* ==============================================================
                 VIEW B: DETAILED EEG SEGMENTS & VERIFICATION WORKSPACE
                 ============================================================== */
              <motion.div
                key="eeg_workspace"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* Workspace Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveLog(null)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 p-2.5 rounded-2xl transition duration-150"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">
                          {activeLog.fileName}
                        </h2>
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                          Montage Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {currentPatient.name} • 1-Hour Stream
                      </p>
                    </div>
                  </div>

                  {/* Feedback summary stats in workspace */}
                  <div className="flex gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="text-center">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Confirmed</span>
                      <span className="text-sm font-black text-emerald-600">{activeLog.confirmedSeizures}</span>
                    </div>
                    <div className="text-center border-x border-slate-200 px-3">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Rejected</span>
                      <span className="text-sm font-black text-amber-500">{activeLog.rejectedSeizures}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Pending</span>
                      <span className="text-sm font-black text-slate-500">
                        {activeLog.segments.filter(s => s.reviewStatus === 'pending').length}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWorkspaceReport}
                    className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-3 px-6 rounded-2xl shadow-md transition duration-150 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    Save Report & Update Stats
                  </button>
                </div>

                {/* Main section: Sliders and graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Decision Threshold Tuning & Flagged Segment Navigation */}
                  <div className="lg:col-span-1 space-y-6">
                    
                    {/* Animated mascot in workspace */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                      <BrainMascot 
                        mood={mascotMood} 
                        bubbleText={mascotCustomText}
                        className="h-28 w-28 shrink-0"
                      />
                      <div className="text-slate-600 text-xs text-left">
                        <span className="font-bold text-slate-800">Cerebro Assistant:</span>
                        <div className="text-[10px] text-slate-400 mt-0.5 mt-1 leading-relaxed">
                          Your verification checks train the next epoch model directly!
                        </div>
                      </div>
                    </div>

                    {/* Classifier post-processing parameters */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                      
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm">
                          <Sliders size={16} className="text-rose-500" />
                          Probability Threshold Calibration
                        </div>
                        <span className="text-xs bg-rose-50 text-rose-600 font-mono font-bold px-2 py-0.5 rounded">
                          {(clinicalThreshold * 100).toFixed(0)}% cut
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Tether the neural diagnostic sensitivity. Low bounds guarantee maximum coverage (high recall), high bounds decrease artifacts (lower false alarms per hour).
                      </p>

                      {/* Horizontal Slider widget */}
                      <div className="space-y-2 py-2">
                        <input
                          type="range"
                          min="0.10"
                          max="0.90"
                          step="0.05"
                          value={clinicalThreshold}
                          onChange={(e) => {
                            const newThreshold = parseFloat(e.target.value);
                            setClinicalThreshold(newThreshold);
                            
                            // Estimate False alarms and recall from standard sweep tables
                            const sweepMatch = MODEL_THRESHOLDS_SWEEP.reduce((prev, curr) => {
                              return (Math.abs(curr.threshold - newThreshold) < Math.abs(prev.threshold - newThreshold)) ? curr : prev;
                            });

                            setMascotMood('thinking');
                            setMascotCustomText(`A threshold of ${(newThreshold*100).toFixed(0)}% targets a recall rate of ${(sweepMatch.recall*100).toFixed(0)}% & reduces verification work by ${sweepMatch.savedReviewTimePercent}%!`);
                          }}
                          className="w-full xl:h-2 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                        />
                        <div className="flex justify-between text-[9px] font-mono text-slate-400">
                          <span>0.10 (Cover everything)</span>
                          <span>0.90 (Confidence only)</span>
                        </div>
                      </div>

                      {/* Expected Clinical Metrics Block */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3 text-center">
                        <div>
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">Target Recall</span>
                          <span className="text-sm font-black text-rose-500 font-mono">
                            {(MODEL_THRESHOLDS_SWEEP.reduce((prev, curr) => {
                              return (Math.abs(curr.threshold - clinicalThreshold) < Math.abs(prev.threshold - clinicalThreshold)) ? curr : prev;
                            }).recall * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">Estimated FA/Hr</span>
                          <span className="text-sm font-black text-slate-700 font-mono">
                            {MODEL_THRESHOLDS_SWEEP.reduce((prev, curr) => {
                              return (Math.abs(curr.threshold - clinicalThreshold) < Math.abs(prev.threshold - clinicalThreshold)) ? prev : curr;
                            }).falseAlarmRate.toFixed(1)} / hr
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Flagged Seizure Segments Navigation */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Flagged Seizure Epoch Windows ({activeLog.segments.length})
                      </h3>

                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {activeLog.segments.map((seg) => {
                          const isFocused = seg.id === focusedSegmentId;
                          const confidenceMeetsThreshold = seg.confidence >= (clinicalThreshold * 100);

                          return (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() => {
                                setFocusedSegmentId(seg.id);
                                setMascotMood('waving');
                                setMascotCustomText(`Examining segment at offset ${seg.startTime}s. Model reported ${(seg.confidence).toFixed(1)}% confidence of high amplitude discharges.`);
                              }}
                              className={`w-full text-left p-3.5 rounded-2xl border transition duration-150 flex items-center justify-between ${
                                isFocused 
                                  ? 'bg-slate-900 border-slate-800 text-white shadow-md' 
                                  : confidenceMeetsThreshold
                                    ? 'bg-rose-50/40 border-rose-100 text-slate-800'
                                    : 'bg-slate-50 opacity-40 hover:opacity-100 border-transparent text-slate-500'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`text-[11px] font-bold font-mono ${isFocused ? 'text-teal-400' : 'text-slate-800'}`}>
                                    Offset: {seg.startTime}s - {seg.startTime + 7}s
                                  </span>
                                  {!confidenceMeetsThreshold && (
                                    <span className="bg-slate-200 text-slate-600 text-[8px] font-bold px-1 py-0.2 rounded font-mono">
                                      Filtered
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-mono">
                                  <span className={isFocused ? 'text-slate-400' : 'text-slate-400'}>
                                    Confidence:
                                  </span>
                                  <span className={`font-semibold ${seg.confidence > 85 ? 'text-rose-500' : 'text-amber-500'}`}>
                                    {seg.confidence}%
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {seg.reviewStatus === 'confirmed' ? (
                                  <span className="bg-emerald-500 text-white p-1 rounded-full text-xs">
                                    <Check size={10} />
                                  </span>
                                ) : seg.reviewStatus === 'rejected' ? (
                                  <span className="bg-amber-500 text-white p-1 rounded-full text-xs">
                                    <X size={10} />
                                  </span>
                                ) : (
                                  <span className={`h-2.5 w-2.5 rounded-full ${confidenceMeetsThreshold ? 'bg-rose-500 animate-ping' : 'bg-slate-300'}`} />
                                )}
                              </div>

                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: EEG montages signal trace details and feedloop evaluation triggers */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Multichannel Wave graph visualization component */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                              Bipolar Signal EEG Oscilloscope Canvas
                            </h3>
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                              Active Electrode View
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Click confirmed or reject triggers on the right to train spatial nodes.
                          </p>
                        </div>
                      </div>

                      {/* Display EEG waveforms */}
                      {renderMockEegSignal()}
                    </div>

                    {/* Neurologist feedback loop console block (IMPORTANT DIRECTIVE) */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                      
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
                        <div className="p-2 bg-gradient-to-r from-teal-500 to-rose-500 text-white rounded-xl">
                          <Activity size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Staff Verification Loops Interface
                          </h4>
                          <span className="text-xs font-mono font-medium text-slate-600">
                            Provide expert validation to finalize clinical logs classification.
                          </span>
                        </div>
                      </div>

                      {(() => {
                        const currentSegment = activeLog.segments.find(s => s.id === focusedSegmentId) || activeLog.segments[0];
                        if (!currentSegment) return null;

                        return (
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                              <span className="text-xs font-extrabold text-slate-700 block">
                                Verify Event Window: Offset {currentSegment.startTime}s - {currentSegment.startTime + 7}s
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                Does this period show true spike-discharge oscillations, or is it motion noise artifact?
                              </p>
                              <div className="mt-2 flex gap-2">
                                <span className="text-[10px] bg-slate-200 text-slate-700 font-mono font-bold px-2 py-0.5 rounded">
                                  Conf: {currentSegment.confidence}%
                                </span>
                                <span className="text-[10px] bg-rose-50 text-rose-700 font-mono font-medium px-2 py-0.5 rounded">
                                  Primary focus: {currentSegment.topSpikeChannels[0]}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => handleVerifyEvent(currentSegment.id, false)}
                                className={`flex-1 sm:flex-none border border-slate-200 hover:border-amber-200 text-xs font-bold px-4 py-2.5 rounded-xl transition duration-150 inline-flex items-center justify-center gap-1.5 ${
                                  currentSegment.reviewStatus === 'rejected'
                                    ? 'bg-amber-100 border-amber-200 text-amber-800'
                                    : 'bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                }`}
                              >
                                <X size={14} />
                                Reject (✗ Trace Noise)
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVerifyEvent(currentSegment.id, true)}
                                className={`flex-1 sm:flex-none text-xs font-bold px-4 py-2.5 rounded-xl transition duration-150 inline-flex items-center justify-center gap-1.5 ${
                                  currentSegment.reviewStatus === 'confirmed'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-transparent'
                                }`}
                              >
                                <Check size={14} />
                                Confirm (✓ True Seizure)
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* 3. New Patient Dialog Modal */}
      {showAddModal && (
        <div id="add_patient_modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="bg-rose-500 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-sm">
                <UserPlus size={18} />
                Create New Subject Cohort File
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:text-rose-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Subject Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="110"
                    placeholder="25"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                    value={newPatientAge}
                    onChange={(e) => setNewPatientAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Gender Montage
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                    value={newPatientGender}
                    onChange={(e) => setNewPatientGender(e.target.value as 'M' | 'F')}
                  >
                    <option value="F">Female Subject</option>
                    <option value="M">Male Subject</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Medical Notes & Diagnostic Directives
                </label>
                <textarea
                  rows={3}
                  placeholder="Known temporal epilepsy, focal spike patterns, medications..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500"
                  value={newPatientNotes}
                  onChange={(e) => setNewPatientNotes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-md"
                >
                  Initialize Subject File
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
