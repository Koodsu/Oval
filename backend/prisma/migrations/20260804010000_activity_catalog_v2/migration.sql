ALTER TABLE "Activity"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "artworkKey" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Activity_artworkKey_key" ON "Activity"("artworkKey");
CREATE INDEX "Activity_isActive_category_sortOrder_idx" ON "Activity"("isActive", "category", "sortOrder");

-- Preserve legacy activities for existing pods and analytics, but retire them
-- from discovery and new pod creation.
UPDATE "Activity" SET "isActive" = false;

INSERT INTO "Activity" ("id", "title", "description", "category", "defaultLocation", "artworkKey", "sortOrder", "isActive") VALUES
('72d0fe6d-53f3-46f3-96ef-036e4abb2e1c', 'Study group', 'Meet classmates for a focused study session. Put the class or subject in the pod title.', 'Academic / Study', 'Thompson Library', 'study-group', 1, TRUE),
('e39c7e9d-beb9-4a97-b6a8-23e67c870747', 'Reading / book club', 'Read together or meet to discuss a book, article, or series.', 'Academic / Study', 'Thompson Library', 'reading-book-club', 2, TRUE),
('1d155e8f-1f8d-4c6d-a2f6-835c6326ff70', 'Pickup basketball', 'Start a casual basketball game for any skill level.', 'Sports', 'RPAC', 'pickup-basketball', 3, TRUE),
('cbf6ccf6-8865-498d-9b2a-8a7299f6207d', 'Pickup soccer', 'Get a group together for a casual soccer game or kickaround.', 'Sports', 'Lincoln Tower Fields', 'pickup-soccer', 4, TRUE),
('8092ae28-02aa-4cd3-98ca-0546eaf4ed6e', 'Pickup volleyball', 'Play a casual indoor, grass, or sand volleyball game.', 'Sports', 'RPAC', 'pickup-volleyball', 5, TRUE),
('679b4e61-84d7-40c5-bdf3-8d5034732800', 'Tennis / pickleball', 'Find a partner or group for tennis or pickleball.', 'Sports', 'RPAC', 'tennis-pickleball', 6, TRUE),
('28b42d34-e447-4abf-bbed-8d69564ac345', 'Running / jogging', 'Meet for a run or jog at the pace named in the pod title.', 'Sports', 'The Oval', 'running-jogging', 7, TRUE),
('9728004d-2e19-45bb-884b-25ac34f3fa85', 'Swimming', 'Swim laps, train, or enjoy the pool with other students.', 'Sports', 'Aquatic Center', 'swimming', 8, TRUE),
('cd08f480-6715-4f50-8a02-1c6bed0f1a6a', 'Golf', 'Find people for a round, the driving range, or putting practice.', 'Sports', 'OSU Golf Club', 'golf', 9, TRUE),
('f22d21db-de3d-4e34-9abb-4ab6081c30c0', 'Bowling', 'Meet up for a casual game or a full night at the lanes.', 'Sports', 'Columbus Square Bowling Palace', 'bowling', 10, TRUE),
('9349d2fa-681b-4362-abfb-1184e0b3b56e', 'Frisbee', 'Toss a disc or organize a casual ultimate game.', 'Sports', 'The Oval', 'frisbee', 11, TRUE),
('a54f0bb9-f422-4264-ad52-97b65859b98d', 'Gym partner', 'Find a partner for lifting, cardio, or a shared workout plan.', 'Fitness & Wellness', 'RPAC', 'gym-partner', 12, TRUE),
('685728ff-703c-4069-92e9-c960254aa849', 'Yoga', 'Practice yoga together at the style and level named in the pod title.', 'Fitness & Wellness', 'RPAC – Mind Body Studio', 'yoga', 13, TRUE),
('61eab34d-b1ed-47b8-9717-72614dab36a1', 'Meditation', 'Meet for guided or quiet meditation and reflection.', 'Fitness & Wellness', 'RPAC – Wellness Space', 'meditation', 14, TRUE),
('3e6d1eb8-6836-4012-8f3b-d178a743d5dd', 'Nature walk', 'Take a relaxed walk through a trail, park, or green space.', 'Fitness & Wellness', 'Olentangy Trail', 'nature-walk', 15, TRUE),
('d90ef6da-2d3f-42b8-9b77-e475de983a2b', 'Casual hangout', 'Make a low-pressure plan to meet, talk, and spend time together.', 'Social & Events', 'Ohio Union', 'casual-hangout', 16, TRUE),
('7e3da896-a1c5-49b2-b035-590ddca48b0a', 'Movie / watch party', 'Watch a movie, show, game, or special event together.', 'Social & Events', 'Ohio Union', 'movie-watch-party', 17, TRUE),
('d202b3ec-71f6-4e51-a80d-f2cddcdef4bd', 'Go to an event', 'Find people to join you at a campus event, show, festival, or game.', 'Social & Events', 'Ohio Union', 'go-to-event', 18, TRUE),
('383ecbb2-64d5-4b10-ad4f-5ca933449b9f', 'Video games', 'Play console or PC games together, online or in person.', 'Gaming', 'Ohio Union – Esports Arena', 'video-games', 19, TRUE),
('6b14c650-68ff-4fa5-b86f-9e8fcfde8b80', 'Board games', 'Meet for a board game session from party games to strategy games.', 'Gaming', 'Ohio Union – Game Room', 'board-games', 20, TRUE),
('1661a3f8-ba69-4df3-8477-3b1d2e6ba146', 'Card games', 'Play traditional, party, or trading card games together.', 'Gaming', 'Ohio Union – Game Room', 'card-games', 21, TRUE),
('e927a37b-5f02-4683-9b8a-645707528aad', 'Tabletop RPGs', 'Start or join a tabletop role-playing session, including D&D and other systems.', 'Gaming', 'Ohio Union – Game Room', 'tabletop-rpgs', 22, TRUE),
('a39d73d8-1450-4173-974f-80d977453c42', 'Mobile games', 'Play multiplayer mobile games together in person or online.', 'Gaming', 'Ohio Union', 'mobile-games', 23, TRUE),
('effe238b-8544-44c8-9272-ba1d01ee8300', 'Trivia', 'Form a team for trivia or host a casual question night.', 'Gaming', 'Ohio Union', 'trivia', 24, TRUE),
('36291822-ce76-4cb5-85bf-aa6c2132cfb7', 'Chess', 'Play casual or competitive chess at any experience level.', 'Gaming', 'Ohio Union – Game Room', 'chess', 25, TRUE),
('82e17e62-90fd-4cd1-b1a2-900f78ec42b8', 'Food bank volunteering', 'Volunteer together sorting, packing, or distributing food.', 'Volunteering', 'Ohio Union – Service Hub', 'food-bank-volunteering', 26, TRUE),
('66db8b24-0096-448e-b694-0deed5a37788', 'Animal shelter volunteering', 'Volunteer together to support shelter animals and staff.', 'Volunteering', 'Ohio Union – Service Hub', 'animal-shelter-volunteering', 27, TRUE),
('a765a5eb-586c-4723-8981-0e0c6f6ab73d', 'Medical center volunteering', 'Coordinate an approved volunteer opportunity at a medical center.', 'Volunteering', 'Wexner Medical Center', 'medical-center-volunteering', 28, TRUE),
('bcd2c629-0871-4e9b-bc5f-749c14fc5178', 'Other volunteering', 'Organize another service opportunity and name it in the pod title.', 'Volunteering', 'Ohio Union – Service Hub', 'other-volunteering', 29, TRUE),
('56a9cab0-330c-489b-b77a-792b433e29df', 'Cook together', 'Plan and cook a meal together in a shared kitchen.', 'Food', 'Residence Hall – Community Kitchen', 'cook-together', 30, TRUE),
('3f8d1ccf-b120-4275-9db8-238e082fe312', 'Eat at a restaurant', 'Choose a restaurant and meet for a meal together.', 'Food', 'High Street', 'eat-at-restaurant', 31, TRUE),
('71578f3e-2d48-4707-a36e-583d5fe4caa9', 'Eat at a dining hall', 'Meet for breakfast, lunch, or dinner at a campus dining hall.', 'Food', 'Traditions at Scott', 'eat-at-dining-hall', 32, TRUE),
('fb5a4165-6947-483d-a2d7-9b1627c58c9d', 'Grab coffee or tea', 'Meet at a café for coffee, tea, or conversation.', 'Food', 'Berry Café', 'grab-coffee-tea', 33, TRUE),
('6bf75ec3-0f5f-412c-b945-3292ef362b57', 'Bake something', 'Bake a dessert, bread, or snack together.', 'Food', 'Residence Hall – Community Kitchen', 'bake-something', 34, TRUE),
('7041a05d-2346-4d19-bc24-7909e1b53dd1', 'Picnic', 'Bring food or snacks and meet for a picnic outdoors.', 'Food', 'The Oval', 'picnic', 35, TRUE),
('c2132a3d-2c08-4668-bb42-e4f9bdfaba63', 'Draw / paint together', 'Bring art supplies and make visual art together at any skill level.', 'Music & Arts', 'Hopkins Hall', 'draw-paint', 36, TRUE),
('dd90d5bc-46d1-47e2-97b3-47a85978ff0c', 'Crafting', 'Meet to make, build, sew, or craft something together.', 'Music & Arts', 'Ohio Union', 'crafting', 37, TRUE),
('5749bd6e-295d-4a8e-b9ef-7ab225c18638', 'Creative writing', 'Write, share, or workshop stories, poetry, and other creative work.', 'Music & Arts', 'Denney Hall', 'creative-writing', 38, TRUE),
('fa8b556c-ced4-4722-9dbe-1ded282eb2a7', 'Play / practice music', 'Practice, jam, or make music together with instruments or voice.', 'Music & Arts', 'Hughes Hall', 'play-practice-music', 39, TRUE),
('c7c364fd-1583-4788-9747-f4323437789a', 'Photography', 'Take photos together, practice techniques, or go on a photo walk.', 'Music & Arts', 'The Oval', 'photography', 40, TRUE),
('9be77ee1-8b32-424b-b32d-e9885ff2af92', 'Dance', 'Practice, learn, or freestyle a dance style together.', 'Music & Arts', 'Sullivant Hall', 'dance', 41, TRUE);
