const mockPosts = [
  {
    id: "post-1",
    type: "post",
    category: "Clubs",
    author: {
      name: "Robotics & AI Guild",
      handle: "@sanjivani_robotics",
      avatar: "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150&auto=format&fit=crop&q=80",
      isVerified: true,
      badgeText: "Official Club"
    },
    title: "Quad Autonomous Drone Sprint Finals! 🛸",
    content: "Our autonomous aerial navigation fleet just completed the courtyard slalom obstacle trials with zero collision penalties! Huge shoutout to the firmware team who stayed up in Tech Innovation Lab till 4 AM refactoring the vision SLAM models. Come by University Amphitheatre at 5 PM for open flights and bubble tea!",
    images: [
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&auto=format&fit=crop&q=80"
    ],
    timestamp: "12m ago",
    likes: 184,
    hasLiked: false,
    commentsCount: 29,
    bookmarksCount: 42,
    hasBookmarked: false,
    tags: ["#Robotics", "#CampusLife", "#AI", "#TechShowcase"],
    comments: [
      {
        id: "c1",
        author: "Devon Chen",
        handle: "@dchen_ee",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        text: "The PID stabilization during that gale breeze around 2 PM was insane 🔥",
        timestamp: "8m ago",
        likes: 14
      },
      {
        id: "c2",
        author: "Elena Rostova",
        handle: "@elena_cs",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        text: "Are freshmen allowed to pilot the secondary drones at 5 PM?",
        timestamp: "5m ago",
        likes: 6
      }
    ]
  },
  {
    id: "post-2",
    type: "confession",
    category: "Confessions",
    author: {
      name: "Anonymous Cardinal",
      handle: "@ghost_mask_44",
      avatar: "mask",
      isAnonymous: true,
      badgeText: "Masked Student"
    },
    title: "To the person listening to Lo-Fi in Central Library 3rd Floor...",
    content: "You thought your AirPods were connected for a solid 25 minutes of studying. In reality, the entire quiet reading room was getting treated to chill Japanese study beats at 60% volume. Nobody told you because it was honestly setting an immaculate vibe for my Data Structures pset. Keep doing you king/queen 🙏",
    timestamp: "45m ago",
    likes: 412,
    hasLiked: true,
    commentsCount: 57,
    bookmarksCount: 88,
    hasBookmarked: true,
    tags: ["#CentralLibrary", "#LoFiVibes", "#CampusCrush", "#StudyGrind"],
    flair: "Wholesome",
    comments: [
      {
        id: "c3",
        author: "Anonymous Falcon",
        handle: "@anon_falcon",
        avatar: "mask",
        isAnonymous: true,
        text: "WAIT WAS THIS NEAR THE SOUTH STACKS?? If so that was literally me omg I was wondering why everyone was nodding in sync 😭💀",
        timestamp: "32m ago",
        likes: 89
      },
      {
        id: "c4",
        author: "Maya Patel",
        handle: "@mayap_27",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80",
        text: "The best accidental aux performance on campus this quarter.",
        timestamp: "20m ago",
        likes: 31
      }
    ]
  },
  {
    id: "post-3",
    type: "event",
    category: "Events",
    author: {
      name: "Design & Innovation Lab",
      handle: "@sanjivani_design",
      avatar: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80",
      isVerified: true,
      badgeText: "Verified Org"
    },
    title: "Annual HackRadar '26: 36h AI + Hardware Sprint",
    content: "Join 600+ collegiate hackers, designers, and founders for Sanjivani University's most vibrant student hackathon. $25k prize pool, keynotes from top AI researchers, and unlimited boba + late-night taco trucks sponsored by local tech accelerators.",
    eventDate: {
      month: "OCT",
      day: "28",
      time: "Fri 6:00 PM - Sun 12:00 PM",
      location: "Sanjivani Central Union, Grand Hall"
    },
    images: [
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80"
    ],
    timestamp: "2h ago",
    likes: 320,
    hasLiked: false,
    commentsCount: 44,
    bookmarksCount: 165,
    hasBookmarked: false,
    attendeesCount: 418,
    isRegistered: false,
    tags: ["#Hackathon", "#AI", "#FreeFood", "#BuilderCulture"],
    comments: [
      {
        id: "c5",
        author: "Liam Vance",
        handle: "@liamvance",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        text: "Looking for a full-stack Next.js/Python dev to team up with for the spatial computing track! DM me.",
        timestamp: "1h ago",
        likes: 12
      }
    ]
  },
  {
    id: "post-4",
    type: "post",
    category: "Academics",
    author: {
      name: "Prof. Sarah Sterling (TA Coord)",
      handle: "@cs_academics",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
      isVerified: true,
      badgeText: "Course Staff"
    },
    title: "CS 229 Machine Learning: Midterm Review Room Relocations",
    content: "ATTENTION: Due to high RSVPs, Tonight's Midterm Comprehensive Review Session has been moved from Academic Block A-201 to Main Campus Auditorium. Starts promptly at 7:15 PM. Zoom link will also be recorded and posted on discussion board. Bring your cheat sheet drafts!",
    images: [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80"
    ],
    timestamp: "3h ago",
    likes: 245,
    hasLiked: false,
    commentsCount: 18,
    bookmarksCount: 94,
    hasBookmarked: false,
    tags: ["#CS229", "#Midterms", "#AcademicAlert", "#StudySession"],
    comments: [
      {
        id: "c6",
        author: "Chloe Zhao",
        handle: "@chloe_z",
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        text: "Will the TA slides with the SVM derivations be uploaded before 7 PM?",
        timestamp: "2h ago",
        likes: 8
      }
    ]
  },
  {
    id: "post-5",
    type: "confession",
    category: "Confessions",
    author: {
      name: "Anonymous Owl",
      handle: "@ghost_mask_92",
      avatar: "mask",
      isAnonymous: true,
      badgeText: "Masked Senior"
    },
    title: "Senior year realization: Nobody actually has it figured out",
    content: "I spent 3 years stressing over whether taking 20 units every quarter and running 2 student orgs meant I was falling behind everyone else's LinkedIn humblebrags. Just had coffee with a friend who has a fancy return offer and they confessed they feel just as terrified and lost. Be kind to yourselves this midterms season. You're doing great.",
    timestamp: "5h ago",
    likes: 672,
    hasLiked: true,
    commentsCount: 91,
    bookmarksCount: 230,
    hasBookmarked: true,
    tags: ["#MentalHealth", "#SeniorReflections", "#CampusTalk", "#Perspective"],
    flair: "Deep Thoughts",
    comments: [
      {
        id: "c7",
        author: "Marcus Rivera",
        handle: "@mrivera_chem",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        text: "Needed to hear this today after failing my organic chemistry quiz. Thank you.",
        timestamp: "4h ago",
        likes: 45
      }
    ]
  },
  {
    id: "post-6",
    type: "event",
    category: "Events",
    author: {
      name: "Campus Culinary & Socials",
      handle: "@night_market_team",
      avatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80",
      isVerified: true,
      badgeText: "Campus Life"
    },
    title: "Autumn Moonlight Food Truck Festival 🍜🥟",
    content: "15 local artisan vendors, live student indie bands, matcha lattes, Korean corndogs, churros, and illuminated lantern booths! Admission is completely free with your Student Digital ID.",
    eventDate: {
      month: "NOV",
      day: "04",
      time: "Sat 6:30 PM - 11:00 PM",
      location: "Central Plaza Fountain"
    },
    images: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80"
    ],
    timestamp: "7h ago",
    likes: 580,
    hasLiked: false,
    commentsCount: 63,
    bookmarksCount: 289,
    hasBookmarked: false,
    attendeesCount: 742,
    isRegistered: true,
    tags: ["#NightMarket", "#Boba", "#LiveMusic", "#WeekendVibes"],
    comments: []
  }
];

