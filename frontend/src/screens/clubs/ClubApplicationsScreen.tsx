import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Banner,
  Button,
  Card,
  Field,
  ScreenHeader,
  Sheet,
  SkeletonCard,
} from '../../components/ui';
import {
  createApplicationCycle,
  getApiErrorMessage,
  getApplicationCycles,
  getCycleApplications,
  updateApplication,
  updateApplicationCycle,
} from '../../api';
import type { ApplicationStage, ClubApplicationCycle, ClubApplicationRow } from '../../types';
import { spacing, useTheme } from '../../theme';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubApplications'>;

const STAGE_TINT: Record<ApplicationStage, string> = {
  APPLIED: 'sub',
  INTERVIEW: 'amber',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'faint',
};

export default function ClubApplicationsScreen({ navigation, route }: Props) {
  const { clubId } = route.params;
  const { colors, typography } = useTheme();

  const [loading, setLoading] = useState(true);
  const [openCycle, setOpenCycle] = useState<ClubApplicationCycle | null>(null);
  const [applications, setApplications] = useState<ClubApplicationRow[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);

  // create form
  const [title, setTitle] = useState('');
  const [newQuestions, setNewQuestions] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);

  // applicant detail sheet
  const [selected, setSelected] = useState<ClubApplicationRow | null>(null);
  const [stageBusy, setStageBusy] = useState(false);

  const load = useCallback(async () => {
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
  }, [clubId]);

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
    }, [load])
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
      await createApplicationCycle(clubId, { title: title.trim(), questions: qs });
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
      await updateApplication(clubId, selected.id, { stage });
      setSelected(null);
      await load();
    } catch (e) {
      toast.error('Could not update', getApiErrorMessage(e));
    } finally {
      setStageBusy(false);
    }
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
                <Card>
                  {applications.map((app, i) => (
                    <Pressable
                      key={app.id}
                      onPress={() => setSelected(app)}
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
                </Card>
              ) : (
                <Banner kind="info" message="No applicants yet. Share your club to get applications." />
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
        onClose={() => setSelected(null)}
        title={selected?.user.name}
        kicker="APPLICANT"
        scrollable
      >
        {selected
          ? questions.map((question, index) => (
              <View key={index} style={{ marginBottom: spacing.md }}>
                <Text style={[typography.kicker, { marginBottom: 2 }]}>{question}</Text>
                <Text style={typography.body}>{selected.answers[index] ?? '—'}</Text>
              </View>
            ))
          : null}
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
      </Sheet>
    </AppBackdrop>
  );
}
