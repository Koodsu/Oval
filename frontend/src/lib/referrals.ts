import AsyncStorage from '@react-native-async-storage/async-storage';

export const REFERRAL_STORAGE_KEY = 'initialReferralUserId';

function referralFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const ref = parsed.searchParams.get('ref')?.trim();
    return ref && ref.length <= 128 ? ref : null;
  } catch {
    return null;
  }
}

export async function captureReferralFromUrl(url: string | null | undefined): Promise<void> {
  const ref = referralFromUrl(url);
  if (!ref) return;
  const existing = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!existing) {
    await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, ref);
  }
}

export async function getStoredReferral(): Promise<string | null> {
  return AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
}
