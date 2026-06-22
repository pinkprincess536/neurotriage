export interface Patient {
  id: string; // e.g., 'chb01'
  name: string; // "Patient 1"
  age: number;
  gender: 'M' | 'F';
  totalRecordings: number;
  avgSeizuresPerDay: number;
  notes: string;
  seizureLogs: SessionLog[];
}

export interface SessionLog {
  id: string;
  fileName: string;
  uploadDate: string;
  durationSeconds: number; // e.g. 3600s = 1 hour
  detectedCount: number;
  isReviewed: boolean;
  status: 'Critical Alert' | 'Needs Review' | 'Low Risk';
  segments: EegSegment[];
  thresholdUsed: number;
  confirmedSeizures: number;
  rejectedSeizures: number;
}

export interface EegSegment {
  id: string;
  startTime: number; // seconds from stream start
  duration: number; // usually 7s windows as per CONTEXT.md
  confidence: number; // probability score 0-100%
  reviewStatus: 'pending' | 'confirmed' | 'rejected';
  channels: string[]; // channels that exhibited high spikes block
  topSpikeChannels: string[];
}

export interface ModelMetrics {
  threshold: number;
  recall: number; // e.g., 0.95
  falseAlarmRate: number; // FA / hr, e.g., 1.2
  savedReviewTimePercent: number; // e.g. 75%
}

// Canonical 22 Channels as described in preprocess.ipynb
export const EEG_CHANNELS = [
  'FP1-F7', 'F7-T7', 'T7-P7', 'P7-O1',
  'FP1-F3', 'F3-C3', 'C3-O1',
  'FP2-F4', 'F4-C4', 'C4-O2',
  'FP2-F8', 'F8-T8', 'T8-O2',
  'FT9-FT10', 'FC5-FC6', 'C5-C6', 'T9-T10', 'P9-P10',
  'CP1-CP2', 'P3-P4', 'P5-P6', 'O1-O2'
];

export const INITIAL_PATIENTS: Patient[] = Array.from({ length: 24 }, (_, i) => {
  const idValue = `chb${String(i + 1).padStart(2, '0')}`;
  const ages = [11, 15, 34, 22, 6, 1, 14, 10, 18, 5, 26, 19, 3, 9, 16, 21, 2, 8, 30, 24, 13, 22, 17, 20];
  const genders: ('M' | 'F')[] = ['F', 'M', 'F', 'F', 'F', 'M', 'F', 'M', 'M', 'F', 'F', 'F', 'F', 'F', 'M', 'M', 'M', 'M', 'F', 'F', 'F', 'F', 'F', 'F'];
  const baseSeizures = [4, 7, 2, 5, 12, 1, 9, 3, 6, 11, 2, 0, 4, 8, 3, 5, 14, 2, 5, 7, 3, 4, 1, 6];
  
  return {
    id: idValue,
    name: `Patient ${i + 1} (${idValue.toUpperCase()})`,
    age: ages[i % ages.length],
    gender: genders[i % genders.length],
    totalRecordings: Math.floor(Math.random() * 5) + 3,
    avgSeizuresPerDay: baseSeizures[i % baseSeizures.length],
    notes: `CHB-MIT cohort study subject. History of focal seizures originating in ${i % 3 === 0 ? 'temporal lobe' : i % 3 === 1 ? 'frontal lobe' : 'occipital-parietal region'}. Responds well to ${i % 4 === 0 ? 'Levetiracetam' : i % 4 === 1 ? 'Valproate' : i % 4 === 2 ? 'Carbamazepine' : 'monitored observation'}.`,
    seizureLogs: []
  };
});

