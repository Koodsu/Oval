/// <reference types="node" />
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const activities = [
  // Sports & Fitness
  {
    title: 'Frisbee on the Lawn',
    description: 'Casual frisbee toss on the Oval. No experience needed.',
    category: 'Sports & Fitness',
    defaultLocation: 'The Oval',
  },
  {
    title: 'Go for a Jog',
    description: 'Easy-paced jog around campus. All levels welcome.',
    category: 'Sports & Fitness',
    defaultLocation: 'Jesse Owens Memorial Stadium – Track',
  },
  {
    title: 'Basketball Pickup Game',
    description: 'Friendly 3-on-3 or 5-on-5 pickup games. Show up and play.',
    category: 'Sports & Fitness',
    defaultLocation: 'RPAC – Court B',
  },
  {
    title: 'Swimming Laps',
    description: 'Lap swim session with fellow students. Split a lane, share the pace.',
    category: 'Sports & Fitness',
    defaultLocation: 'RPAC – Aquatic Center',
  },
  {
    title: 'Soccer Kickaround',
    description: 'Informal soccer on the turf field. Cleats optional.',
    category: 'Sports & Fitness',
    defaultLocation: 'RPAC – Outdoor Fields',
  },
  {
    title: 'Tennis Doubles',
    description: 'Find a doubles partner and hit the courts. Rackets available to borrow.',
    category: 'Sports & Fitness',
    defaultLocation: 'Varsity Tennis Center',
  },

  // Food & Drink
  {
    title: 'Morning Coffee Walk',
    description: 'A casual walk to grab coffee and chat with new people.',
    category: 'Food & Drink',
    defaultLocation: 'Dreaming Creek Coffee – High Street',
  },
  {
    title: 'Lunch Together',
    description: 'Meet up for lunch and good conversation.',
    category: 'Food & Drink',
    defaultLocation: 'Baker Hall Dining – South Campus',
  },
  {
    title: 'Boba Run',
    description: 'Walk to get boba off campus. Try a new flavor every time.',
    category: 'Food & Drink',
    defaultLocation: 'Kung Fu Tea – High Street',
  },
  {
    title: 'Farmers Market Trip',
    description: 'Explore the North Market together on Saturday mornings.',
    category: 'Food & Drink',
    defaultLocation: 'North Market – Downtown Columbus',
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
    defaultLocation: 'Thompson Library – Group Study Room',
  },
  {
    title: 'Homework Help Circle',
    description: 'Drop in with tricky homework problems. Peer help, no judgment.',
    category: 'Academic',
    defaultLocation: 'Thompson Library – Tutoring Center',
  },
  {
    title: 'Exam Prep Session',
    description: 'Collaborative review before midterms and finals. Share notes and quiz each other.',
    category: 'Academic',
    defaultLocation: 'Thompson Library – Room 201',
  },
  {
    title: 'Language Exchange',
    description: 'Practice a new language with native speakers. All languages welcome.',
    category: 'Academic',
    defaultLocation: 'Hagerty Hall – International Lounge',
  },
  {
    title: 'Book Club Meetup',
    description: 'Read a book each month and discuss it over snacks.',
    category: 'Academic',
    defaultLocation: 'Thompson Library – Reading Room',
  },

  // Arts & Creative
  {
    title: 'Sketch & Chat',
    description: 'Bring a sketchbook and draw while you hang out. Prompts provided.',
    category: 'Arts & Creative',
    defaultLocation: 'Hopkins Hall – Open Studio',
  },
  {
    title: 'Photography Walk',
    description: 'Explore campus through your lens. Phone cameras totally welcome.',
    category: 'Arts & Creative',
    defaultLocation: 'The Oval – Mirror Lake End',
  },
  {
    title: 'DIY Craft Night',
    description: 'Make something with your hands — supplies provided each session.',
    category: 'Arts & Creative',
    defaultLocation: 'Ohio Union – Craft Room',
  },
  {
    title: 'Open Mic Night',
    description: 'Perform poetry, comedy, music, or just come watch and cheer.',
    category: 'Arts & Creative',
    defaultLocation: 'Ohio Union – Senate Chamber',
  },
  {
    title: 'Creative Writing Circle',
    description: 'Write short pieces and share them in a supportive group.',
    category: 'Arts & Creative',
    defaultLocation: 'Denney Hall – Seminar Room',
  },

  // Social
  {
    title: 'Evening Campus Walk',
    description: 'A relaxed evening walk around campus to unwind and meet people.',
    category: 'Social',
    defaultLocation: 'The Oval – Main Entrance',
  },
  {
    title: 'Board Game Night',
    description: 'Classic and modern board games. Newcomers always welcome.',
    category: 'Social',
    defaultLocation: 'Ohio Union – Game Room',
  },
  {
    title: 'Movie Night',
    description: 'Watch a crowd-picked movie on the big screen with popcorn.',
    category: 'Social',
    defaultLocation: 'Ohio Union – Cartoon Room',
  },
  {
    title: 'Campus Tour',
    description: 'Show new students around or rediscover hidden campus gems.',
    category: 'Social',
    defaultLocation: 'Ohio Union – Main Lobby',
  },
  {
    title: 'Trivia Night',
    description: 'Team up for trivia covering everything from pop culture to science.',
    category: 'Social',
    defaultLocation: 'Ethyl & Tank – Grandview',
  },

  // Outdoors
  {
    title: 'Sunrise Walk',
    description: 'Early morning walk to catch the sunrise across the Oval.',
    category: 'Outdoors',
    defaultLocation: 'The Oval – East Entrance',
  },
  {
    title: 'Nature Trail Walk',
    description: 'A chill walk on the Olentangy Trail. Great for decompressing.',
    category: 'Outdoors',
    defaultLocation: 'Olentangy Trail – Kenny Road Entrance',
  },
  {
    title: 'Stargazing Night',
    description: 'Lay out blankets and watch the stars. Telescope provided when clear.',
    category: 'Outdoors',
    defaultLocation: 'Ohio Stadium – East Lawn',
  },
  {
    title: 'Mirror Lake Hangout',
    description: 'Hang out by Mirror Lake and meet new people.',
    category: 'Outdoors',
    defaultLocation: 'Mirror Lake – The Oval',
  },
  {
    title: 'Park Picnic',
    description: 'Bring a dish or snack and enjoy a group picnic.',
    category: 'Outdoors',
    defaultLocation: 'Schiller Park – Pavilion',
  },

  // Music & Entertainment
  {
    title: 'Jam Session',
    description: 'Bring your instrument (or your voice) and jam with other musicians.',
    category: 'Music & Entertainment',
    defaultLocation: 'Oxley Hall – Practice Room',
  },
  {
    title: 'Concert Buddy',
    description: 'Find someone to go to upcoming campus concerts and local shows with.',
    category: 'Music & Entertainment',
    defaultLocation: 'Nationwide Arena – Main Lobby',
  },
  {
    title: 'Karaoke Night',
    description: 'Belt out your favorite songs. No talent required, just enthusiasm.',
    category: 'Music & Entertainment',
    defaultLocation: 'Char Bar – Short North',
  },
  {
    title: 'Vinyl Listening Party',
    description: 'Listen to a curated album on vinyl together and discuss the music.',
    category: 'Music & Entertainment',
    defaultLocation: 'Used Kids Records – High Street',
  },
  {
    title: 'A Cappella Listening Hang',
    description: 'Share favorite vocal groups, campus covers, and concert clips with people who love harmonies.',
    category: 'Music & Entertainment',
    defaultLocation: 'Ohio Union – Performance Hall',
  },

  // Wellness
  {
    title: 'Meditation Circle',
    description: 'Guided 20-minute meditation followed by quiet reflection.',
    category: 'Wellness',
    defaultLocation: 'RPAC – Mind Body Studio',
  },
  {
    title: 'Journaling Hour',
    description: 'Quiet journaling with optional prompts. Tea and calm vibes.',
    category: 'Wellness',
    defaultLocation: 'Thompson Library – Reading Garden',
  },
  {
    title: 'Digital Detox Walk',
    description: 'Leave your phone behind and take a mindful walk with others.',
    category: 'Wellness',
    defaultLocation: 'Chadwick Arboretum – Main Path',
  },
  {
    title: 'Stretching & Recovery',
    description: 'Light stretching and foam rolling session. Perfect after a long day.',
    category: 'Wellness',
    defaultLocation: 'RPAC – Studio B',
  },
  {
    title: 'Yoga Reset',
    description: 'A low-pressure yoga flow for resetting after class. Beginners welcome.',
    category: 'Wellness',
    defaultLocation: 'RPAC – Mind Body Studio',
  },

  // Gaming
  {
    title: 'Smash Bros Tournament',
    description: 'Compete in casual Smash Bros brackets. All skill levels welcome.',
    category: 'Gaming',
    defaultLocation: 'Ohio Union – Esports Lounge',
  },
  {
    title: 'Chess Club',
    description: 'Play chess at any skill level. Boards provided, lessons available.',
    category: 'Gaming',
    defaultLocation: 'Ohio Union – Game Room',
  },
  {
    title: 'Card Game Night',
    description: 'Play card games from Uno to Magic: The Gathering. Bring your own or borrow.',
    category: 'Gaming',
    defaultLocation: 'Ohio Union – Game Room',
  },
  {
    title: 'Tabletop RPG One-Shot',
    description: 'Jump into a beginner-friendly tabletop adventure with pre-made characters.',
    category: 'Gaming',
    defaultLocation: 'Ohio Union – Game Room',
  },

  // Volunteering
  {
    title: 'Community Garden',
    description: 'Help tend the campus garden. No green thumb needed — just show up.',
    category: 'Volunteering',
    defaultLocation: 'Chadwick Arboretum – Community Garden',
  },
  {
    title: 'Tutoring Buddies',
    description: 'Volunteer to tutor local middle schoolers in math and reading.',
    category: 'Volunteering',
    defaultLocation: 'Weinland Park Community Center',
  },
  {
    title: 'Campus Cleanup',
    description: 'Spend an hour picking up litter and beautifying campus together.',
    category: 'Volunteering',
    defaultLocation: 'The Oval – Info Booth',
  },
  {
    title: 'Food Bank Volunteer',
    description: 'Sort and pack food donations at the Mid-Ohio Food Collective.',
    category: 'Volunteering',
    defaultLocation: 'Mid-Ohio Food Collective – Parsons Ave',
  },
  {
    title: 'Blood Drive Helpers',
    description: 'Help greet donors, organize supplies, and keep a campus blood drive moving.',
    category: 'Volunteering',
    defaultLocation: 'Ohio Union – Great Hall',
  },
];

async function main() {
  await prisma.report.deleteMany();
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
