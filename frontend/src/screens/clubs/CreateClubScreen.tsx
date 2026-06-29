import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../App';
import { AppBackdrop, Button, Card, Chip, Field, ScreenHeader } from '../../components/ui';
import { createClub, getApiErrorMessage } from '../../api';
import { CLUB_CATEGORIES } from '../../constants/clubCategories';
import { clubCategoryVisual } from '../../constants/clubVisuals';
import { spacing, useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateClub'>;

const GUIDELINES = [
  'Only create a club you actually run — impersonating a real club is not allowed and can get you banned.',
  'Keep it appropriate: no harassment, hate, or unsafe content. You are responsible for what your officers and members post.',
  'New clubs start private. Invite members or verify with Instagram to become discoverable.',
  'The verified checkmark means we confirmed you control the club’s official Instagram.',
];

export default function CreateClubScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const [step, setStep] = useState<'guidelines' | 'form'>('guidelines');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [emoji, setEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => setErrors((prev) => ({ ...prev, [key]: '' }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter a club name.';
    if (!description.trim()) next.description = 'Add a short description.';
    if (!category) next.category = 'Pick a category.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const club = await createClub({
        name: name.trim(),
        description: description.trim(),
        category,
        emoji: emoji.trim(),
      });
      navigation.replace('ClubDetail', { clubId: club.id, justCreated: true });
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not create club', getApiErrorMessage(e));
    }
  };

  return (
    <AppBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader
          title="Create a club"
          kicker={step === 'guidelines' ? 'GUIDELINES' : 'NEW CLUB'}
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'guidelines' ? (
            <>
              <Card padded>
                <Text style={typography.title}>Before you start</Text>
                <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                  {GUIDELINES.map((g) => (
                    <View key={g} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={[typography.body, { color: colors.primary }]}>•</Text>
                      <Text style={[typography.body, { flex: 1, color: colors.sub }]}>{g}</Text>
                    </View>
                  ))}
                </View>
              </Card>
              <Button label="I agree — continue" icon="checkmark" onPress={() => setStep('form')} />
            </>
          ) : (
            <>
              <Field
                label="Club name"
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  clearError('name');
                }}
                error={errors.name}
                placeholder="OSU Investing Club"
              />
              <Field
                label="Description"
                value={description}
                onChangeText={(v) => {
                  setDescription(v);
                  clearError('description');
                }}
                error={errors.description}
                placeholder="What is your club about?"
                multiline
              />
              <View>
                <Text style={[typography.kicker, { marginBottom: 6 }]}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CLUB_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      icon={clubCategoryVisual(c).icon}
                      selected={category === c}
                      onPress={() => {
                        setCategory(c);
                        clearError('category');
                      }}
                    />
                  ))}
                </View>
                {errors.category ? (
                  <Text style={[typography.caption, { color: colors.danger, marginTop: 4 }]}>
                    {errors.category}
                  </Text>
                ) : null}
              </View>
              <Field
                label="Emoji (optional)"
                value={emoji}
                onChangeText={setEmoji}
                placeholder="🎓"
                hint="Leave blank to show your club's initials instead."
                style={{ maxWidth: 200 }}
              />
              <Button label="Create club" icon="add" onPress={() => void submit()} loading={busy} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </AppBackdrop>
  );
}
