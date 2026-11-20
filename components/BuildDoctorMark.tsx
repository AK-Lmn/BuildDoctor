/**
 * BuildDoctorMark — Option 01: The Syntax Pulse.
 * Dual code brackets (< >) bounding an active diagnostic telemetry pulse.
 * Supports smooth stroke-dashoffset pulse micro-animation when analyzing.
 */

interface Props {
  className?: string;
  size?: number;
  isAnalyzing?: boolean;
}

export default function BuildDoctorMark({
  className = '',
  size = 32,
  isAnalyzing = false,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <style>{`
          @keyframes telemetryPulse {
            0% {
              stroke-dashoffset: 0;
            }
            100% {
              stroke-dashoffset: -144;
            }
          }
          .animate-telemetry {
            stroke-dasharray: 24 48;
            animation: telemetryPulse 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-telemetry {
              animation: none !important;
              stroke-dasharray: none !important;
            }
          }
        `}</style>
      </defs>

      {/* Container Background */}
      <rect
        width="256"
        height="256"
        rx="54"
        fill="#101118"
        stroke="rgba(157, 123, 255, 0.2)"
        strokeWidth="10"
      />

      {/* Left Code Bracket */}
      <path
        d="M96 64L36 128L96 192"
        stroke="#9D7BFF"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Code Bracket */}
      <path
        d="M160 64L220 128L160 192"
        stroke="#9D7BFF"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central Diagnostic Waveform Pulse */}
      <path
        d="M76 128H104L118 84L138 172L152 128H180"
        stroke="#B59AFF"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isAnalyzing ? 'animate-telemetry' : undefined}
      />
    </svg>
  );
}
