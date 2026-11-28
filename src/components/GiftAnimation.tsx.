import React from 'react';
import { motion } from 'framer-motion';

export default function GiftAnimation({ size = 100 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* САМО СЕРДЦЕ */}
      <motion.div
        initial={{ scale: 0.8, rotate: -10 }}
        animate={{ 
          scale: [0.8, 1.1, 1], 
          rotate: [0, 0, 360], // Вращение после попадания
        }}
        transition={{ 
          duration: 2, 
          times: [0, 0.3, 1], 
          repeat: Infinity, 
          repeatDelay: 1 
        }}
        className="relative z-10"
        style={{ filter: 'drop-shadow(0 10px 15px rgba(239, 68, 68, 0.5))' }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="url(#heartGradient)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5">
          <defs>
            <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4b4b" />
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </motion.div>

      {/* СТРЕЛА */}
      <motion.div
        initial={{ x: -100, y: -100, opacity: 0 }}
        animate={{ 
          x: 0, 
          y: 0, 
          opacity: [0, 1, 1, 0],
          rotate: [45, 45, 45, 45]
        }}
        transition={{ 
          duration: 2, 
          times: [0, 0.2, 0.3, 0.4],
          repeat: Infinity, 
          repeatDelay: 1
        }}
        className="absolute z-20"
        style={{ filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.5))' }}
      >
        <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="19" x2="19" y2="5"></line>
          <polyline points="12 5 19 5 19 12"></polyline>
        </svg>
      </motion.div>
    </div>
  );
}
