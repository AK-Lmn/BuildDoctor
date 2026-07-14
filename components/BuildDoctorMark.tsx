/**
 * BuildDoctorMark — inline SVG brand mark.
 * Represents a terminal window with a diagnostic pulse ending in a checkmark.
 */

interface Props {
  className?: string;
  size?: number;
}

export default function BuildDoctorMark({ className = '', size = 32 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      role="img"
    >
      {/* Terminal window frame */}
      <rect
        x="1.5"
        y="4"
        width="29"
        height="24"
        rx="3"
        stroke="#F59E0B"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Title bar */}
      <line x1="1.5" y1="9.5" x2="30.5" y2="9.5" stroke="#F59E0B" strokeWidth="1.5" />
      {/* Traffic dots */}
      <circle cx="5.5" cy="6.75" r="1" fill="#F59E0B" opacity="0.6" />
      <circle cx="9" cy="6.75" r="1" fill="#F59E0B" opacity="0.4" />
      <circle cx="12.5" cy="6.75" r="1" fill="#F59E0B" opacity="0.2" />
      {/* Diagnostic pulse line — starts flat, rises, dips, rises to check */}
      <polyline
        points="3,21 8,21 10,16 12,24 14,19 17,19 19.5,15 22,21 24.5,21"
        stroke="#22D3EE"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Checkmark at end of pulse */}
      <polyline
        points="25.5,19 27.5,21.5 30.5,17"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
