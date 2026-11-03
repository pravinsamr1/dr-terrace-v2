import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
  Rect,
  Path,
  Ellipse,
  G,
} from 'react-native-svg';

// ─── 1. Calendar + Plus Icon (Orange) ────────────────────────────────────────
export function CalendarPlusIcon3D({ size = 68 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="calBg" cx="50%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#FFD580" />
          <Stop offset="100%" stopColor="#FF8C00" />
        </RadialGradient>
        <LinearGradient id="calTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FF7A00" />
          <Stop offset="100%" stopColor="#CC5500" />
        </LinearGradient>
        <LinearGradient id="calPage" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#F0F0F0" />
        </LinearGradient>
        <LinearGradient id="plusGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FF9A3C" />
          <Stop offset="100%" stopColor="#E65000" />
        </LinearGradient>
      </Defs>

      {/* Background circle */}
      <Circle cx="40" cy="40" r="38" fill="url(#calBg)" />
      {/* Highlight top-left */}
      <Ellipse cx="26" cy="22" rx="11" ry="7" fill="rgba(255,255,255,0.28)" />

      {/* Calendar shadow (depth) */}
      <Rect x="20" y="33" width="38" height="28" rx="4" fill="rgba(0,0,0,0.18)" />

      {/* Calendar header (orange top bar) */}
      <Rect x="18" y="28" width="40" height="13" rx="4" fill="url(#calTop)" />
      {/* Header shine */}
      <Rect x="20" y="29" width="36" height="4" rx="2" fill="rgba(255,255,255,0.2)" />

      {/* Ring bindings — inside viewBox, no clipping */}
      {[26, 33, 40, 47, 54].map((x, i) => (
        <G key={i}>
          <Rect x={x - 2} y="23" width="4" height="8" rx="2" fill="#1A1A1A" />
          <Rect x={x - 1.5} y="23" width="2" height="3.5" rx="1" fill="rgba(255,255,255,0.3)" />
        </G>
      ))}

      {/* Calendar white page */}
      <Rect x="18" y="37" width="40" height="24" rx="3" fill="url(#calPage)" />

      {/* Grid lines */}
      {[43, 48, 53].map((y, i) => (
        <Path key={i} d={"M22 " + y + " H54"} stroke="#E0E0E0" strokeWidth="1" />
      ))}
      {[22, 27, 32, 37, 42, 48].map((x, i) => (
        <Path key={i} d={"M" + (x + 8) + " 38 V59"} stroke="#E0E0E0" strokeWidth="1" />
      ))}

      {/* Highlighted date cell */}
      <Rect x="32" y="44" width="9" height="9" rx="2" fill="#FF7A00" />

      {/* Plus badge */}
      <Circle cx="54" cy="56" r="10" fill="rgba(0,0,0,0.2)" />
      <Circle cx="53" cy="55" r="10" fill="url(#plusGrad)" />
      <Circle cx="50" cy="52" r="3.5" fill="rgba(255,255,255,0.25)" />
      <Rect x="49.5" y="51.5" width="7" height="3" rx="1.5" fill="white" />
      <Rect x="52.5" y="48.5" width="3" height="9" rx="1.5" fill="white" />
    </Svg>
  );
}

