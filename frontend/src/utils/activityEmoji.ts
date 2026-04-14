/**
 * Pick a display emoji for an activity from title keywords, then category.
 */
export function getActivityEmoji(title: string, category: string): string {
  const t = title.toLowerCase();

  const keywordPairs: [RegExp, string][] = [
    [/basketball|hoops|\bnba\b/i, '🏀'],
    [/frisbee|ultimate|disc golf/i, '🥏'],
    [/study|library|exam|midterm|homework|tutor/i, '📚'],
    [/beach|cleanup|shore|ocean trash/i, '🌊'],
    [/(soccer|futbol)\b|football match/i, '⚽'],
    [/volleyball/i, '🏐'],
    [/tennis/i, '🎾'],
    [/run|running|jog|track|5k|marathon/i, '🏃'],
    [/yoga|pilates|stretch/i, '🧘'],
    [/hike|hiking|trail/i, '🥾'],
    [/coffee|café|cafe|latte/i, '☕'],
    [/food tour|dinner|brunch|restaurant|taco|pizza/i, '🍽️'],
    [/movie|film|cinema/i, '🎬'],
    [/music|concert|jam session|band/i, '🎵'],
    [/game night|board game|gaming\b/i, '🎮'],
    [/photo|camera|shoot/i, '📷'],
    [/art\b|paint|sketch|museum/i, '🎨'],
    [/dance|salsa|swing dance/i, '💃'],
    [/volunteer|charity|service project/i, '🤝'],
    [/meditation|mindfulness|wellness spa/i, '🌿'],
    [/gym|lift|weights|workout/i, '🏋️'],
  ];

  for (const [re, emoji] of keywordPairs) {
    if (re.test(t)) return emoji;
  }

  const byCategory: Record<string, string> = {
    'Sports & Fitness': '⚽',
    'Food & Drink': '🍽️',
    Academic: '📚',
    'Arts & Creative': '🎨',
    Social: '👋',
    Outdoors: '🌲',
    'Music & Entertainment': '🎵',
    Wellness: '🌿',
    Gaming: '🎮',
    Volunteering: '🤝',
  };

  return byCategory[category] ?? '✨';
}
