import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldAlert, Database, Cpu, Activity, TrendingUp, Users, FileText,
  Sliders, Calendar, HelpCircle, Check, Play, RefreshCw, Layers
} from 'lucide-react';
import { Patient, MODEL_THRESHOLDS_SWEEP, SessionLog } from '../types';
import BrainMascot from './BrainMascot';

interface AdminPanelProps {
  patientsList: Patient[];
  onLogout: () => void;
  displayName: string;
}

export default function AdminPanel({ patientsList, onLogout, displayName }: AdminPanelProps) {
  const [selectedSweepIdx, setSelectedSweepIdx] = useState<number>(3); // Default index 3: threshold 0.50
  const activeSweep = MODEL_THRESHOLDS_SWEEP[selectedSweepIdx];

  // Global telemetry stats
  const totalUploads = patientsList.reduce((sum, p) => sum + p.seizureLogs.length, 0);
  const totalHours = patientsList.reduce((sum, p) => {
    return sum + p.seizureLogs.reduce((acc, log) => acc + (log.durationSeconds / 3600), 0);
  }, 0);
  const totalConfirmed = patientsList.reduce((sum, p) => {
    return sum + p.seizureLogs.reduce((acc, log) => acc + log.confirmedSeizures, 0);
  }, 0);
  const totalRejected = patientsList.reduce((sum, p) => {
    return sum + p.seizureLogs.reduce((acc, log) => acc + log.rejectedSeizures, 0);
  }, 0);

  // Model specification details from train_eeg.ipynb
  const modelHyperparameters = {
    architecture: "EEGCNN1D (3 ConvBlocks + FC classifier)",
    parametersCount: "~300,000 trainable weights",
    frequencyDomain: "0.5 - 45 Hz Bandpass, 60Hz Notch",
    temporalWindow: "1792 samples @ 256 Hz (7.0 seconds, 30% overlap)",
    datasetDistribution: "9 training patients / 15 test patients (balanced train batching)",
    lossFunction: "Weighted CrossEntropy (Seizure Weight: 7.8)",
    optimization: "Adam Optimizer, LR=0.001"
  };

  return (
    <div id="admin_portal" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2.5 rounded-2xl text-white shadow-md">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-800">CerebroEEG</h1>
              <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Clinical Admin Panel
              </span>
            </div>
            <p className="text-xs text-slate-500">Neural model metrics, dataset telemetry, & sensitivity sweep charts</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-slate-500 uppercase">Administrator Staff</span>
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

      {/* 2. Main Content Dashboard Grid */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">
        
        {/* Top telemetry counts banner bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="bg-violet-50 text-violet-600 p-3 rounded-xl shrink-0">
              <Database size={20} />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cohort Population</span>
              <span className="text-xl font-extrabold text-slate-700 font-mono">{patientsList.length} subjects</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="bg-violet-50 text-violet-600 p-3 rounded-xl shrink-0">
              <Activity size={20} />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Monitored Stream</span>
              <span className="text-xl font-extrabold text-slate-700 font-mono">{totalHours} total hours</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">True Positives</span>
              <span className="text-xl font-extrabold text-emerald-600 font-mono">{totalConfirmed} confirmed</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="bg-amber-50 text-amber-600 p-3 rounded-xl shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">False Warnings</span>
              <span className="text-xl font-extrabold text-amber-600 font-mono">{totalRejected} discarded</span>
            </div>
          </div>

        </div>

        {/* Dynamic Model Tuning and Metrics Sweep row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Block - Interactive Assistant Speech & Model Hyperparameters */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Cerebro Mascot specialized for Admin */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Core Model Telemetry Observer</h3>
              <BrainMascot 
                mood="idle"
                bubbleText="System status optimal! We are tracking validation metrics for 24 subject nodes. Verify hyperparameters below!"
                className="h-44 w-full"
              />
            </div>

            {/* Model Architecture Specs */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={16} className="text-violet-600" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Deep 1D CNN Hyperparameters
                </h3>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600">
                <div>
                  <span className="block font-bold text-slate-500 uppercase text-[9px]">Model Target Architecture</span>
                  <span className="font-semibold text-slate-800 block">{modelHyperparameters.architecture}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-500 uppercase text-[9px]">Parameters Weight Size</span>
                  <span className="font-mono text-slate-700 block">{modelHyperparameters.parametersCount}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-500 uppercase text-[9px]">Preprocessing Filter Montage</span>
                  <span className="text-slate-700 block">{modelHyperparameters.frequencyDomain}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-500 uppercase text-[9px]">Windows Resolution Matrix</span>
                  <span className="text-slate-700 block">{modelHyperparameters.temporalWindow}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-500 uppercase text-[9px]">Cohort Patients Split Distribution</span>
                  <span className="text-slate-700 block">{modelHyperparameters.datasetDistribution}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-500 uppercase text-[9px]">Optimizer Strategy</span>
                  <span className="font-mono text-slate-600 block">{modelHyperparameters.optimization}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Block - Interactive Receiver Operating Characteristic (ROC) Threshold Sweeper */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders size={16} className="text-violet-600" />
                    Receiver Operating Characteristic (ROC) & False Alarm Sweep
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Simulate how adjusting the clinical decision margin alters hospital workload and true positive recall.
                  </p>
                </div>
                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono text-slate-500">
                  Data: CHB-MIT Validation Pack
                </span>
              </div>

              {/* Sweep Metrics Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-3 px-4">Decision Threshold</th>
                      <th className="py-3 px-4">Expected Sensitivity (Recall)</th>
                      <th className="py-3 px-4">False Alarms / Hr (FA/hr)</th>
                      <th className="py-3 px-4 text-emerald-600">Neurologist Workload Reduction %</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MODEL_THRESHOLDS_SWEEP.map((sweep, idx) => {
                      const isSelected = selectedSweepIdx === idx;

                      return (
                        <tr 
                          key={sweep.threshold} 
                          className={`hover:bg-slate-50/50 transition cursor-pointer ${
                            isSelected ? 'bg-violet-50/40 text-violet-950 font-semibold' : 'text-slate-600'
                          }`}
                          onClick={() => setSelectedSweepIdx(idx)}
                        >
                          <td className="py-3.5 px-4 font-mono font-medium">
                            {(sweep.threshold).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full ${sweep.recall > 0.94 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {(sweep.recall * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {sweep.falseAlarmRate} FA/hr
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                            {sweep.savedReviewTimePercent}% Hours Saved
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center">
                              {isSelected ? (
                                <span className="bg-violet-600 text-white rounded-full p-1">
                                  <Check size={11} />
                                </span>
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-slate-300" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Workload evaluation diagram */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                
                {/* Graph representation of savings */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 text-teal-400">
                    <Activity size={180} />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-bold text-teal-400 uppercase tracking-widest block mb-1">
                      Sensitivity Margin
                    </span>
                    <h4 className="text-sm font-bold">Workload Optimization Efficacy</h4>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      At a {(activeSweep.threshold * 100).toFixed(0)}% threshold, clinicians bypass reviewing {(activeSweep.savedReviewTimePercent)}% of peaceful recording hours!
                    </p>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2 pb-1">
                    <span className="text-3xl font-black font-mono text-teal-400">
                      {activeSweep.savedReviewTimePercent}%
                    </span>
                    <span className="text-xs text-slate-400 font-bold">Reduction in labor</span>
                  </div>
                </div>

                {/* Simulated ROC visualization block */}
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                      Spatial Grid Curve
                    </span>
                    <h4 className="text-xs font-bold text-slate-700">Sensitivity vs. Specificity Point</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Sensitivity is locked at {(activeSweep.recall*100).toFixed(0)}%. False Alarm Rate scales down from 4.8 to {activeSweep.falseAlarmRate} spikes.
                    </p>
                  </div>
                  
                  {/* Small visual line showing threshold spot */}
                  <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span>Low False Alarms</span>
                    <div className="flex-1 max-w-xs mx-4 bg-slate-200 h-1 rounded-full relative">
                      <div 
                        className="absolute bg-violet-600 h-2.5 w-2.5 rounded-full top-1/2 -translate-y-1/2 transition-all duration-300"
                        style={{ left: `${(1 - (activeSweep.falseAlarmRate / 4.8)) * 100}%` }}
                      />
                    </div>
                    <span>High False Alarms</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Subject Registry telemetries */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Clinical Subject Deployment Audit ({patientsList.length} Cohort Rows)
              </h3>

              <div id="cohort_deployment_grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {patientsList.map((p) => {
                  const totalLogs = p.seizureLogs.length;
                  const confirmedCount = p.seizureLogs.reduce((acc, current) => acc + current.confirmedSeizures, 0);

                  return (
                    <div 
                      key={p.id}
                      className="bg-slate-50 hover:bg-violet-50/20 border border-slate-100 hover:border-violet-100 rounded-2xl p-4 transition duration-150 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase block">
                          {p.id.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-slate-700 mt-0.5 block truncate">
                          {p.name.split(' (')[0]}
                        </span>
                      </div>
                      
                      <div className="mt-4 pt-2.5 border-t border-slate-200/50 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                        <span>Uploads: {totalLogs}</span>
                        <span className={confirmedCount > 0 ? 'text-rose-500 font-bold' : ''}>
                          Seizures: {confirmedCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
