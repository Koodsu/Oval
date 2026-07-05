import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '../types';
import {
  POD_TEMPLATES,
  PodTemplate,
  anchorWindowLabel,
  nextAnchorWindow,
  resolveTemplateActivity,
  templatesForActivity,
} from '../constants/podTemplates';
import { BORDER_W, fonts, radii, spacing, useTheme } from '../theme';
import { Sheet } from './ui';

type TemplateChoice = {
  template: PodTemplate;
  activity: Activity;
};

export default function PodTemplatePicker({
  visible,
  title = 'Start a pod',
  activities,
  activity,
  busyTemplateId,
  onClose,
  onTemplate,
  onCustom,
}: {
  visible: boolean;
  title?: string;
  activities: Activity[];
  activity?: Activity;
  busyTemplateId?: string | null;
  onClose: () => void;
  onTemplate: (choice: TemplateChoice) => void;
  onCustom: (activity?: Activity) => void;
}) {
  const { colors, typography } = useTheme();
  const choices = React.useMemo<TemplateChoice[]>(() => {
    const source = activity ? templatesForActivity(activity) : POD_TEMPLATES;
    return source
      .map((template) => ({
        template,
        activity: activity ?? resolveTemplateActivity(template, activities),
      }))
      .filter((choice): choice is TemplateChoice => Boolean(choice.activity));
  }, [activities, activity]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title} kicker="Templates" scrollable>
      <View style={styles.wrap}>
        {choices.length ? (
          choices.map(({ template, activity: resolvedActivity }) => {
            const anchor = nextAnchorWindow(template.anchor);
            const busy = busyTemplateId === template.id;
            return (
              <Pressable
                key={template.id}
                onPress={() => onTemplate({ template, activity: resolvedActivity })}
                disabled={Boolean(busyTemplateId)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${template.label}`}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    opacity: busyTemplateId && !busy ? 0.45 : pressed ? 0.72 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconWell,
                    { backgroundColor: colors.primarySoft, borderColor: colors.border },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.accentText} />
                  ) : (
                    <Ionicons name="flash" size={18} color={colors.accentText} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.subheading, { color: colors.ink }]} numberOfLines={1}>
                    {template.label}
                  </Text>
                  <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
                    {anchorWindowLabel(anchor)} at {anchor.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {template.location}
                  </Text>
                </View>
                <Text style={[styles.activity, { color: colors.sub }]} numberOfLines={1}>
                  {resolvedActivity.title}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Text style={[typography.caption, { color: colors.sub }]}>
            No quick templates match this activity yet.
          </Text>
        )}

        <Pressable
          onPress={() => onCustom(activity)}
          disabled={Boolean(busyTemplateId)}
          accessibilityRole="button"
          accessibilityLabel={activity ? 'Create a custom pod' : 'Choose an activity for a custom pod'}
          style={({ pressed }) => [
            styles.customRow,
            { borderColor: colors.border, opacity: busyTemplateId ? 0.45 : pressed ? 0.72 : 1 },
          ]}
        >
          <Ionicons name="create-outline" size={18} color={colors.sub} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.subheading, { color: colors.ink }]}>
              Custom
            </Text>
            <Text style={[typography.captionSmall, { color: colors.sub }]}>
              {activity ? 'Pick your own spot and time' : 'Choose an activity first'}
            </Text>
          </View>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activity: {
    maxWidth: 92,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
  customRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
