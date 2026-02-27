/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const activities = [
  // Sports & Fitness
  {
    title: 'Frisbee on the Lawn',
    description: 'Casual frisbee toss on the main lawn. No experience needed.',
    category: 'Sports & Fitness',
    defaultLocation: 'Main Lawn – Near the Fountain',
  },
  {
    title: 'Morning Jog Club',
    description: 'Easy-paced 3-mile jog around campus. All levels welcome.',
    category: 'Sports & Fitness',
    defaultLocation: 'Track – West Field House',
  },
  {
    title: 'Basketball Pickup Game',
    description: 'Friendly 3-on-3 or 5-on-5 pickup games. Show up and play.',
    category: 'Sports & Fitness',
    defaultLocation: 'Rec Center – Court B',
  },
  {
    title: 'Yoga in the Park',
    description: 'Guided yoga flow outdoors. Bring a mat or towel.',
    category: 'Sports & Fitness',
    defaultLocation: 'Campus Park – Grass Amphitheater',
  },
  {
    title: 'Swimming Laps',
    description: 'Lap swim session with fellow students. Split a lane, share the pace.',
    category: 'Sports & Fitness',
    defaultLocation: 'Aquatic Center – Lane Pool',
  },
  {
    title: 'Soccer Kickaround',
    description: 'Informal soccer on the turf field. Cleats optional.',
    category: 'Sports & Fitness',
    defaultLocation: 'Turf Field – North Campus',
  },
  {
    title: 'Tennis Doubles',
    description: 'Find a doubles partner and hit the courts. Rackets available to borrow.',
    category: 'Sports & Fitness',
    defaultLocation: 'Tennis Courts – East Side',
  },

  // Food & Drink
  {
    title: 'Morning Coffee Walk',
    description: 'A casual 20-minute walk to grab coffee and chat with new people.',
    category: 'Food & Drink',
    defaultLocation: 'Campus Coffee Cart – Main Quad',
  },
  {
    title: 'Lunch Together',
    description: 'Meet up at the dining hall for lunch and good conversation.',
    category: 'Food & Drink',
    defaultLocation: 'Dining Hall – East Entrance',
  },
  {
    title: 'Boba Run',
    description: 'Walk to the boba shop off campus. Try a new flavor every time.',
    category: 'Food & Drink',
    defaultLocation: 'Student Union – Front Steps',
  },
  {
    title: 'Farmers Market Trip',
    description: 'Explore the local farmers market together on Saturday mornings.',
    category: 'Food & Drink',
    defaultLocation: 'Main Street – Farmers Market Plaza',
  },
  {
    title: 'Cooking Together',
    description: 'Cook a meal together in the dorm kitchen. Recipe provided each week.',
    category: 'Food & Drink',
    defaultLocation: 'Residence Hall – Community Kitchen',
  },

  // Academic
  {
    title: 'Study Group Sprint',
    description: '90-minute focused study session — bring your own work, share the energy.',
    category: 'Academic',
    defaultLocation: 'Library – Group Study Room 3',
  },
  {
    title: 'Homework Help Circle',
    description: 'Drop in with tricky homework problems. Peer help, no judgment.',
    category: 'Academic',
    defaultLocation: 'Library – Tutoring Center',
  },
  {
    title: 'Exam Prep Session',
    description: 'Collaborative review before midterms and finals. Share notes and quiz each other.',
    category: 'Academic',
    defaultLocation: 'Library – Room 201',
  },
  {
    title: 'Language Exchange',
    description: 'Practice a new language with native speakers. All languages welcome.',
    category: 'Academic',
    defaultLocation: 'International Center – Lounge',
  },
  {
    title: 'Book Club Meetup',
    description: 'Read a book each month and discuss it over snacks.',
    category: 'Academic',
    defaultLocation: 'Campus Bookstore – Reading Nook',
  },

  // Arts & Creative
  {
    title: 'Sketch & Chat',
    description: 'Bring a sketchbook and draw while you hang out. Prompts provided.',
    category: 'Arts & Creative',
    defaultLocation: 'Art Building – Open Studio',
  },
  {
    title: 'Photography Walk',
    description: 'Explore campus through your lens. Phone cameras totally welcome.',
    category: 'Arts & Creative',
    defaultLocation: 'Clock Tower – Meeting Point',
  },
  {
    title: 'DIY Craft Night',
    description: 'Make something with your hands — supplies provided each session.',
    category: 'Arts & Creative',
    defaultLocation: 'Student Center – Craft Room',
  },
  {
    title: 'Open Mic Night',
    description: 'Perform poetry, comedy, music, or just come watch and cheer.',
    category: 'Arts & Creative',
    defaultLocation: 'Campus Café – Stage Area',
  },
  {
    title: 'Creative Writing Circle',
    description: 'Write short pieces and share them in a supportive group.',
    category: 'Arts & Creative',
    defaultLocation: 'English Building – Seminar Room',
  },

  // Social
  {
    title: 'Evening Campus Walk',
    description: 'A relaxed evening walk around campus to unwind and meet people.',
    category: 'Social',
    defaultLocation: 'Front Steps – Student Union',
  },
  {
    title: 'Board Game Night',
    description: 'Classic and modern board games. Newcomers always welcome.',
    category: 'Social',
    defaultLocation: 'Student Lounge – Game Corner',
  },
  {
    title: 'Movie Night',
    description: 'Watch a crowd-picked movie on the big screen with popcorn.',
    category: 'Social',
    defaultLocation: 'Media Room – Residence Hall',
  },
  {
    title: 'Campus Tour',
    description: 'Show new students around or rediscover hidden campus gems.',
    category: 'Social',
    defaultLocation: 'Admissions Building – Lobby',
  },
  {
    title: 'Trivia Night',
    description: 'Team up for trivia covering everything from pop culture to science.',
    category: 'Social',
    defaultLocation: 'Campus Pub – Back Room',
  },

  // Outdoors
  {
    title: 'Sunrise Hike',
    description: 'Early morning hike to catch the sunrise. Coffee provided at the top.',
    category: 'Outdoors',
    defaultLocation: 'Trailhead – Campus North Gate',
  },
  {
    title: 'Nature Trail Walk',
    description: 'A chill walk on the nature trail behind campus. Great for decompressing.',
    category: 'Outdoors',
    defaultLocation: 'Nature Trail – South Entrance',
  },
  {
    title: 'Stargazing Night',
    description: 'Lay out blankets and watch the stars. Telescope provided when clear.',
    category: 'Outdoors',
    defaultLocation: 'Observatory Hill – Open Field',
  },
  {
    title: 'Beach Cleanup',
    description: 'Clean up the local beach and enjoy some time by the water after.',
    category: 'Outdoors',
    defaultLocation: 'Campus Beach – Parking Lot A',
  },
  {
    title: 'Park Picnic',
    description: 'Bring a dish or snack and enjoy a group picnic in the park.',
    category: 'Outdoors',
    defaultLocation: 'Riverside Park – Pavilion',
  },

  // Music & Entertainment
  {
    title: 'Jam Session',
    description: 'Bring your instrument (or your voice) and jam with other musicians.',
    category: 'Music & Entertainment',
    defaultLocation: 'Music Building – Practice Room 5',
  },
  {
    title: 'Concert Buddy',
    description: 'Find someone to go to upcoming campus concerts and local shows with.',
    category: 'Music & Entertainment',
    defaultLocation: 'Event Center – Main Lobby',
  },
  {
    title: 'Karaoke Night',
    description: 'Belt out your favorite songs. No talent required, just enthusiasm.',
    category: 'Music & Entertainment',
    defaultLocation: 'Student Center – Multi-Purpose Room',
  },
  {
    title: 'Vinyl Listening Party',
    description: 'Listen to a curated album on vinyl together and discuss the music.',
    category: 'Music & Entertainment',
    defaultLocation: 'Campus Radio Station – Lounge',
  },

  // Wellness
  {
    title: 'Meditation Circle',
    description: 'Guided 20-minute meditation followed by quiet reflection.',
    category: 'Wellness',
    defaultLocation: 'Wellness Center – Quiet Room',
  },
  {
    title: 'Journaling Hour',
    description: 'Quiet journaling with optional prompts. Tea and calm vibes.',
    category: 'Wellness',
    defaultLocation: 'Library – Reading Garden',
  },
  {
    title: 'Digital Detox Walk',
    description: 'Leave your phone behind and take a mindful walk with others.',
    category: 'Wellness',
    defaultLocation: 'Botanical Garden – Entrance',
  },
  {
    title: 'Stretching & Recovery',
    description: 'Light stretching and foam rolling session. Perfect after a long day.',
    category: 'Wellness',
    defaultLocation: 'Rec Center – Studio B',
  },

  // Gaming
  {
    title: 'Video Game Tournament',
    description: 'Compete in casual gaming tournaments. Console and PC setups provided.',
    category: 'Gaming',
    defaultLocation: 'Esports Lounge – Student Center',
  },
  {
    title: 'Chess Club',
    description: 'Play chess at any skill level. Boards provided, lessons available.',
    category: 'Gaming',
    defaultLocation: 'Student Lounge – Table Area',
  },
  {
    title: 'Card Game Night',
    description: 'Play card games from Uno to Magic: The Gathering. Bring your own or borrow.',
    category: 'Gaming',
    defaultLocation: 'Common Room – West Hall',
  },

  // Volunteering
  {
    title: 'Community Garden',
    description: 'Help tend the campus garden. No green thumb needed — just show up.',
    category: 'Volunteering',
    defaultLocation: 'Community Garden – Behind Science Hall',
  },
  {
    title: 'Tutoring Buddies',
    description: 'Volunteer to tutor local middle schoolers in math and reading.',
    category: 'Volunteering',
    defaultLocation: 'Community Center – Room 12',
  },
  {
    title: 'Campus Cleanup',
    description: 'Spend an hour picking up litter and beautifying campus together.',
    category: 'Volunteering',
    defaultLocation: 'Main Quad – Info Booth',
  },
  {
    title: 'Food Bank Volunteer',
    description: 'Sort and pack food donations at the local food bank.',
    category: 'Volunteering',
    defaultLocation: 'Downtown Food Bank – Loading Dock',
  },
];

async function main() {
  // Clear existing data to re-seed with categories
  await prisma.message.deleteMany();
  await prisma.podMember.deleteMany();
  await prisma.pod.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.block.deleteMany();

  await prisma.activity.createMany({ data: activities });
  console.log(`Seeded ${activities.length} activities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
