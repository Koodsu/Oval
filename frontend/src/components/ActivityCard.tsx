import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Activity } from '../types';
import PressableScale from './PressableScale';
import { home, cardShadowHome } from '../theme';
import { getActivityEmoji } from '../utils/activityEmoji';
import { getCategoryPillStyle } from '../utils/activityCategoryPill';

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
  /** Home Today screen: extra footer row + tighter vertical rhythm per design spec */
  variant?: 'default' | 'home';
}

export default function ActivityCard({ activity, onPress, variant = 'default' }: ActivityCardProps) {
  const pill = getCategoryPillStyle(activity.category);
  const emoji = getActivityEmoji(activity.title, activity.category);
  const isHome = variant === 'home';
  const podCount = activity._count?.pods ?? 0;
  const statusFooter =
    podCount > 0
      ? { label: 'OPEN' as const, bg: '#FFF7ED', text: '#EA580C' }
      : { label: 'NEW' as const, bg: '#F0FDF4', text: '#16A34A' };
  const podsFormingLabel =
    podCount === 0 ? 'No pods yet' : `${podCount} pods forming`;

  return (
    <PressableScale
      style={[styles.card, cardShadowHome, isHome && styles.cardHome]}
      onPress={onPress}
      haptic="light"
    >
      <View style={styles.topRow}>
        <View style={[styles.emojiCircle, { backgroundColor: pill.emojiCircleBg }]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </View>
        <View style={styles.mainCol}>
          <View style={[styles.titleRow, isHome && styles.titleRowHome]}>
            <Text style={styles.title} numberOfLines={1}>
              {activity.title}
            </Text>
            <View style={[styles.categoryPill, { backgroundColor: pill.pillBg }]}>
              <Text style={[styles.categoryPillText, { color: pill.pillText }]}>{pill.label}</Text>
            </View>
          </View>
          <Text style={[styles.desc, isHome && styles.descHome]} numberOfLines={2}>
            {activity.description}
          </Text>
          <View style={[styles.locationRow, isHome && styles.locationRowHome]}>
            <Ionicons name="location-outline" size={12} color={home.textMuted} />
            <Text style={styles.location} numberOfLines={1}>
              {activity.defaultLocation}
            </Text>
          </View>
          {isHome ? (
            <View style={styles.homeFooterRow}>
              <Text
                style={[styles.homeFooterLeft, podCount === 0 && styles.homeFooterLeftEmpty]}
              >
                {podsFormingLabel}
              </Text>
              <View style={[styles.homeStatusPill, { backgroundColor: statusFooter.bg }]}>
                <Text style={[styles.homeStatusPillText, { color: statusFooter.text }]}>
                  {statusFooter.label}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: home.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardHome: {
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRowHome: {
    marginBottom: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
  },
  categoryPill: {
    flexShrink: 0,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  desc: {
    fontSize: 14,
    color: home.textSecondary,
    marginBottom: 6,
  },
  descHome: {
    marginTop: 4,
    marginBottom: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationRowHome: {
    marginTop: 4,
  },
  homeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  homeFooterLeft: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  homeFooterLeftEmpty: {
    color: '#BBBBBB',
  },
  homeStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  homeStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  location: {
    fontSize: 12,
    color: home.textMuted,
    flex: 1,
  },
});
