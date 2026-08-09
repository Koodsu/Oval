import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSharedStateVersion } from '../../context/SharedStateInvalidationContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  DateTimeField,
  Field,
  ScreenHeader,
  Segmented,
  Sheet,
  SkeletonCard,
} from '../../components/ui';
import {
  createApplicationCycle,
  getClubShareUrl,
  getApiErrorMessage,
  getApplicationCycles,
  getCycleApplications,
  updateApplication,
  updateApplicationCycle,
} from '../../api';
import { ClubEmptyState } from '../../components/clubs';
import type { ApplicationStage, ClubApplicationCycle, ClubApplicationRow } from '../../types';
import { spacing, useTheme } from '../../theme';
import { getUiPreviewMode } from '../../dev/previewMode';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubApplications'>;

const STAGE_TINT: Record<ApplicationStage, string> = {
  APPLIED: 'sub',
  INTERVIEW: 'amber',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'faint',
};

function previewApplicationData(mode?: string): {
  cycle: ClubApplicationCycle | null;
  applications: ClubApplicationRow[];
} | null {
  if (!mode?.startsWith('club-applications')) return null;
  if (mode === 'club-applications-create') return { cycle: null, applications: [] };
  const cycle: ClubApplicationCycle = {
    id: 'preview-cycle-fall',
    title: 'Fall 2026 Creative Team',
    questions: [
      'What do you love photographing?',
      'What would you like to learn with the club?',
      'Tell us about a photo you are proud of.',
    ],
    status: 'OPEN',
    opensAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    closesAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    applicationCount: mode === 'club-applications-empty' ? 0 : 3,
  };
  const applications: ClubApplicationRow[] =
    mode === 'club-applications-empty'
      ? []
      : [
          {
            id: 'preview-application-jordan',
            stage: 'APPLIED',
            reviewNote: null,
            createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            answers: [
              'Street portraits and the small moments people usually miss.',
              'I want to become more confident directing portraits.',
              'A rainy-night portrait where the reflections became part of the story.',
            ],
            user: {
              id: 'preview-applicant-jordan',
              name: 'Jordan Kim',
              avatarUrl: null,
              major: 'Visual Communication Design',
              classYear: 'Sophomore',
            },
          },
          {
            id: 'preview-application-sam',
            stage: 'APPLIED',
            reviewNote: null,
            createdAt: new Date(Date.now() - 86_400_000).toISOString(),
            answers: ['Campus life', 'Editing', 'A family portrait'],
            user: {
              id: 'preview-applicant-sam',
              name: 'Sam Rivera',
              avatarUrl: null,
              major: 'Journalism',
              classYear: 'Junior',
            },
          },
          {
            id: 'preview-application-morgan',
            stage: 'INTERVIEW',
            reviewNote: 'Strong portfolio; ask about weekly availability.',
            createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            answers: ['Live music', 'Lighting', 'A concert photo'],
            user: {
              id: 'preview-applicant-morgan',
              name: 'Morgan Lee',
              avatarUrl: null,
              major: 'Marketing',
              classYear: 'Senior',
            },
          },
        ];
  return { cycle, applications };
}