const mockNotifications = [
  {
    id: "notif-1",
    type: "academic",
    title: "Urgent Course Relocation",
    message: "CS 229 Midterm Review session moved to Main Campus Auditorium at 7:15 PM.",
    timestamp: "15m ago",
    unread: true,
    actionUrl: "post-4"
  },
  {
    id: "notif-2",
    type: "social",
    title: "Trending in Confessions",
    message: "Your comment on 'Central Library 3rd Floor Lo-Fi' received 50+ upvotes!",
    timestamp: "1h ago",
    unread: true,
    actionUrl: "post-2"
  },
  {
    id: "notif-3",
    type: "event",
    title: "Event Reminder",
    message: "HackRadar '26 registration deadline is in 48 hours. Team slots are 85% full.",
    timestamp: "3h ago",
    unread: false,
    actionUrl: "post-3"
  },
  {
    id: "notif-4",
    type: "club",
    title: "Robotics & AI Guild",
    message: "Open flight trials start in 2 hours at University Amphitheatre. Don't forget your controller.",
    timestamp: "4h ago",
    unread: false,
    actionUrl: "post-1"
  }
];

const mockUser = {
  id: "user-current",
  name: "Alex Thorne",
  handle: "@alexthorne",
  major: "Computer Science & Design",
  year: "Junior (Class of '27)",
  campus: "Sanjivani University",
  karma: 1420,
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
  bio: "Building spatial interfaces & autonomous systems. Often found at Campus Cafe consuming cold brew.",
  postsCount: 14,
  eventsAttending: 6,
  anonymousMaskColor: "#10b981",
  badges: ["Verified Student", "Top Contributor", "Hackathon Finalist"],
  role: "student"
};

const mockTrendingTags = [
  { tag: "#HackRadar26", count: "1.4k posts", category: "Events" },
  { tag: "#CentralLibrary", count: "892 posts", category: "Campus" },
  { tag: "#CS229", count: "650 posts", category: "Academics" },
  { tag: "#NightMarket", count: "512 posts", category: "Social" },
  { tag: "#RoboticsGuild", count: "420 posts", category: "Clubs" },
  { tag: "#SeniorReflections", count: "310 posts", category: "Confessions" }
];

module.exports = {
  mockPosts,
  mockNotifications,
  mockUser,
  mockTrendingTags
};
