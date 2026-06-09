import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Panel, Screen, ScreenHeader } from '../components/ui';
import { palette, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
const SITE_URL = 'https://www.joinbridgeapp.com';

export default function SettingsScreen({ navigation }: Props) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

        <Text style={styles.sectionLabel}>Account</Text>
        <Panel>
          <SettingsRow
            icon="person-outline"
            title="Profile information"
            body="Update your photo, bio, school details, interests, and social profile."
            onPress={() => navigation.navigate('EditProfile')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy & Data"
            body="Download your data, control notifications and connected accounts, or delete your account."
            onPress={() => navigation.navigate('PrivacyData')}
          />
        </Panel>

        <Text style={styles.sectionLabel}>Safety & Legal</Text>
        <Panel>
          <SettingsRow
            icon="ban-outline"
            title="Blocked users"
            onPress={() => navigation.navigate('BlockedUsers')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="document-text-outline"
            title="Privacy policy"
            onPress={() => void Linking.openURL(`${SITE_URL}/privacy`)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="reader-outline"
            title="Terms of service"
            onPress={() => void Linking.openURL(`${SITE_URL}/terms`)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="people-outline"
            title="Community guidelines"
            onPress={() => void Linking.openURL(`${SITE_URL}/community-guidelines`)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="mail-outline"
            title="Contact support"
            onPress={() => void Linking.openURL('mailto:contactus@joinbridgeapp.com')}
          />
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function SettingsRow({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={20} color={palette.scarlet} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={palette.slate} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199, 59, 34, 0.10)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.xs,
  },
});