export default function ClubApplicationsScreen({ navigation, route }: Props) {
  const sharedStateVersion = useSharedStateVersion('clubs');
  const { clubId } = route.params;
  const { colors, typography } = useTheme();
  const [previewMode] = useState(getUiPreviewMode);

  const [loading, setLoading] = useState(true);
  const [openCycle, setOpenCycle] = useState<ClubApplicationCycle | null>(null);
  const [applications, setApplications] = useState<ClubApplicationRow[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);

  // create form
  const [title, setTitle] = useState('');
  const [newQuestions, setNewQuestions] = useState<string[]>(['']);
  const [closesAt, setClosesAt] = useState(
    () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  );
  const [busy, setBusy] = useState(false);
  const [stageFilter, setStageFilter] = useState<'NEW' | 'REVIEWING' | 'DECIDED'>('NEW');

  // applicant detail sheet
  const [selected, setSelected] = useState<ClubApplicationRow | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [stageBusy, setStageBusy] = useState(false);
  const visibleApplications = applications.filter((application) => {
    if (stageFilter === 'NEW') return application.stage === 'APPLIED';
    if (stageFilter === 'REVIEWING') return application.stage === 'INTERVIEW';
    return ['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(application.stage);
  });

  useEffect(() => {
    if (previewMode !== 'club-applications-create') return;
    setTitle('Fall 2026 Applications');
    setNewQuestions([
      'What kind of photography are you most excited to explore with us?',
      'What do you hope to contribute to the Photography Club?',
      'How did you hear about the Photography Club?',
    ]);
    const previewClose = new Date();
    previewClose.setDate(previewClose.getDate() + 30);
    previewClose.setHours(23, 59, 0, 0);
    setClosesAt(previewClose);
  }, [previewMode]);

  const load = useCallback(async () => {
    const preview = previewApplicationData(previewMode);
    if (preview) {
      setOpenCycle(preview.cycle);
      setApplications(preview.applications);
      setQuestions(preview.cycle?.questions ?? []);
      setLoading(false);
      return;
    }
    try {
      const cycles = await getApplicationCycles(clubId);
      const open = cycles.find((c) => c.status === 'OPEN') ?? null;
      setOpenCycle(open);
      if (open) {
        const detail = await getCycleApplications(clubId, open.id);
        setApplications(detail.applications);
        setQuestions(detail.cycle.questions);
      } else {
        setApplications([]);
        setQuestions([]);
      }
    } catch {
      // leave empty; banner not critical
    } finally {
      setLoading(false);
    }
  }, [clubId, previewMode]);

  useEffect(() => {
    if (previewMode !== 'club-applications-review' || !applications.length) return;
    const timer = setTimeout(() => openApplicant(applications[0]), 250);
    return () => clearTimeout(timer);
  }, [applications, previewMode]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (!active) return;
      });
      return () => {
        active = false;
      };
    }, [load, sharedStateVersion])
  );

  const openCycleSubmit = async () => {
    const qs = newQuestions.map((q) => q.trim()).filter((q) => q.length);
    if (!title.trim()) {
      toast.error('Add a title', 'Give this application cycle a name (e.g. Fall 2026).');
      return;
    }
    if (!qs.length) {
      toast.error('Add a question', 'Add at least one application question.');
      return;
    }
    setBusy(true);
    try {
      await createApplicationCycle(clubId, {
        title: title.trim(),
        questions: qs,
        closesAt: closesAt.toISOString(),
      });
      setTitle('');
      setNewQuestions(['']);
      await load();
    } catch (e) {
      toast.error('Could not open applications', getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const closeCycle = async () => {
    if (!openCycle) return;
    setBusy(true);
    try {
      await updateApplicationCycle(clubId, openCycle.id, { status: 'CLOSED' });
      await load();
    } catch (e) {
      toast.error('Could not close applications', getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (stage: ApplicationStage) => {
    if (!selected) return;
    setStageBusy(true);
    try {
      await updateApplication(clubId, selected.id, {
        stage,
        reviewNote: reviewNote.trim(),
      });
      setSelected(null);
      setReviewNote('');
      await load();
    } catch (e) {
      toast.error('Could not update', getApiErrorMessage(e));
    } finally {
      setStageBusy(false);
    }
  };

  const openApplicant = (application: ClubApplicationRow) => {
    setSelected(application);
    setReviewNote(application.reviewNote ?? '');
  };

  return (
    <AppBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Applications" kicker="OFFICER DESK" onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <SkeletonCard />
          ) : openCycle ? (
            <>
              <Card padded>
                <Text style={typography.title}>{openCycle.title}</Text>
                <Text style={[typography.caption, { marginTop: 4, color: colors.success }]}>
                  OPEN · {applications.length} applicant{applications.length === 1 ? '' : 's'}
                </Text>
                {openCycle.closesAt ? (
                  <Text style={[typography.captionSmall, { marginTop: 3 }]}>
                    Closes {new Date(openCycle.closesAt).toLocaleDateString([], {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                ) : null}
                <Button
                  label="Close applications"
                  variant="secondary"
                  icon="lock-closed-outline"
                  onPress={() => void closeCycle()}
                  loading={busy}
                  style={{ marginTop: spacing.md }}
                />
              </Card>

              {applications.length ? (
                <>
                  <Segmented
                    value={stageFilter}
                    onChange={setStageFilter}
                    options={[
                      { value: 'NEW', label: 'New' },
                      { value: 'REVIEWING', label: 'Reviewing' },
                      { value: 'DECIDED', label: 'Decided' },
                    ]}
                  />
                  <Card>
                  {visibleApplications.map((app, i) => (
                    <Pressable
                      key={app.id}
                      onPress={() => openApplicant(app)}
                      accessibilityRole="button"
                      accessibilityLabel={`Review ${app.user.name}'s application, ${app.stage.toLowerCase()}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.borderSoft,
                      }}
                    >
                      <Avatar name={app.user.name} uri={app.user.avatarUrl} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={typography.subheading} numberOfLines={1}>
                          {app.user.name}
                        </Text>
                        {app.user.major ? (
                          <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
                            {app.user.major}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          typography.captionSmall,
                          { color: colors[STAGE_TINT[app.stage] as keyof typeof colors] ?? colors.sub },
                        ]}
                      >
                        {app.stage}
                      </Text>
                    </Pressable>
                  ))}
                  {!visibleApplications.length ? (
                    <Text style={[typography.caption, { padding: spacing.md }]}>
                      No applications in this stage.
                    </Text>
                  ) : null}
                  </Card>
                  {visibleApplications.length ? (
                    <Button
                      label="Review next"
                      icon="arrow-forward"
                      onPress={() => openApplicant(visibleApplications[0])}
                    />
                  ) : null}
                </>
              ) : (
                <ClubEmptyState
                  variant="applications"
                  title="No applications yet"
                  body="Share your club page so interested students can apply."
                  actionLabel="Share club"
                  onAction={() =>
                    void Share.share({
                      message: `Apply to join our club on Oval\n${getClubShareUrl(clubId)}`,
                    })
                  }
                />
              )}
            </>
          ) : (
            <>
              <Banner
                kind="info"
                message="Open an application cycle to gate membership behind a short form and review."
              />
              <Card padded>
                <Text style={typography.title}>New application cycle</Text>
                <Field
                  label="Title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Fall 2026 Applications"
                  style={{ marginTop: spacing.md }}
                />
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.kicker, { marginBottom: spacing.sm }]}>
                    CLOSES
                  </Text>
                  <DateTimeField
                    value={closesAt}
                    minimumDate={new Date()}
                    onChange={setClosesAt}
                  />
                </View>
                <Text style={[typography.kicker, { marginTop: spacing.md, marginBottom: 6 }]}>
                  Questions
                </Text>
                {newQuestions.map((q, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        value={q}
                        onChangeText={(v) =>
                          setNewQuestions((prev) => {
                            const next = [...prev];
                            next[index] = v;
                            return next;
                          })
                        }
                        placeholder={`Question ${index + 1}`}
                      />
                    </View>
                    {newQuestions.length > 1 ? (
                      <Pressable
                        onPress={() =>
                          setNewQuestions((prev) => prev.filter((_, i) => i !== index))
                        }
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove question ${index + 1}`}
                      >
                        <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <Button
                  label="Add question"
                  variant="ghost"
                  icon="add"
                  onPress={() => setNewQuestions((prev) => [...prev, ''])}
                  style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                />
                <Button
                  label="Open applications"
                  icon="document-text-outline"
                  onPress={() => void openCycleSubmit()}
                  loading={busy}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Sheet
        visible={selected != null}
        onClose={() => {
          setSelected(null);
          setReviewNote('');
        }}
        title={selected?.user.name}
        kicker="APPLICANT"
        scrollable
      >
        {selected ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Avatar name={selected.user.name} uri={selected.user.avatarUrl} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={typography.subheading}>{selected.user.name}</Text>
              <Text style={typography.captionSmall}>
                {[selected.user.major, selected.user.classYear].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        ) : null}
        {selected
          ? questions.map((question, index) => (
              <View key={index} style={{ marginBottom: spacing.md }}>
                <Text style={[typography.kicker, { marginBottom: 2 }]}>{question}</Text>
                <Text style={typography.body}>{selected.answers[index] ?? '—'}</Text>
              </View>
            ))
          : null}
        {selected ? (
          <Field
            label="Private review note"
            value={reviewNote}
            onChangeText={setReviewNote}
            placeholder="Add context for the officer team"
            multiline
            maxLength={500}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Interview"
              variant="secondary"
              onPress={() => void setStage('INTERVIEW')}
              loading={stageBusy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Accept" onPress={() => void setStage('ACCEPTED')} loading={stageBusy} />
          </View>
        </View>
        <Button
          label="Reject"
          variant="danger"
          onPress={() => void setStage('REJECTED')}
          loading={stageBusy}
          style={{ marginTop: 8 }}
        />
        <Text
          style={[
            typography.captionSmall,
            { textAlign: 'center', marginTop: spacing.md, color: colors.sub },
          ]}
        >
          Only club officers can see these answers.
        </Text>
      </Sheet>
    </AppBackdrop>
  );
}