// Seed data for a couple of patients to populate the landing pages with prior stats
INITIAL_PATIENTS[0].seizureLogs = [
  {
    id: `log_01_a`,
    fileName: `chb01_03.edf`,
    uploadDate: `2026-06-19 14:32`,
    durationSeconds: 3600,
    detectedCount: 4,
    isReviewed: true,
    status: 'Critical Alert',
    thresholdUsed: 0.72,
    confirmedSeizures: 3,
    rejectedSeizures: 1,
    segments: [
      { id: 'seg_1', startTime: 2990, duration: 7, confidence: 94.2, reviewStatus: 'confirmed', channels: ['FP1-F7', 'F7-T7'], topSpikeChannels: ['FP1-F7'] },
      { id: 'seg_2', startTime: 3020, duration: 7, confidence: 88.5, reviewStatus: 'confirmed', channels: ['F7-T7', 'T7-P7'], topSpikeChannels: ['T7-P7'] },
      { id: 'seg_3', startTime: 3150, duration: 7, confidence: 79.1, reviewStatus: 'rejected', channels: ['FP2-F4', 'FC5-FC6'], topSpikeChannels: ['FC5-FC6'] },
      { id: 'seg_4', startTime: 3410, duration: 7, confidence: 91.0, reviewStatus: 'confirmed', channels: ['FP1-F7', 'P7-O1'], topSpikeChannels: ['FP1-F7'] }
    ]
  },
  {
    id: `log_01_b`,
    fileName: `chb01_04.edf`,
    uploadDate: `2026-06-20 09:10`,
    durationSeconds: 3600,
    detectedCount: 2,
    isReviewed: false,
    status: 'Needs Review',
    thresholdUsed: 0.72,
    confirmedSeizures: 0,
    rejectedSeizures: 0,
    segments: [
      { id: 'seg_5', startTime: 1420, duration: 7, confidence: 81.3, reviewStatus: 'pending', channels: ['CP1-CP2', 'T9-T10'], topSpikeChannels: ['CP1-CP2'] },
      { id: 'seg_6', startTime: 1840, duration: 7, confidence: 92.4, reviewStatus: 'pending', channels: ['FP2-F8', 'F8-T8'], topSpikeChannels: ['FP2-F8'] }
    ]
  }
];

INITIAL_PATIENTS[4].seizureLogs = [
  {
    id: `log_05_a`,
    fileName: `chb05_06.edf`,
    uploadDate: `2026-06-18 16:45`,
    durationSeconds: 7200,
    detectedCount: 6,
    isReviewed: true,
    status: 'Critical Alert',
    thresholdUsed: 0.78,
    confirmedSeizures: 5,
    rejectedSeizures: 1,
    segments: [
      { id: 'seg_21', startTime: 820, duration: 7, confidence: 96.5, reviewStatus: 'confirmed', channels: ['FP1-F3', 'F3-C3'], topSpikeChannels: ['FP1-F3'] },
      { id: 'seg_22', startTime: 860, duration: 7, confidence: 95.1, reviewStatus: 'confirmed', channels: ['FP1-F3', 'F3-C3'], topSpikeChannels: ['F3-C3'] },
      { id: 'seg_23', startTime: 1200, duration: 7, confidence: 73.0, reviewStatus: 'rejected', channels: ['T7-P7'], topSpikeChannels: ['T7-P7'] },
      { id: 'seg_24', startTime: 4200, duration: 7, confidence: 89.2, reviewStatus: 'confirmed', channels: ['P3-P4', 'CP1-CP2'], topSpikeChannels: ['P3-P4'] },
      { id: 'seg_25', startTime: 4240, duration: 7, confidence: 94.0, reviewStatus: 'confirmed', channels: ['P3-P4', 'CP1-CP2'], topSpikeChannels: ['CP1-CP2'] },
      { id: 'seg_26', startTime: 5100, duration: 7, confidence: 91.8, reviewStatus: 'confirmed', channels: ['O1-O2'], topSpikeChannels: ['O1-O2'] }
    ]
  }
];

// Human-friendly threshold tables (FA/hr sweep from train_eeg.ipynb)
export const MODEL_THRESHOLDS_SWEEP: ModelMetrics[] = [
  { threshold: 0.10, recall: 0.99, falseAlarmRate: 4.8, savedReviewTimePercent: 12 },
  { threshold: 0.25, recall: 0.97, falseAlarmRate: 3.2, savedReviewTimePercent: 35 },
  { threshold: 0.40, recall: 0.95, falseAlarmRate: 2.1, savedReviewTimePercent: 52 },
  { threshold: 0.50, recall: 0.92, falseAlarmRate: 1.5, savedReviewTimePercent: 68 },
  { threshold: 0.60, recall: 0.89, falseAlarmRate: 1.0, savedReviewTimePercent: 78 },
  { threshold: 0.75, recall: 0.85, falseAlarmRate: 0.6, savedReviewTimePercent: 88 },
  { threshold: 0.90, recall: 0.72, falseAlarmRate: 0.2, savedReviewTimePercent: 96 }
];
