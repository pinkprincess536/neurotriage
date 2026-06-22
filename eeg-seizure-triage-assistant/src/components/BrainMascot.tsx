import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type MascotMood = 'idle' | 'waving' | 'thinking' | 'success' | 'error' | 'analyzing' | 'greetings';

interface BrainMascotProps {
  mood?: MascotMood;
  className?: string;
  onClick?: () => void;
  bubbleText?: string;
}

export default function BrainMascot({
  mood = 'idle',
  className = '',
  onClick,
  bubbleText
}: BrainMascotProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState<string>('');

  // Random blink interval
  useEffect(() => {
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.3) {
        triggerBlink();
      }
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Determine speech bubble text if not explicitly provided
  useEffect(() => {
    if (bubbleText) {
      setCurrentSpeech(bubbleText);
    } else {
      switch (mood) {
        case 'greetings':
          setCurrentSpeech("Hi there! I'm Cerebro, your EEG triage sidekick. Login to begin!");
          break;
        case 'waving':
          setCurrentSpeech("Hello, Doctor! Ready to review some brain waves today? Let's triage!");
          break;
        case 'thinking':
          setCurrentSpeech("Filtering noise... applying bandpass filter 0.5-40Hz & Notch 60Hz...");
          break;
        case 'analyzing':
          setCurrentSpeech("Running 1D CNN over raw channels... Identifying seizure spikes!");
          break;
        case 'success':
          setCurrentSpeech("Amazing! We successfully triaged this recording! High five!");
          break;
        case 'error':
          setCurrentSpeech("Oh no! That doesn't look like a valid .edf file or there was an issue. Let's try again!");
          break;
        case 'idle':
        default:
          setCurrentSpeech("I'm monitoring the model's false alarm rates! Let me know when you need help.");
          break;
      }
    }
  }, [mood, bubbleText]);

  // Framer Motion variants
  const brainBodyVariants = {
    idle: {
      y: [0, -6, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
    },
    waving: {
      y: [0, -8, 0],
      rotate: [0, 2, -2, 0],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
    },
    thinking: {
      scale: [1, 1.02, 1],
      rotate: [0, 1, -1, 0],
      transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
    },
    analyzing: {
      scale: [1, 1.04, 0.98, 1],
      transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
    },
    success: {
      y: [0, -25, 0],
      scale: [1, 1.1, 0.9, 1],
      transition: { duration: 0.8, repeat: 2, ease: "easeOut" }
    },
    error: {
      x: [0, -8, 8, -6, 6, 0],
      transition: { duration: 0.5 }
    }
  };

  const leftArmVariants = {
    idle: { rotate: [0, 10, 0], transition: { duration: 3, repeat: Infinity } },
    waving: { rotate: [0, -50, -10, -50, 0], transition: { duration: 1.5, repeat: Infinity } },
    success: { rotate: [-40, -40], y: [-5, -5] },
    error: { rotate: [15, 0, 15], transition: { duration: 2 } },
    thinking: { rotate: [5, 15, 5], transition: { duration: 1.5, repeat: Infinity } },
    analyzing: { rotate: [0, 0] }
  };

  const rightArmVariants = {
    idle: { rotate: [0, -10, 0], transition: { duration: 3, repeat: Infinity } },
    waving: { rotate: [0, 10, 0] },
    success: { rotate: [40, 40], y: [-5, -5] },
    error: { rotate: [-15, 0, -15], transition: { duration: 2 } },
    thinking: { rotate: [-10, 5, -10], transition: { duration: 1.5, repeat: Infinity } },
    analyzing: { rotate: [0, 0] }
  };

  return (
    <div id="cerebro_container" className={`flex flex-col items-center justify-center relative select-none ${className}`} onClick={onClick}>
      {/* Speech Bubble */}
      <AnimatePresence mode="wait">
        {currentSpeech && (
          <motion.div
            id="cerebro_bubble"
            key={currentSpeech}
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="absolute -top-24 mb-3 max-w-[240px] bg-white border-2 border-slate-200 text-slate-700 text-xs font-medium px-4 py-3 rounded-2xl shadow-md text-center before:content-[''] before:absolute before:bottom-[-8px] before:left-1/2 before:-translate-x-1/2 before:w-4 before:h-4 before:bg-white before:border-r-2 before:border-b-2 before:border-slate-200 before:rotate-45 z-10"
          >
            {currentSpeech}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-44 h-44 cursor-pointer group">
        {/* Glow behind the brain when analyzing or thinking */}
        {(mood === 'analyzing' || mood === 'thinking') && (
          <div className={`absolute inset-4 rounded-full filter blur-xl opacity-40 animate-pulse transition-colors duration-1000 ${
            mood === 'analyzing' ? 'bg-cyan-400' : 'bg-violet-400'
          }`} />
        )}
        
        {mood === 'success' && (
          <div className="absolute inset-4 rounded-full filter blur-xl opacity-40 bg-emerald-400 animate-ping" />
        )}

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          className="w-full h-full drop-shadow-lg"
        >
          {/* Sparkles / Electric Sparks for analyzing */}
          {mood === 'analyzing' && (
            <g className="text-cyan-400">
              <circle cx="40" cy="50" r="3" className="animate-ping" fill="currentColor" />
              <circle cx="160" cy="50" r="2" className="animate-ping" fill="currentColor" />
              <circle cx="30" cy="110" r="4" className="animate-ping" fill="currentColor" />
              <line x1="45" y1="55" x2="60" y2="70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="155" y1="55" x2="140" y2="70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}

          {/* Thinking lightbulb or gear icon floating above */}
          {mood === 'thinking' && (
            <motion.g
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [1, 0.4, 1], y: 0 }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-violet-500 fill-violet-100"
            >
              <path d="M 100 20 C 93 20 88 25 88 32 C 88 36 90 40 93 42 L 93 46 L 107 46 L 107 42 C 110 40 112 36 112 32 C 112 25 107 20 100 20 Z" stroke="currentColor" strokeWidth="2" />
              <line x1="100" y1="12" x2="100" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="84" y1="21" x2="88" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="116" y1="21" x2="112" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
          )}

          {/* Golden stars for success mood */}
          {mood === 'success' && (
            <g className="text-yellow-400 fill-yellow-400">
              <path d="M 35,30 L 38,36 L 45,36 L 40,40 L 42,47 L 35,43 L 28,47 L 30,40 L 25,36 L 32,36 Z" />
              <path d="M 165,30 L 168,36 L 175,36 L 170,40 L 172,47 L 165,43 L 158,47 L 160,40 L 155,36 L 162,36 Z" />
            </g>
          )}

          {/* ARMS */}
          {/* Left Arm */}
          <motion.g
            variants={leftArmVariants}
            animate={mood}
            style={{ transformOrigin: "60px 115px" }}
          >
            {/* Cute stubby hand */}
            <path
              d="M 60,115 C 45,110 35,115 35,123 C 35,130 45,130 55,123 Z"
              fill="#FCA5A5"
              stroke="#F87171"
              strokeWidth="3"
            />
          </motion.g>

          {/* Right Arm */}
          <motion.g
            variants={rightArmVariants}
            animate={mood}
            style={{ transformOrigin: "140px 115px" }}
          >
            {/* Cute stubby hand */}
            <path
              d="M 140,115 C 155,110 165,115 165,123 C 165,130 155,130 145,123 Z"
              fill="#FCA5A5"
              stroke="#F87171"
              strokeWidth="3"
            />
          </motion.g>

          {/* LEGS */}
          <g>
            {/* Left Leg */}
            <motion.ellipse
              cx="80"
              cy="158"
              rx="12"
              ry="7"
              fill="#F87171"
              animate={mood === 'success' ? { y: [-2, -12, -2] } : { y: [0, -1, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
            {/* Right Leg */}
            <motion.ellipse
              cx="120"
              cy="158"
              rx="12"
              ry="7"
              fill="#F87171"
              animate={mood === 'success' ? { y: [-2, -12, -2], transition: { delay: 0.1, repeat: Infinity, duration: 1.2 } } : { y: [0, -1, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
          </g>

          {/* BRAIN MAIN LOBE / BODY */}
          <motion.g
            variants={brainBodyVariants}
            animate={mood}
            style={{ transformOrigin: "100px 105px" }}
          >
            {/* Backdrop shadow for brain depth */}
            <path
              d="M 100,50 C 60,50 48,70 48,95 C 48,125 70,140 100,140 C 130,140 152,125 152,95 C 152,70 140,50 100,50 Z"
              fill="#FCA5A5"
            />

            {/* Left Lobe Curves (representing EEG signal nodes/folded curves) */}
            <path
              d="M 100,53 C 78,53 52,62 52,90 C 52,112 68,135 96,137 C 98,125 82,122 82,108 C 82,92 98,88 94,74 C 94,62 100,58 100,53 Z"
              fill="#FFB1B1"
              stroke="#F87171"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Right Lobe Curves */}
            <path
              d="M 100,53 C 122,53 148,62 148,90 C 148,112 132,135 104,137 C 102,125 118,122 118,108 C 118,92 102,88 106,74 C 106,62 100,58 100,53 Z"
              fill="#FFB1B1"
              stroke="#F87171"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* EEG Electrode Dots representation (Cute visual flair!) */}
            <circle cx="70" cy="70" r="5" fill="#FFE4E4" stroke="#EEF2F6" strokeWidth="1" />
            <circle cx="130" cy="70" r="5" fill="#FFE4E4" stroke="#EEF2F6" strokeWidth="1" />
            <circle cx="60" cy="110" r="5" fill="#FFE4E4" stroke="#EEF2F6" strokeWidth="1" />
            <circle cx="140" cy="110" r="5" fill="#FFE4E4" stroke="#EEF2F6" strokeWidth="1" />
            
            {/* Wave lines crossing electrode nodes */}
            <path d="M 70,72 Q 100,80 130,72" stroke="#F87171" strokeWidth="2" fill="none" opacity="0.4" />
            <path d="M 60,112 Q 100,105 140,112" stroke="#F87171" strokeWidth="2" fill="none" opacity="0.4" />

            {/* Cute Blush on Cheeks */}
            <ellipse cx="68" cy="118" rx="8" ry="5" fill="#F87171" opacity="0.35" />
            <ellipse cx="132" cy="118" rx="8" ry="5" fill="#F87171" opacity="0.35" />

            {/* EYES */}
            {isBlinking ? (
              // Blink state (flat lines)
              <g stroke="#475569" strokeWidth="4" strokeLinecap="round">
                <line x1="72" y1="102" x2="88" y2="102" />
                <line x1="112" y1="102" x2="128" y2="102" />
              </g>
            ) : mood === 'error' ? (
              // Dizzy/cross eyes
              <g stroke="#475569" strokeWidth="4" strokeLinecap="round">
                <line x1="72" y1="96" x2="84" y2="108" />
                <line x1="84" y1="96" x2="72" y2="108" />
                <line x1="116" y1="96" x2="128" y2="108" />
                <line x1="128" y1="96" x2="116" y2="108" />
              </g>
            ) : mood === 'success' ? (
              // Star/happy curved eyes
              <g stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none">
                <path d="M 72,106 Q 80,94 88,106" />
                <path d="M 112,106 Q 120,94 128,106" />
              </g>
            ) : mood === 'thinking' ? (
              // Eyes looking left and right
              <g>
                <circle cx="80" cy="102" r="7" fill="#475569" />
                <circle cx="120" cy="102" r="7" fill="#475569" />
                {/* Pupils shifted left */}
                <circle cx="77" cy="100" r="2.5" fill="white" />
                <circle cx="117" cy="100" r="2.5" fill="white" />
              </g>
            ) : (
              // Normal cute round eyes
              <g>
                <circle cx="80" cy="102" r="7" fill="#475569" />
                <circle cx="120" cy="102" r="7" fill="#475569" />
                {/* Cute white reflection dots */}
                <circle cx="78" cy="99" r="2.5" fill="white" className="group-hover:translate-y-[-0.5px]" />
                <circle cx="118" cy="99" r="2.5" fill="white" className="group-hover:translate-y-[-0.5px]" />
              </g>
            )}

            {/* MOUTH */}
            {mood === 'error' ? (
              // Worried tiny open mouth or flat line
              <path
                d="M 94,118 Q 100,113 106,118"
                stroke="#475569"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : mood === 'thinking' ? (
              // Straight cute mouth line
              <line
                x1="95"
                y1="117"
                x2="105"
                y2="117"
                stroke="#475569"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            ) : (
              // Sweet smiling curved mouth
              <path
                d="M 93,114 Q 100,121 107,114"
                stroke="#475569"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </motion.g>
        </svg>
      </div>
    </div>
  );
}
