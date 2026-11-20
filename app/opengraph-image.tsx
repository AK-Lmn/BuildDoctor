import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BuildDoctor — Deterministic Build Diagnostics';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#000000',
          backgroundImage: 'radial-gradient(circle at 85% 20%, rgba(157, 123, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 15% 85%, rgba(181, 154, 255, 0.08) 0%, transparent 45%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Syntax Pulse Mark SVG */}
            <svg
              width="56"
              height="56"
              viewBox="0 0 256 256"
              fill="none"
            >
              <rect
                width="256"
                height="256"
                rx="54"
                fill="#101118"
                stroke="rgba(157, 123, 255, 0.28)"
                strokeWidth="10"
              />
              <path
                d="M96 64L36 128L96 192"
                stroke="#9D7BFF"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M160 64L220 128L160 192"
                stroke="#9D7BFF"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M76 128H104L118 84L138 172L152 128H180"
                stroke="#B59AFF"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <span
              style={{
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#ffffff',
              }}
            >
              Build<span style={{ color: '#9d7bff' }}>Doctor</span>
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 16px',
              borderRadius: '9999px',
              background: 'rgba(157, 123, 255, 0.1)',
              border: '1px solid #433878',
              color: '#9d7bff',
              fontSize: '14px',
              fontFamily: 'monospace',
            }}
          >
            v2.1 // DETERMINISTIC ENGINE
          </div>
        </div>

        {/* Central Hero Typography */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px' }}>
          <h1
            style={{
              fontSize: '60px',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              margin: 0,
              color: '#ffffff',
            }}
          >
            Turn build failures into a <span style={{ color: '#9d7bff' }}>fix plan</span>.
          </h1>
          <p
            style={{
              fontSize: '24px',
              color: '#a4a7bd',
              lineHeight: 1.45,
              margin: 0,
              maxWidth: '820px',
            }}
          >
            Deterministic static diagnostics for broken GitHub repositories and compiler logs.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '8px',
              background: '#101118',
              border: '1px solid rgba(157, 123, 255, 0.2)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Static Analysis
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '8px',
              background: '#101118',
              border: '1px solid rgba(157, 123, 255, 0.2)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Zero Code Execution
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '8px',
              background: '#101118',
              border: '1px solid rgba(157, 123, 255, 0.2)',
              color: '#9d7bff',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Verified Git Diffs
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
