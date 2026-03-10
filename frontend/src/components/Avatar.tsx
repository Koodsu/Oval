import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { resolveAvatarUrl } from '../api';

interface AvatarProps {
  name: string;
  size?: number;
  isYou?: boolean;
  uri?: string | null;
}

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function Avatar({ name, size = 36, isYou = false, uri }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const bg = colors.avatarPalette[hashName(name) % colors.avatarPalette.length];
  const initial = name.charAt(0).toUpperCase();
  const fontSize = size * 0.42;
  const showImage = !!uri && !imageError;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        isYou && styles.youRing,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[styles.initial, { fontSize, lineHeight: size }]}>{initial}</Text>
      )}
    </View>
  );
}

export function AvatarStack({
  members,
  currentUserId,
  size = 32,
  max = 4,
  onMemberPress,
}: {
  members: { id: string; user: { id: string; name: string; avatarUrl?: string | null } }[];
  currentUserId?: string;
  size?: number;
  max?: number;
  onMemberPress?: (member: { id: string; user: { id: string; name: string; avatarUrl?: string | null } }) => void;
}) {
  const visible = members.slice(0, max);
  const overlap = size * 0.3;

  return (
    <View style={[styles.stack, { height: size }]}>
      {visible.map((m, i) => {
        const isYou = m.user.id === currentUserId;
        const content = (
          <Avatar name={m.user.name} size={size} isYou={isYou} uri={resolveAvatarUrl(m.user.avatarUrl)} />
        );

        return (
          <View
            key={m.id}
            style={[
              styles.stackItem,
              { marginLeft: i === 0 ? 0 : -overlap, zIndex: visible.length - i },
            ]}
          >
            {onMemberPress && !isYou ? (
              <TouchableOpacity onPress={() => onMemberPress(m)} activeOpacity={0.7}>
                {content}
              </TouchableOpacity>
            ) : (
              content
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
  },
  youRing: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackItem: {
    borderRadius: 999,
  },
});
