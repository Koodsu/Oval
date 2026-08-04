import type { ImageSourcePropType } from 'react-native';
import type { Activity } from '../types';

/**
 * Production overrides can be keyed by stable backend IDs. Keep this separate
 * from the canonical catalog mapping below so a renamed activity does not
 * silently acquire unrelated artwork.
 */
const ACTIVITY_IMAGES_BY_ID: Record<string, ImageSourcePropType> = {};

const ACTIVITY_IMAGES_BY_ARTWORK_KEY: Record<string, ImageSourcePropType> = {
  'study-group': require('../../assets/illustrations/activity/catalog/study-group.jpg'),
  'reading-book-club': require('../../assets/illustrations/activity/catalog/reading-book-club.jpg'),
  'pickup-basketball': require('../../assets/illustrations/activity/catalog/pickup-basketball.jpg'),
  'pickup-soccer': require('../../assets/illustrations/activity/catalog/pickup-soccer.jpg'),
  'pickup-volleyball': require('../../assets/illustrations/activity/catalog/pickup-volleyball.jpg'),
  'tennis-pickleball': require('../../assets/illustrations/activity/catalog/tennis-pickleball.jpg'),
  'running-jogging': require('../../assets/illustrations/activity/catalog/running-jogging.jpg'),
  swimming: require('../../assets/illustrations/activity/catalog/swimming.jpg'),
  golf: require('../../assets/illustrations/activity/catalog/golf.jpg'),
  bowling: require('../../assets/illustrations/activity/catalog/bowling.jpg'),
  frisbee: require('../../assets/illustrations/activity/catalog/frisbee.jpg'),
  'gym-partner': require('../../assets/illustrations/activity/catalog/gym-partner.jpg'),
  yoga: require('../../assets/illustrations/activity/catalog/yoga.jpg'),
  meditation: require('../../assets/illustrations/activity/catalog/meditation.jpg'),
  'nature-walk': require('../../assets/illustrations/activity/catalog/nature-walk.jpg'),
  'casual-hangout': require('../../assets/illustrations/activity/catalog/casual-hangout.jpg'),
  'movie-watch-party': require('../../assets/illustrations/activity/catalog/movie-watch-party.jpg'),
  'go-to-event': require('../../assets/illustrations/activity/catalog/go-to-event.jpg'),
  'video-games': require('../../assets/illustrations/activity/catalog/video-games.jpg'),
  'board-games': require('../../assets/illustrations/activity/catalog/board-games.jpg'),
  'card-games': require('../../assets/illustrations/activity/catalog/card-games.jpg'),
  'tabletop-rpgs': require('../../assets/illustrations/activity/catalog/tabletop-rpgs.jpg'),
  'mobile-games': require('../../assets/illustrations/activity/catalog/mobile-games.jpg'),
  trivia: require('../../assets/illustrations/activity/catalog/trivia.jpg'),
  chess: require('../../assets/illustrations/activity/catalog/chess.jpg'),
  'food-bank-volunteering': require('../../assets/illustrations/activity/catalog/food-bank-volunteering.jpg'),
  'animal-shelter-volunteering': require('../../assets/illustrations/activity/catalog/animal-shelter-volunteering.jpg'),
  'medical-center-volunteering': require('../../assets/illustrations/activity/catalog/medical-center-volunteering.jpg'),
  'other-volunteering': require('../../assets/illustrations/activity/catalog/other-volunteering.jpg'),
  'cook-together': require('../../assets/illustrations/activity/catalog/cook-together.jpg'),
  'eat-at-restaurant': require('../../assets/illustrations/activity/catalog/eat-at-restaurant.jpg'),
  'eat-at-dining-hall': require('../../assets/illustrations/activity/catalog/eat-at-dining-hall.jpg'),
  'grab-coffee-tea': require('../../assets/illustrations/activity/catalog/grab-coffee-tea.jpg'),
  'bake-something': require('../../assets/illustrations/activity/catalog/bake-something.jpg'),
  picnic: require('../../assets/illustrations/activity/catalog/picnic.jpg'),
  'draw-paint': require('../../assets/illustrations/activity/catalog/draw-paint.jpg'),
  crafting: require('../../assets/illustrations/activity/catalog/crafting.jpg'),
  'creative-writing': require('../../assets/illustrations/activity/catalog/creative-writing.jpg'),
  'play-practice-music': require('../../assets/illustrations/activity/catalog/play-practice-music.jpg'),
  photography: require('../../assets/illustrations/activity/catalog/photography.jpg'),
  dance: require('../../assets/illustrations/activity/catalog/dance.jpg'),
};

/** Legacy title mappings keep historical pods visually intact. */
const ACTIVITY_IMAGES_BY_CATALOG_TITLE: Record<string, ImageSourcePropType> = {
  'Basketball Pickup Game': require('../../assets/illustrations/activity/basketball.jpg'),
  'Study Group Sprint': require('../../assets/illustrations/activity/study-session.jpg'),
  'Library Study Sprint': require('../../assets/illustrations/activity/study-session.jpg'),
  'Intramural Soccer': require('../../assets/illustrations/activity/soccer.jpg'),
  'Trivia Night': require('../../assets/illustrations/activity/trivia-night.jpg'),
};

const ACTIVITY_IMAGES_BY_CATEGORY: Record<string, ImageSourcePropType> = {
  'Academic / Study': require('../../assets/illustrations/activity/study-session.jpg'),
  Sports: require('../../assets/illustrations/activity/soccer.jpg'),
  'Fitness & Wellness': require('../../assets/illustrations/activity/outdoors.jpg'),
  'Social & Events': require('../../assets/illustrations/activity/campus-hangout.jpg'),
  Food: require('../../assets/illustrations/activity/cafe-hangout.jpg'),
  'Music & Arts': require('../../assets/illustrations/activity/arts-music.jpg'),
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
  activity?: Pick<Activity, 'id' | 'title' | 'category' | 'artworkKey'> | null,
): ImageSourcePropType {
  if (!activity) return DEFAULT_ACTIVITY_IMAGE;
  return (
    ACTIVITY_IMAGES_BY_ID[activity.id] ??
    (activity.artworkKey ? ACTIVITY_IMAGES_BY_ARTWORK_KEY[activity.artworkKey] : undefined) ??
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
