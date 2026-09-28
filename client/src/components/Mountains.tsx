/** Layered misty ridges, drawn in the current palette so they change with the mirror mode. */
export default function Mountains({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <defs>
        <filter id="fm-haze" x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="fm-soft" x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="fm-fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bg)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--bg)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        filter="url(#fm-haze)"
        fill="var(--ridge-far)"
        opacity="0.8"
        d="M0 250 C180 210 260 150 380 160 C470 168 520 120 600 70 C660 34 720 60 780 110 C860 175 980 150 1080 170 C1200 195 1320 170 1440 190 L1440 360 L0 360 Z"
      />
      <path
        filter="url(#fm-haze)"
        fill="var(--mist)"
        opacity="0.35"
        d="M420 190 C520 160 600 110 660 90 C720 75 760 120 820 150 C900 190 980 200 1060 210 L1060 260 L420 260 Z"
      />
      <path
        filter="url(#fm-soft)"
        fill="var(--ridge-mid)"
        d="M0 290 C140 260 250 230 360 240 C480 250 560 205 660 200 C760 195 830 240 940 245 C1060 250 1160 215 1280 225 C1360 232 1400 245 1440 250 L1440 360 L0 360 Z"
      />
      <path
        fill="var(--ridge-near)"
        d="M0 320 C160 300 300 285 440 295 C580 305 700 280 840 285 C980 290 1100 310 1240 305 C1330 302 1390 298 1440 300 L1440 360 L0 360 Z"
      />
      <rect x="0" y="200" width="1440" height="160" fill="url(#fm-fog)" />
    </svg>
  );
}
