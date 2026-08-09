import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Button,
  Card,
  ContentImage,
  Field,
  ScreenHeader,
  SkeletonCard,
  Sticker,
} from '../../components/ui';
import { ClubEmptyState, ClubPhoto } from '../../components/clubs';
import {
  getApplyInfo,
  getApiErrorMessage,
  resolveAvatarUrl,
  submitApplication,
  withdrawClubApplication,
} from '../../api';
import type { ApplyInfo } from '../../types';
import { spacing, useTheme } from '../../theme';
import { clubIdentityImageFor } from '../../constants/contentImages';
import { getUiPreviewMode } from '../../dev/previewMode';
import { useSharedStateVersion } from '../../context/SharedStateInvalidationContext';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubApply'>;

const STAGE_LABELS: Record<string, string> = {
  APPLIED: 'Submitted — under review',
  INTERVIEW: 'Moved to interview',
  ACCEPTED: 'Accepted 🎉',
  REJECTED: 'Not accepted this round',
  WITHDRAWN: 'Withdrawn',
};

function previewApplyInfo(mode?: string): ApplyInfo | null {
  if (!mode?.startsWith('club-apply')) return null;
  const cycle = {
    id: 'preview-cycle-fall',
    title: 'Fall 2026 Creative Team',
    questions: [
      'What do you love photographing?',
      'What would you like to learn with the club?',
      'Tell us about a photo you are proud of.',
    ],
    status: 'OPEN' as const,
    opensAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    closesAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    applicationCount: 12,
  };
  const club = {
    id: 'preview-photography',
    name: 'Photography Club',
    category: 'Arts & Creative',
    emoji: '📷',
    avatarUrl: null,
    coverUrl: null,
    memberCount: 86,
  };
  if (mode === 'club-apply-closed') {
    return { joinPolicy: 'APPLICATION', isMember: false, club, openCycle: null, myApplication: null };
  }
  if (mode === 'club-apply-status') {
    return {
      joinPolicy: 'APPLICATION',
      isMember: false,
      club,
      openCycle: cycle,
      myApplication: {
        id: 'preview-application',
        stage: 'APPLIED',
        createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        answerCount: cycle.questions.length,
        cycle,
      },
    };
  }
  return { joinPolicy: 'APPLICATION', isMember: false, club, openCycle: cycle, myApplication: null };
}

export default function ClubApplyScreen({ navigation, route }: Props) {
  const sharedStateVersion = useSharedStateVersion('clubs');
  const { clubId } = route.params;
  const { colors, typography } = useTheme();
  const [previewMode] = useState(getUiPreviewMode);
  const [info, setInfo] = useState<ApplyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [submittedStage, setSubmittedStage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const preview = previewApplyInfo(previewMode);
    if (preview) {
      setInfo(preview);
      setAnswers(new Array(preview.openCycle?.questions.length ?? 0).fill(''));
      setLoading(false);
      return () => {
        active = false;
      };
    }
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
  }, [clubId, previewMode, sharedStateVersion]);

  const submit = async () => {
    if (!info?.openCycle) return;
    if (answers.some((a) => !a.trim())) {
      toast.error('Answer every question', 'Please fill in all fields before submitting.');
      return;
    }
    setBusy(true);
    try {
      const result = await submitApplication(clubId, info.openCycle.id, answers.map((a) => a.trim()));
      setSubmittedStage(result.stage);
      setInfo(await getApplyInfo(clubId));
    } catch (e) {
      toast.error('Could not submit application', getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const existingStage = submittedStage ?? info?.myApplication?.stage ?? null;
  const withdraw = async () => {
    if (!info?.myApplication) return;
    setBusy(true);
    try {
      await withdrawClubApplication(clubId, info.myApplication.id);
      setSubmittedStage('WITHDRAWN');
      setInfo(await getApplyInfo(clubId));
    } catch (error) {
      toast.error('Could not withdraw application', getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

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
            <ClubEmptyState
              variant="applications"
              title="You’re already a member"
              body="You already have access to this club and its member spaces."
              actionLabel="Back to club"
              onAction={() => navigation.navigate('ClubDetail', { clubId })}
            />
          ) : existingStage ? (
            <>
              {info?.club ? (
                <ContentImage
                  source={info.club.coverUrl
                    ? { uri: resolveAvatarUrl(info.club.coverUrl) ?? info.club.coverUrl }
                    : clubIdentityImageFor(info.club)}
                  seed={`${info.club.name}-application-status`}
                  aspectRatio={16 / 9}
                  accessibilityLabel={`${info.club.name} club cover`}
                  style={{ borderRadius: 20 }}
                />
              ) : null}
              <Card padded>
                <Sticker
                  label={existingStage === 'APPLIED' ? 'UNDER REVIEW' : existingStage}
                  tint={existingStage === 'ACCEPTED' ? colors.successSoft : colors.warningSoft}
                  textColor={existingStage === 'ACCEPTED' ? colors.success : colors.warning}
                  small
                />
                <Text style={[typography.title, { marginTop: spacing.sm }]}>Application received</Text>
                <Text style={[typography.body, { marginTop: 6, color: colors.sub }]}>
                  {info?.club?.name ? `${info.club.name} officers are reviewing your answers. ` : ''}
                  {STAGE_LABELS[existingStage] ?? existingStage}
                </Text>
                {info?.myApplication ? (
                  <View
                    style={{
                      marginTop: spacing.md,
                      gap: spacing.sm,
                      paddingTop: spacing.md,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={typography.subheading}>{info.myApplication.cycle.title}</Text>
                    {info.myApplication.cycle.closesAt ? (
                      <Text style={typography.captionSmall}>
                        Due {new Date(info.myApplication.cycle.closesAt).toLocaleString([], {
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                    <Text style={typography.captionSmall}>
                      Submitted {new Date(info.myApplication.createdAt).toLocaleString([], {
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={typography.captionSmall}>
                      Answers {info.myApplication.answerCount} of {info.myApplication.cycle.questions.length}
                    </Text>
                  </View>
                ) : null}
              </Card>
              {info?.myApplication && ['APPLIED', 'INTERVIEW'].includes(existingStage) ? (
                <Button
                  label="Withdraw application"
                  variant="secondary"
                  loading={busy}
                  onPress={() => void withdraw()}
                />
              ) : null}
            </>
          ) : !info?.openCycle ? (
            <ClubEmptyState
              variant="applications"
              title="Applications are closed"
              body="This club isn’t accepting applications right now."
              actionLabel="Explore the club"
              onAction={() => navigation.navigate('ClubDetail', { clubId })}
            />
          ) : (
            <>
              {info.club ? (
                <Card padded>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <ClubPhoto
                      name={info.club.name}
                      category={info.club.category}
                      uri={info.club.avatarUrl}
                      size={54}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={typography.title}>{info.club.name}</Text>
                      <Text style={typography.caption}>
                        {info.club.category} · {info.club.memberCount} member
                        {info.club.memberCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}
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
