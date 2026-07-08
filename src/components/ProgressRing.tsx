interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  isUnmarked?: boolean;
}

export function ProgressRing({ percentage, size = 52, strokeWidth = 5, isUnmarked = false }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (isUnmarked ? 0 : (percentage / 100) * circumference);

  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--slate-100)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={isUnmarked ? 'var(--slate-300)' : percentage >= 75 ? 'var(--present)' : percentage >= 50 ? 'var(--unmarked)' : 'var(--absent)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.35s' }}
        />
      </svg>
      <span className="progress-ring-label" style={{ fontSize: `${size * 0.23}px`, color: isUnmarked ? 'var(--slate-400)' : 'var(--slate-800)' }}>
        {isUnmarked ? '—' : `${percentage}%`}
      </span>
    </div>
  );
}