// ─── 2. Clipboard Checklist Icon (Purple) ─────────────────────────────────────
export function ClipboardListIcon3D({ size = 68 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="clipBg" cx="50%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#C39EFF" />
          <Stop offset="100%" stopColor="#6D28D9" />
        </RadialGradient>
        <LinearGradient id="clipBoard" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0%" stopColor="#9B59F5" />
          <Stop offset="100%" stopColor="#6D28D9" />
        </LinearGradient>
        <LinearGradient id="clipPage" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#EEE8FF" />
        </LinearGradient>
        <LinearGradient id="checkGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#8B5CF6" />
          <Stop offset="100%" stopColor="#5B21B6" />
        </LinearGradient>
      </Defs>

      <Circle cx="40" cy="40" r="38" fill="url(#clipBg)" />
      <Ellipse cx="26" cy="22" rx="11" ry="7" fill="rgba(255,255,255,0.22)" />

      {/* Clipboard board shadow */}
      <Rect x="24" y="24" width="33" height="40" rx="4" fill="rgba(0,0,0,0.2)" />
      {/* Clipboard board */}
      <Rect x="22" y="22" width="33" height="40" rx="4" fill="url(#clipBoard)" />
      {/* Board shine */}
      <Rect x="24" y="23" width="29" height="5" rx="2" fill="rgba(255,255,255,0.18)" />

      {/* Clipboard clip (top) */}
      <Rect x="33" y="17" width="10" height="9" rx="2.5" fill="#4C1D95" />
      <Rect x="35" y="19" width="6" height="5" rx="1.5" fill="#7C3AED" />
      <Rect x="35" y="19" width="6" height="2.5" rx="1" fill="rgba(255,255,255,0.3)" />

      {/* White page */}
      <Rect x="25" y="28" width="27" height="30" rx="2" fill="url(#clipPage)" />

      {/* Checklist rows */}
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 33 + i * 5.5;
        const checked = i < 3;
        return (
          <G key={i}>
            <Rect x="28" y={y} width="5.5" height="4.5" rx="1.2"
              fill={checked ? "url(#checkGrad)" : "none"}
              stroke={checked ? "none" : "#C4B5FD"}
              strokeWidth="1.2" />
            {checked && (
              <Path
                d={"M29 " + (y + 2.2) + " L30.4 " + (y + 3.5) + " L33 " + (y + 1)}
                stroke="white" strokeWidth="1.3"
                strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
            <Rect x="35.5" y={y + 1} width="13" height="2.5" rx="1.25"
              fill={checked ? "#C4B5FD" : "#E0D9FF"} />
          </G>
        );
      })}
    </Svg>
  );
}

// ─── 3. Account Group Icon (Blue) ─────────────────────────────────────────────
export function AccountGroupIcon3D({ size = 68 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="grpBg" cx="50%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#60C3FF" />
          <Stop offset="100%" stopColor="#1B5DE3" />
        </RadialGradient>
        <LinearGradient id="centerFig" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2563EB" />
          <Stop offset="100%" stopColor="#1D4ED8" />
        </LinearGradient>
        <LinearGradient id="sideFig" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#DBEAFE" />
        </LinearGradient>
        <LinearGradient id="platform" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#3B82F6" />
          <Stop offset="100%" stopColor="#1E40AF" />
        </LinearGradient>
      </Defs>

      <Circle cx="40" cy="40" r="38" fill="url(#grpBg)" />
      <Ellipse cx="26" cy="22" rx="11" ry="7" fill="rgba(255,255,255,0.22)" />

      {/* Platform */}
      <Ellipse cx="40" cy="63" rx="22" ry="5" fill="rgba(0,0,0,0.18)" />
      <Rect x="20" y="59" width="40" height="5" rx="2.5" fill="url(#platform)" />
      <Rect x="22" y="59" width="36" height="2" rx="1" fill="rgba(255,255,255,0.2)" />

      {/* Left figure */}
      <Circle cx="22" cy="38" r="6.5" fill="url(#sideFig)" />
      <Circle cx="20" cy="36" r="2.5" fill="rgba(255,255,255,0.5)" />
      <Path d="M14 59 Q14 49 22 49 Q30 49 30 59 Z" fill="url(#sideFig)" />

      {/* Right figure */}
      <Circle cx="58" cy="38" r="6.5" fill="url(#sideFig)" />
      <Circle cx="56" cy="36" r="2.5" fill="rgba(255,255,255,0.5)" />
      <Path d="M50 59 Q50 49 58 49 Q66 49 66 59 Z" fill="url(#sideFig)" />

      {/* Center figure (blue, front) */}
      <Circle cx="40" cy="33" r="8.5" fill="url(#centerFig)" />
      <Circle cx="37" cy="30" r="3" fill="rgba(255,255,255,0.35)" />
      <Path d="M29 59 Q29 47 40 47 Q51 47 51 59 Z" fill="url(#centerFig)" />
      <Ellipse cx="40" cy="50" rx="5" ry="3" fill="rgba(255,255,255,0.18)" />
    </Svg>
  );
}

