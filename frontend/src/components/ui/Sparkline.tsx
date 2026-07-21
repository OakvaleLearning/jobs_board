interface SparklineProps {
  series: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ series, width = 80, height = 24, className }: SparklineProps) {
  if (!series || series.length === 0) return null;
  const n = series.length;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const stepX = n > 1 ? width / (n - 1) : 0;
  const points = series
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
