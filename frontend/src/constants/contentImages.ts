import type { ImageSourcePropType } from 'react-native';
import type { Activity } from '../types';

/**
 * Production overrides can be keyed by stable backend IDs. Keep this separate
 * from the canonical catalog mapping below so a renamed activity does not
 * silently acquire unrelated artwork.
 */
const ACTIVITY_IMAGES_BY_ID: Record<string, ImageSourcePropType> = {};

/**
 * Explicit mappings for curated catalog activities. These are exact catalog
 * titles—not fuzzy matching and never user-entered pod copy. Once the backend
 * exposes a stable artwork key, this table can move to that key without
 * changing call sites.
 */
const ACTIVITY_IMAGES_BY_CATALOG_TITLE: Record<string, ImageSourcePropType> = {
  'Basketball Pickup Game': require('../../assets/illustrations/activity/basketball.jpg'),
  'Study Group Sprint': require('../../assets/illustrations/activity/study-session.jpg'),
  'Library Study Sprint': require('../../assets/illustrations/activity/study-session.jpg'),
  'Intramural Soccer': require('../../assets/illustrations/activity/soccer.jpg'),
  'Trivia Night': require('../../assets/illustrations/activity/trivia-night.jpg'),
};

const ACTIVITY_IMAGES_BY_CATEGORY: Record<string, ImageSourcePropType> = {
  'Sports & Fitness': require('../../assets/illustrations/activity/soccer.jpg'),
  'Food & Drink': require('../../assets/illustrations/activity/cafe-hangout.jpg'),
  Academic: require('../../assets/illustrations/activity/study-session.jpg'),
  'Arts & Creative': require('../../assets/illustrations/activity/arts-music.jpg'),
  Social: require('../../assets/illustrations/activity/trivia-night.jpg'),
  Outdoors: require('../../assets/illustrations/activity/outdoors.jpg'),
  'Music & Entertainment': require('../../assets/illustrations/activity/arts-music.jpg'),
  Wellness: require('../../assets/illustrations/activity/outdoors.jpg'),
  Gaming: require('../../assets/illustrations/activity/gaming.jpg'),
  Volunteering: require('../../assets/illustrations/activity/volunteering.jpg'),
};

const DEFAULT_ACTIVITY_IMAGE = require('../../assets/illustrations/activity/campus-hangout.jpg');

/**
 * Curated identity art for clubs whose subject needs more specificity than a
 * broad directory category can provide. Keep these exact and intentional:
 * uploaded cover art still wins at every call site.
 */
const CLUB_IMAGES_BY_NAME: Record<string, ImageSourcePropType> = {
  'photography club': require('../../assets/content/clubs/photography-club-hero.png'),
};

/**
 * Club categories reuse the approved Campus Pulse editorial library until
 * officers upload their own club imagery. These are stable category mappings,
 * never guesses based on user-entered club names.
 */
const CLUB_CATEGORY_IMAGES_BY_KEY: Record<string, ImageSourcePropType> = {
  'Sports & Fitness': require('../../assets/illustrations/activity/soccer.jpg'),
  Sports: require('../../assets/illustrations/activity/soccer.jpg'),
  'Food & Drink': require('../../assets/illustrations/activity/cafe-hangout.jpg'),
  Academic: require('../../assets/illustrations/activity/study-session.jpg'),
  Business: require('../../assets/illustrations/activity/campus-hangout.jpg'),
  STEM: require('../../assets/illustrations/activity/study-session.jpg'),
  'Arts & Creative': require('../../assets/illustrations/activity/arts-music.jpg'),
  Arts: require('../../assets/illustrations/activity/arts-music.jpg'),
  Social: require('../../assets/illustrations/activity/campus-hangout.jpg'),
  Outdoors: require('../../assets/illustrations/activity/outdoors.jpg'),
  'Music & Entertainment': require('../../assets/illustrations/activity/arts-music.jpg'),
  Wellness: require('../../assets/illustrations/activity/outdoors.jpg'),
  Gaming: require('../../assets/illustrations/activity/gaming.jpg'),
  Volunteering: require('../../assets/illustrations/activity/volunteering.jpg'),
  Service: require('../../assets/illustrations/activity/volunteering.jpg'),
  Faith: require('../../assets/illustrations/activity/campus-hangout.jpg'),
  Culture: require('../../assets/illustrations/activity/campus-hangout.jpg'),
  Other: DEFAULT_ACTIVITY_IMAGE,
};

export function activityImageForId(activityId: string): ImageSourcePropType {
  return ACTIVITY_IMAGES_BY_ID[activityId] ?? DEFAULT_ACTIVITY_IMAGE;
}

export function activityImageFor(
  activity?: Pick<Activity, 'id' | 'title' | 'category'> | null,
): ImageSourcePropType {
  if (!activity) return DEFAULT_ACTIVITY_IMAGE;
  return (
    ACTIVITY_IMAGES_BY_ID[activity.id] ??
    ACTIVITY_IMAGES_BY_CATALOG_TITLE[activity.title] ??
    ACTIVITY_IMAGES_BY_CATEGORY[activity.category] ??
    DEFAULT_ACTIVITY_IMAGE
  );
}

export function clubCategoryImageForKey(categoryKey?: string | null): ImageSourcePropType {
  return (categoryKey && CLUB_CATEGORY_IMAGES_BY_KEY[categoryKey]) || DEFAULT_ACTIVITY_IMAGE;
}

export function clubIdentityImageFor(
  club?: { name?: string | null; category?: string | null } | null,
): ImageSourcePropType {
  const normalizedName = club?.name?.trim().toLocaleLowerCase();
  return (
    (normalizedName && CLUB_IMAGES_BY_NAME[normalizedName]) ||
    clubCategoryImageForKey(club?.category)
  );
}