// ─── 4. File Send / Quote Icon (Teal) ─────────────────────────────────────────
export function FileSendIcon3D({ size = 68 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="fileBg" cx="50%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#5FF0DC" />
          <Stop offset="100%" stopColor="#099A8B" />
        </RadialGradient>
        <LinearGradient id="docGrad" x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#E0FAF7" />
        </LinearGradient>
        <LinearGradient id="planeGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#20D9C4" />
          <Stop offset="100%" stopColor="#0E7A6E" />
        </LinearGradient>
        <LinearGradient id="foldGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#E0FAF7" />
          <Stop offset="100%" stopColor="#B2EFE8" />
        </LinearGradient>
      </Defs>

      <Circle cx="40" cy="40" r="38" fill="url(#fileBg)" />
      <Ellipse cx="26" cy="22" rx="11" ry="7" fill="rgba(255,255,255,0.22)" />

      {/* Doc shadow */}
      <Rect x="19" y="22" width="32" height="42" rx="3" fill="rgba(0,0,0,0.18)" />
      {/* Doc page */}
      <Path d="M16 20 L40 20 L48 28 L48 62 Q48 65 45 65 L16 65 Q13 65 13 62 L13 23 Q13 20 16 20 Z"
        fill="url(#docGrad)" />
      {/* Folded corner */}
      <Path d="M40 20 L40 28 L48 28 Z" fill="url(#foldGrad)" />
      <Path d="M40 20 L48 28" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" fill="none" />

      {/* Doc lines */}
      {[35, 41, 47, 53, 59].map((y, i) => (
        <Rect key={i} x="18" y={y} width={i === 0 ? 20 : 25} height="3" rx="1.5" fill="#B2EFE8" />
      ))}

      {/* Dollar badge */}
      <Circle cx="37" cy="28" r="6" fill="#20CAB4" />
      <Path d="M35 26 L39 26 M37 24 L37 33 M35 29 L39 29"
        stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Paper airplane */}
      <Path d="M52 24 L65 38 L52 43 Z" fill="url(#planeGrad)" />
      <Path d="M52 24 L65 38 L58 41 Z" fill="rgba(255,255,255,0.3)" />
      <Path d="M52 43 L58 41 L55 52 Z" fill="url(#planeGrad)" />
      <Path d="M55 27 L63 36"
        stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ─── 5. Wallet Icon (Rose) ───────────────────────────────────────────────────
export function WalletIcon3D({ size = 68 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="walBg" cx="50%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#FDA4AF" />
          <Stop offset="100%" stopColor="#E11D48" />
        </RadialGradient>
      </Defs>
      <Circle cx="40" cy="40" r="38" fill="url(#walBg)" />
      <Ellipse cx="26" cy="22" rx="11" ry="7" fill="rgba(255,255,255,0.28)" />
      <Rect x="20" y="30" width="42" height="30" rx="6" fill="rgba(0,0,0,0.18)" />
      <Rect x="18" y="27" width="42" height="30" rx="6" fill="#FFFFFF" />
      <Rect x="18" y="27" width="42" height="8" rx="4" fill="#FECDD3" />
      <Rect x="46" y="38" width="17" height="11" rx="4" fill="#BE123C" />
      <Circle cx="52" cy="43.5" r="2.4" fill="#FFFFFF" />
    </Svg>
  );
}

// ─── 6. Shield + Check Icon (Amber) ──────────────────────────────────────────
export function ShieldCheckIcon3D({ size = 68 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="shdBg" cx="50%" cy="45%" r="50%">
          <Stop offset="0%" stopColor="#FDE68A" />
          <Stop offset="100%" stopColor="#D97706" />
        </RadialGradient>
      </Defs>
      <Circle cx="40" cy="40" r="38" fill="url(#shdBg)" />
      <Ellipse cx="26" cy="22" rx="11" ry="7" fill="rgba(255,255,255,0.28)" />
      <Path d="M41 21 L60 28 V42 C60 54 51 61 41 65 C31 61 22 54 22 42 V28 Z" fill="rgba(0,0,0,0.18)" />
      <Path d="M40 18 L59 25 V39 C59 51 50 58 40 62 C30 58 21 51 21 39 V25 Z" fill="#FFFFFF" />
      <Path d="M31 40 L38 47 L50 33" fill="none" stroke="#B45309" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
