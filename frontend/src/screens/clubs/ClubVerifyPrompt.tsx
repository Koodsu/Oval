import React, { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { Banner, Button, Field, Sheet } from '../../components/ui';
import {
  createClubInvite,
  getApiErrorMessage,
  markClubVerificationSent,
  startClubVerification,
} from '../../api';
import type { ClubClaim } from '../../types';
import { spacing, useTheme } from '../../theme';
import { getUiPreviewMode } from '../../dev/previewMode';

import { toast } from '../../lib/toast';
const MEMBER_THRESHOLD = 5;

type Props = {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
  memberCount: number;
};

export default function ClubVerifyPrompt({ visible, onClose, clubId, clubName, memberCount }: Props) {
  const { colors, typography } = useTheme();
  const [previewMode] = useState(getUiPreviewMode);
  const isVerificationPreview = __DEV__ && previewMode === 'club-verify';
  const [handle, setHandle] = useState(isVerificationPreview ? '@photographyclub' : '');
  const [claim, setClaim] = useState<ClubClaim | null>(() => isVerificationPreview ? {
    id: 'preview-club-claim',
    method: 'INSTAGRAM',
    handleOrEmail: 'photographyclub',
    challengeCode: 'OVAL-4821',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    instructions: 'DM this code to @oval from the official club account.',
  } : null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [sentBusy, setSentBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  const remaining = Math.max(0, MEMBER_THRESHOLD - memberCount);
  const proofSent = claim?.status === 'PROOF_SENT';

  const startVerify = async () => {
    if (!handle.trim()) {
      toast.error('Add your Instagram', 'Enter the club’s Instagram handle first.');
      return;
    }
    setVerifyBusy(true);
    try {
      setClaim(await startClubVerification(clubId, { method: 'INSTAGRAM', handle: handle.trim() }));
    } catch (e) {
      toast.error('Could not start verification', getApiErrorMessage(e));
    } finally {
      setVerifyBusy(false);
    }
  };

  const markSent = async () => {
    if (!claim) return;
    setSentBusy(true);
    try {
      const result = await markClubVerificationSent(clubId, claim.id);
      setClaim({ ...claim, status: result.status });
    } catch (e) {
      toast.error('Something went wrong', getApiErrorMessage(e));
    } finally {
      setSentBusy(false);
    }
  };

  const shareInvite = async () => {
    setInviteBusy(true);
    try {
      const invite = await createClubInvite(clubId);
      await Share.share({
        message: `Join ${clubName} on Oval! Open the app and enter invite code: ${invite.code}`,
      });
    } catch (e) {
      toast.error('Could not create invite', getApiErrorMessage(e));
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Make your club discoverable" kicker="GO PUBLIC" scrollable>
      <Banner
        kind="info"
        message={
          remaining > 0
            ? `Your club is private. It appears in Explore once it reaches ${MEMBER_THRESHOLD} members (${remaining} to go) — or verify with Instagram to go public right away.`
            : 'Your club has enough members to be discoverable. Verify with Instagram to also earn the checkmark.'
        }
      />

      <View style={{ marginTop: spacing.md }}>
        <Text style={typography.title}>Verify with Instagram</Text>
        <Text style={[typography.caption, { marginTop: 4, color: colors.sub }]}>
          Prove you run the club’s official Instagram to get the checkmark and become discoverable
          immediately.
        </Text>

        {!claim ? (
          <>
            <Field
              label="Club Instagram handle"
              value={handle}
              onChangeText={setHandle}
              placeholder="@yourclub"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ marginTop: spacing.md }}
            />
            <Button
              label="Start verification"
              icon="logo-instagram"
              onPress={() => void startVerify()}
              loading={verifyBusy}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : proofSent ? (
          <Banner
            kind="success"
            message="Thanks! We’ll review your DM and add your checkmark once we confirm it."
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.sub }]}>
              DM this exact code to <Text style={{ fontWeight: '700' }}>@oval</Text> from{' '}
              <Text style={{ fontWeight: '700' }}>@{claim.handleOrEmail}</Text>:
            </Text>
            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: 12,
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.title, { letterSpacing: 2 }]}>{claim.challengeCode}</Text>
            </View>
            <Button label="I’ve sent the DM" icon="checkmark" onPress={() => void markSent()} loading={sentBusy} />
          </View>
        )}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={typography.title}>Invite members</Text>
        <Text style={[typography.caption, { marginTop: 4, color: colors.sub }]}>
          Share an invite code with people you know to reach {MEMBER_THRESHOLD} members.
        </Text>
        <Button
          label="Create & share invite"
          variant="secondary"
          icon="share-outline"
          onPress={() => void shareInvite()}
          loading={inviteBusy}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </Sheet>
  );
}
