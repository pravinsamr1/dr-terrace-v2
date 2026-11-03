import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from './ReportsUi';

const HEIGHT = 190;
const PAD = { top: 34, right: 14, bottom: 26, left: 42 };
const GRID_LINES = 4;

const niceMax = (value) => {
  if (value <= 0) return 4;
  const step = 10 ** Math.floor(Math.log10(value / GRID_LINES));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * GRID_LINES >= value) || step * 10;
  return nice * GRID_LINES;
};

// Smooth curve through every point (Catmull-Rom converted to cubic Béziers)
const smoothPath = (points) => points.reduce((path, point, i) => {
  if (i === 0) return `M ${point.x} ${point.y}`;
  const p0 = points[i - 2] || points[i - 1];
  const p1 = points[i - 1];
  const p3 = points[i + 1] || point;
  const c1x = p1.x + (point.x - p0.x) / 6;
  const c1y = p1.y + (point.y - p0.y) / 6;
  const c2x = point.x - (p3.x - p1.x) / 6;
  const c2y = point.y - (p3.y - p1.y) / 6;
  return `${path} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${point.x} ${point.y}`;
}, '');

/** points: [{ label, value }]. Tap the chart to show a point's value. */
export default function TrendChart({ points, formatValue, formatAxis, labelEvery = 1 }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);

  const max = niceMax(Math.max(0, ...points.map((p) => Number(p.value) || 0)));
  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD.left + (points.length > 1 ? i * stepX : plotWidth / 2),
    y: PAD.top + plotHeight - ((Number(p.value) || 0) / max) * plotHeight,
  }));
  const activeIndex = selected ?? points.length - 1;
  const active = coords[activeIndex];
  const line = coords.length ? smoothPath(coords) : '';
  const area = coords.length
    ? `${line} L ${coords.at(-1).x} ${PAD.top + plotHeight} L ${coords[0].x} ${PAD.top + plotHeight} Z`
    : '';

  const onPress = (event) => {
    if (!stepX) return;
    const index = Math.round((event.nativeEvent.locationX - PAD.left) / stepX);
    setSelected(Math.min(points.length - 1, Math.max(0, index)));
  };

  const tooltipText = points[activeIndex] ? formatValue(points[activeIndex].value) : '';
  const tooltipWidth = Math.max(64, tooltipText.length * 8 + 20);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.18" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
              const y = PAD.top + (plotHeight / GRID_LINES) * i;
              return <Line key={i} x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />;
            })}
            {!!area && <Path d={area} fill="url(#trendFill)" />}
            {!!active && (
              <Line x1={active.x} x2={active.x} y1={active.y} y2={PAD.top + plotHeight} stroke={colors.slate} strokeWidth={1} />
            )}
            {!!line && <Path d={line} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" />}
            {coords.map((c, i) => (
              <Circle key={i} cx={c.x} cy={c.y} r={i === activeIndex ? 6 : points.length > 12 ? 2.5 : 4.5} fill="#FFFFFF" stroke={colors.primary} strokeWidth={2.5} />
            ))}
          </Svg>
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
            <Text key={i} style={[styles.axis, { top: PAD.top + (plotHeight / GRID_LINES) * i - 7 }]}>
              {formatAxis((max / GRID_LINES) * (GRID_LINES - i))}
            </Text>
          ))}
          {points.map((p, i) => ((i % labelEvery === 0 || i === points.length - 1) ? (
            <Text key={p.label} style={[styles.xLabel, { left: coords[i].x - 24 }]}>{p.label}</Text>
          ) : null))}
          {!!active && (
            <View
              pointerEvents="none"
              style={[
                styles.tooltip,
                { width: tooltipWidth, top: Math.max(0, active.y - 40), left: Math.min(width - tooltipWidth, Math.max(0, active.x - tooltipWidth / 2)) },
              ]}
            >
              <Text style={styles.tooltipText}>{tooltipText}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontSize: 10, color: colors.slate },
  xLabel: { position: 'absolute', bottom: 4, width: 48, textAlign: 'center', fontSize: 11, color: colors.muted },
  tooltip: {
    position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 5, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  tooltipText: { fontSize: 12, fontWeight: '700', color: colors.text },
});
