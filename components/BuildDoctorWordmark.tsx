'use client';

import { motion } from 'framer-motion';
import BuildDoctorMark from '@/components/BuildDoctorMark';

interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isAnalyzing?: boolean;
  showVersion?: boolean;
}

const SIZES = {
  sm: { mark: 24, text: '15px', sub: '11px', badge: '10px' },
  md: { mark: 32, text: '18px', sub: '12px', badge: '11px' },
  lg: { mark: 40, text: '22px', sub: '13px', badge: '12px' },
};

export default function BuildDoctorWordmark({
  className = '',
  size = 'md',
  isAnalyzing = false,
  showVersion = true,
}: Props) {
  const s = SIZES[size];

  return (
    <motion.div
      className={className}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        textDecoration: 'none',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      <BuildDoctorMark size={s.mark} isAnalyzing={isAnalyzing} />

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: s.text,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}
          >
            Build<span style={{ color: '#9d7bff' }}>Doctor</span>
          </span>

          {showVersion && (
            <span
              style={{
                fontSize: s.badge,
                fontFamily: 'ui-monospace, Consolas, monospace',
                color: '#9d7bff',
                background: 'rgba(157, 123, 255, 0.1)',
                border: '1px solid #433878',
                borderRadius: '9999px',
                padding: '1px 7px',
                lineHeight: 1.4,
              }}
            >
              v2.1
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: s.sub,
            color: '#a4a7bd',
            lineHeight: 1.3,
            marginTop: '1px',
          }}
        >
          Build error diagnosis and fix plans
        </span>
      </div>
    </motion.div>
  );
}
