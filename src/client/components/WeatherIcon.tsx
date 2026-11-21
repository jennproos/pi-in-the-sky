/** Simple line icons for WMO weather codes. Drawn inline so no emoji font is needed on the Pi. */

type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

function kindFor(code: number): Kind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

const cloud = 'M18 38h24a9 9 0 0 0 0-18 13 13 0 0 0-25-2 10 10 0 0 0 1 20z';

export function WeatherIcon({ code, isDay, size = 64 }: { code: number; isDay: boolean; size?: number }) {
  const kind = kindFor(code);
  const sun = (cx: number, cy: number, r: number) =>
    isDay ? (
      <g>
        <circle cx={cx} cy={cy} r={r} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * (r + 4)}
              y1={cy + Math.sin(a) * (r + 4)}
              x2={cx + Math.cos(a) * (r + 9)}
              y2={cy + Math.sin(a) * (r + 9)}
            />
          );
        })}
      </g>
    ) : (
      <path d={`M${cx + r * 0.4} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.8} ${r * 1.6} a${r * 0.8} ${r * 0.8} 0 0 1 -${r * 0.8} -${r * 1.6}z`} />
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'clear' && sun(30, 30, 11)}
      {kind === 'partly' && (
        <>
          {sun(22, 20, 8)}
          <path d={cloud} transform="translate(4 8)" />
        </>
      )}
      {(kind === 'cloudy' || kind === 'rain' || kind === 'snow' || kind === 'storm') && <path d={cloud} />}
      {kind === 'fog' && (
        <>
          <path d={cloud} transform="translate(0 -6)" />
          <line x1="12" y1="44" x2="48" y2="44" />
          <line x1="16" y1="51" x2="44" y2="51" />
        </>
      )}
      {kind === 'rain' && [20, 30, 40].map((x) => <line key={x} x1={x} y1="44" x2={x - 3} y2="52" />)}
      {kind === 'snow' &&
        [20, 30, 40].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 51 : 46} r="1.6" fill="currentColor" />)}
      {kind === 'storm' && <path d="M31 40l-5 8h7l-4 8" />}
    </svg>
  );
}
