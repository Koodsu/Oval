import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../App';
import { AppBackdrop, Banner, Button, Card, Field, ScreenHeader, SkeletonCard } from '../../components/ui';
import { getApplyInfo, getApiErrorMessage, submitApplication } from '../../api';
import type { ApplyInfo } from '../../types';
import { spacing, useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubApply'>;

const STAGE_LABELS: Record<string, string> = {
  APPLIED: 'Submitted — under review',
  INTERVIEW: 'Moved to interview',
  ACCEPTED: 'Accepted 🎉',
  REJECTED: 'Not accepted this round',
  WITHDRAWN: 'Withdrawn',
};

export default function ClubApplyScreen({ navigation, route }: Props) {
  const { clubId } = route.params;
  const { colors, typography } = useTheme();
  const [info, setInfo] = useState<ApplyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [submittedStage, setSubmittedStage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getApplyInfo(clubId)
      .then((result) => {
        if (!active) return;
        setInfo(result);
        setAnswers(new Array(result.openCycle?.questions.length ?? 0).fill(''));
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clubId]);

  const submit = async () => {
    if (!info?.openCycle) return;
    if (answers.some((a) => !a.trim())) {
      Alert.alert('Answer every question', 'Please fill in all fields before submitting.');
      return;
    }
    setBusy(true);
    try {
      const result = await submitApplication(clubId, info.openCycle.id, answers.map((a) => a.trim()));
      setSubmittedStage(result.stage);
    } catch (e) {
      Alert.alert('Could not submit application', getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const existingStage = submittedStage ?? info?.myApplication?.stage ?? null;

  return (
    <AppBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Apply to join" kicker="APPLICATION" onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <SkeletonCard />
          ) : info?.isMember ? (
            <Banner kind="success" message="You’re already a member of this club." />
          ) : existingStage ? (
            <Card padded>
              <Text style={typography.title}>Application status</Text>
              <Text style={[typography.body, { marginTop: 6, color: colors.sub }]}>
                {STAGE_LABELS[existingStage] ?? existingStage}
              </Text>
            </Card>
          ) : !info?.openCycle ? (
            <Banner kind="info" message="This club isn’t accepting applications right now." />
          ) : (
            <>
              <Card padded>
                <Text style={typography.title}>{info.openCycle.title}</Text>
                <Text style={[typography.caption, { marginTop: 4, color: colors.sub }]}>
                  Answer the questions below to apply. Officers will review and get back to you.
                </Text>
              </Card>
              {info.openCycle.questions.map((question, index) => (
                <Field
                  key={`${index}-${question}`}
                  label={question}
                  value={answers[index] ?? ''}
                  onChangeText={(v) =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[index] = v;
                      return next;
                    })
                  }
                  placeholder="Your answer"
                  multiline
                />
              ))}
              <Button label="Submit application" icon="send" onPress={() => void submit()} loading={busy} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </AppBackdrop>
  );
}
