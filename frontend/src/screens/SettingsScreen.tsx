import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { AppBackdrop, Card, Chip, ListRow, ScreenHeader } from '../components/ui';
import {
  AppearancePreference,
  Theme,
  createThemedStyles,
  spacing,
  useTheme,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
const SITE_URL = 'https://www.theovalapp.com';

const APPEARANCE_OPTIONS: Array<{ value: AppearancePreference; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'system', label: 'Auto', icon: 'contrast' },
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Settings" kicker="TUNE IT" onBack={() => navigation.goBack()} />

        <Text style={typography.kicker}>APPEARANCE</Text>
        <Card padded>
          <View style={styles.appearanceCopy}>
            <Text style={typography.subheading}>Theme</Text>
            <Text style={typography.captionSmall}>Match your system or pick a side.</Text>
          </View>
          <View style={styles.appearanceRow}>
            {APPEARANCE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={preference === option.value}
                onPress={() => setPreference(option.value)}
              />
            ))}
          </View>
        </Card>

        <Text style={typography.kicker}>ACCOUNT</Text>
        <Card padded={false} faceStyle={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            icon="person"
            title="Profile information"
            sub="Update your photo, bio, school details, interests, and social profile."
            tint={colors.blueSoft}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <ListRow
            icon="shield-checkmark"
            title="Privacy & Data"
            sub="Download your data, control notifications and connected accounts, or delete your account."
            tint={colors.tealSoft}
            last
            onPress={() => navigation.navigate('PrivacyData')}
          />
        </Card>

        <Text style={typography.kicker}>SAFETY & LEGAL</Text>
        <Card padded={false} faceStyle={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            icon="ban"
            title="Blocked users"
            tint={colors.dangerSoft}
            onPress={() => navigation.navigate('BlockedUsers')}
          />
          <ListRow
            icon="document-text"
            title="Privacy policy"
            tint={colors.amberSoft}
            onPress={() => void Linking.openURL(`${SITE_URL}/privacy`)}
          />
          <ListRow
            icon="reader"
            title="Terms of service"
            tint={colors.violetSoft}
            onPress={() => void Linking.openURL(`${SITE_URL}/terms`)}
          />
          <ListRow
            icon="people"
            title="Community guidelines"
            tint={colors.greenSoft}
            onPress={() => void Linking.openURL(`${SITE_URL}/community-guidelines`)}
          />
          <ListRow
            icon="mail"
            title="Contact support"
            tint={colors.pinkSoft}
            last
            onPress={() => void Linking.openURL('mailto:contactus@theovalapp.com')}
          />
        </Card>
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  appearanceCopy: {
    marginBottom: spacing.md,
  },
  appearanceRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
}));
