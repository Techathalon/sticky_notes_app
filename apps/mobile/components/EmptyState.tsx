import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../store/themeStore';

type Variant = 'notes' | 'tasks' | 'events' | 'default';

interface EmptyStateProps {
  message?: string;
  variant?: Variant;
  compact?: boolean;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CONFIG: Record<Variant, {
  icon: IoniconName;
  iconColor: string;
  centerBg: string;
  leftColor: string;
  rightColor: string;
  leftBlob: string;
  rightBlob: string;
}> = {
  notes: {
    icon: 'document-text-outline',
    iconColor: '#7C3AED',
    centerBg: '#F5F3FF',
    leftColor: '#EDE9FE',
    rightColor: '#DDD6FE',
    leftBlob: '#C4B5FD',
    rightBlob: '#A78BFA',
  },
  tasks: {
    icon: 'checkmark-circle-outline',
    iconColor: '#16A34A',
    centerBg: '#F0FDF4',
    leftColor: '#DCFCE7',
    rightColor: '#BBF7D0',
    leftBlob: '#86EFAC',
    rightBlob: '#4ADE80',
  },
  events: {
    icon: 'calendar-outline',
    iconColor: '#E11D48',
    centerBg: '#FFF1F2',
    leftColor: '#FFE4E6',
    rightColor: '#FECDD3',
    leftBlob: '#FCA5A5',
    rightBlob: '#FB7185',
  },
  default: {
    icon: 'apps-outline',
    iconColor: '#0EA5E9',
    centerBg: '#F0F9FF',
    leftColor: '#E0F2FE',
    rightColor: '#BAE6FD',
    leftBlob: '#7DD3FC',
    rightBlob: '#38BDF8',
  },
};

// Size tokens for full and compact modes
const FULL = {
  stackW: 320, stackH: 280,
  centerW: 248, centerH: 196,
  sideW: 216, sideH: 186,
  iconSize: 40, iconRing: 72,
  titleSize: 17, subSize: 13,
  tx: 90, ty: 12,
  blobLg: 70, blobMd: 38, blobSm: 22,
  centerRadius: 28, sideRadius: 22,
  rotate: '15deg',
};
const COMP = {
  stackW: 210, stackH: 185,
  centerW: 158, centerH: 126,
  sideW: 138, sideH: 118,
  iconSize: 26, iconRing: 48,
  titleSize: 13, subSize: 11,
  tx: 58, ty: 8,
  blobLg: 44, blobMd: 24, blobSm: 14,
  centerRadius: 20, sideRadius: 16,
  rotate: '14deg',
};

export function EmptyState({
  message = 'Nothing here yet',
  variant = 'default',
  compact = false,
}: EmptyStateProps) {
  const c = useThemeColors();
  const cfg = CONFIG[variant];
  const sz = compact ? COMP : FULL;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={{ width: sz.stackW, height: sz.stackH, alignItems: 'center', justifyContent: 'center' }}>

        {/* ── Left decorative card ── */}
        <View style={[
          styles.sideCard,
          {
            backgroundColor: c.surface2,
            width: sz.sideW, height: sz.sideH,
            borderRadius: sz.sideRadius,
            transform: [{ rotate: `-${sz.rotate}` }, { translateX: -sz.tx }, { translateY: sz.ty }],
            zIndex: 1,
          },
        ]}>
          {/* Large blob top-right */}
          <View style={[styles.blob, {
            backgroundColor: cfg.leftBlob,
            width: sz.blobLg, height: sz.blobLg, borderRadius: sz.blobLg / 2,
            top: -sz.blobLg * 0.34, right: -sz.blobLg * 0.34,
          }]} />
          {/* Medium circle mid */}
          <View style={[styles.blob, {
            backgroundColor: cfg.leftBlob,
            width: sz.blobMd, height: sz.blobMd, borderRadius: sz.blobMd / 2,
            top: sz.sideH * 0.42, left: sz.sideW * 0.12,
            opacity: 0.45,
          }]} />
          {/* Small circle bottom */}
          <View style={[styles.blob, {
            backgroundColor: cfg.leftBlob,
            width: sz.blobSm, height: sz.blobSm, borderRadius: sz.blobSm / 2,
            bottom: sz.sideH * 0.14, right: sz.sideW * 0.18,
            opacity: 0.3,
          }]} />
          {/* Stripe lines */}
          <View style={[styles.stripe, { backgroundColor: cfg.leftBlob, bottom: sz.sideH * 0.28, left: 14, width: '55%' }]} />
          <View style={[styles.stripe, { backgroundColor: cfg.leftBlob, bottom: sz.sideH * 0.18, left: 14, width: '38%' }]} />
        </View>

        {/* ── Right decorative card ── */}
        <View style={[
          styles.sideCard,
          {
            backgroundColor: c.surface2,
            width: sz.sideW, height: sz.sideH,
            borderRadius: sz.sideRadius,
            transform: [{ rotate: sz.rotate }, { translateX: sz.tx }, { translateY: sz.ty }],
            zIndex: 2,
          },
        ]}>
          {/* Large blob top-left */}
          <View style={[styles.blob, {
            backgroundColor: cfg.rightBlob,
            width: sz.blobLg, height: sz.blobLg, borderRadius: sz.blobLg / 2,
            top: -sz.blobLg * 0.34, left: -sz.blobLg * 0.34,
          }]} />
          {/* Medium circle mid */}
          <View style={[styles.blob, {
            backgroundColor: cfg.rightBlob,
            width: sz.blobMd, height: sz.blobMd, borderRadius: sz.blobMd / 2,
            top: sz.sideH * 0.42, right: sz.sideW * 0.12,
            opacity: 0.45,
          }]} />
          {/* Small circle bottom */}
          <View style={[styles.blob, {
            backgroundColor: cfg.rightBlob,
            width: sz.blobSm, height: sz.blobSm, borderRadius: sz.blobSm / 2,
            bottom: sz.sideH * 0.14, left: sz.sideW * 0.18,
            opacity: 0.3,
          }]} />
          {/* Stripe lines */}
          <View style={[styles.stripe, { backgroundColor: cfg.rightBlob, bottom: sz.sideH * 0.28, right: 14, width: '55%' }]} />
          <View style={[styles.stripe, { backgroundColor: cfg.rightBlob, bottom: sz.sideH * 0.18, right: 14, width: '38%' }]} />
        </View>

        {/* ── Center card (highest z-index — covers lower halves of side cards) ── */}
        <View style={[
          styles.centerCard,
          {
            backgroundColor: c.surface,
            width: sz.centerW, height: sz.centerH,
            borderRadius: sz.centerRadius,
          },
        ]}>
          {/* Icon ring behind icon */}
          <View style={[styles.iconRing, {
            width: sz.iconRing, height: sz.iconRing,
            borderRadius: sz.iconRing / 2,
            borderColor: cfg.iconColor + '28',
          }]} />
          <Ionicons name={cfg.icon} size={sz.iconSize} color={cfg.iconColor} style={styles.iconOverRing} />
          <Text style={[styles.title, { fontSize: sz.titleSize, color: c.text }]}>{message}</Text>
          {!compact && (
            <Text style={[styles.sub, { fontSize: sz.subSize }]}>Tap  +  to get started</Text>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
    overflow: 'hidden',
  },
  containerCompact: {
    flex: 0,
    paddingBottom: 0,
    paddingVertical: 12,
  },

  /* ── Side cards ── */
  sideCard: {
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  blob: {
    position: 'absolute',
    opacity: 0.55,
  },
  stripe: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    opacity: 0.35,
  },

  /* ── Center card ── */
  centerCard: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 10,
  },
  iconRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  iconOverRing: {
    zIndex: 1,
    marginBottom: 2,
  },
  title: {
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 2,
  },
  sub: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 1,
  },
});
