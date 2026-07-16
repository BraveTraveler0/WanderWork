const EnsoLogo = ({ size = 120, color = '#306770' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible' }}>
    <defs>
      <filter id="enso-brush" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="8" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>

    {/* Outer soft shadow stroke */}
    <path
      d="M 108 19 A 81 81 0 1 1 93 19.5"
      fill="none"
      stroke={color}
      strokeWidth="26"
      strokeLinecap="round"
      filter="url(#enso-brush)"
      style={{ opacity: 0.12 }}
    />

    {/* Main stroke */}
    <path
      d="M 108 19 A 81 81 0 1 1 93 19.5"
      fill="none"
      stroke={color}
      strokeWidth="17"
      strokeLinecap="round"
      filter="url(#enso-brush)"
      style={{ opacity: 0.88 }}
    />

    {/* Taper fade at the tail end */}
    <path
      d="M 108 19 A 81 81 0 1 1 93 19.5"
      fill="none"
      stroke="white"
      strokeWidth="17"
      strokeLinecap="round"
      strokeDasharray="20 9999"
      strokeDashoffset="-488"
      style={{ opacity: 0.55 }}
    />
  </svg>
)

export default EnsoLogo
