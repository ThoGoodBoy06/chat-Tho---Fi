// Dịch vụ cung cấp kho ảnh GIF & Sticker động phong phú cho Chat Tho-Fi
// Hỗ trợ tìm kiếm theo từ khóa (tiếng Việt & tiếng Anh), lọc theo danh mục cảm xúc

const GIF_DATABASE = [
  // --- HAHA / CƯỜI ---
  {
    id: "gif-haha-1",
    title: "Cười thả ga",
    category: "haha",
    tags: ["cười", "haha", "funny", "laugh", "lol", "vui", "hài"],
    url: "https://media.tenor.com/2roX3uxz_68AAAAM/cat-laugh.gif",
    previewUrl: "https://media.tenor.com/2roX3uxz_68AAAAM/cat-laugh.gif"
  },
  {
    id: "gif-haha-2",
    title: "Cười nghiêng ngả",
    category: "haha",
    tags: ["cười", "haha", "minion", "laughing", "vui"],
    url: "https://media.tenor.com/y1v2l6mD9Z8AAAAM/laughing-minions.gif",
    previewUrl: "https://media.tenor.com/y1v2l6mD9Z8AAAAM/laughing-minions.gif"
  },
  {
    id: "gif-haha-3",
    title: "Cười đắc ý",
    category: "haha",
    tags: ["cười", "haha", "funny", "smile", "smirk"],
    url: "https://media.tenor.com/T_490Q_j9pEAAAAM/hehe-laugh.gif",
    previewUrl: "https://media.tenor.com/T_490Q_j9pEAAAAM/hehe-laugh.gif"
  },
  {
    id: "gif-haha-4",
    title: "Bật cười sảng khoái",
    category: "haha",
    tags: ["cười", "haha", "tom", "jerry", "hilarious"],
    url: "https://media.tenor.com/Z6jWcZ6w1VwAAAAM/tom-and-jerry-laughing.gif",
    previewUrl: "https://media.tenor.com/Z6jWcZ6w1VwAAAAM/tom-and-jerry-laughing.gif"
  },

  // --- LOVE / THẢ TIM ---
  {
    id: "gif-love-1",
    title: "Bắn tim yêu thương",
    category: "love",
    tags: ["tim", "love", "heart", "yêu", "thương", "cute"],
    url: "https://media.tenor.com/vH9XgOqQh4wAAAAM/love-heart.gif",
    previewUrl: "https://media.tenor.com/vH9XgOqQh4wAAAAM/love-heart.gif"
  },
  {
    id: "gif-love-2",
    title: "Ôm ấm áp",
    category: "love",
    tags: ["ôm", "hug", "love", "yêu", "thương", "bạn bè"],
    url: "https://media.tenor.com/kCZNOvZKlSMAAAAM/hug-love.gif",
    previewUrl: "https://media.tenor.com/kCZNOvZKlSMAAAAM/hug-love.gif"
  },
  {
    id: "gif-love-3",
    title: "Hôn gió dễ thương",
    category: "love",
    tags: ["hôn", "kiss", "love", "thả tim", "cute", "yêu"],
    url: "https://media.tenor.com/39_X0Z0bSJEAAAAM/kiss-love.gif",
    previewUrl: "https://media.tenor.com/39_X0Z0bSJEAAAAM/kiss-love.gif"
  },
  {
    id: "gif-love-4",
    title: "Mắt trái tim",
    category: "love",
    tags: ["thích", "mê", "love", "heart eyes", "crush"],
    url: "https://media.tenor.com/eB_G2z2pE9oAAAAM/heart-eyes-love.gif",
    previewUrl: "https://media.tenor.com/eB_G2z2pE9oAAAAM/heart-eyes-love.gif"
  },

  // --- CUTE / DỄ THƯƠNG ---
  {
    id: "gif-cute-1",
    title: "Mèo con lắc đầu",
    category: "cute",
    tags: ["mèo", "cat", "cute", "dễ thương", "nhún nhảy"],
    url: "https://media.tenor.com/8Qp44pSg2qgAAAAM/cat-cute.gif",
    previewUrl: "https://media.tenor.com/8Qp44pSg2qgAAAAM/cat-cute.gif"
  },
  {
    id: "gif-cute-2",
    title: "Gấu trúc lăn tròn",
    category: "cute",
    tags: ["gấu", "panda", "cute", "dễ thương", "ngộ nghĩnh"],
    url: "https://media.tenor.com/j4uQjS2B9fEAAAAM/panda-rolling.gif",
    previewUrl: "https://media.tenor.com/j4uQjS2B9fEAAAAM/panda-rolling.gif"
  },
  {
    id: "gif-cute-3",
    title: "Chó Shiba chớp mắt",
    category: "cute",
    tags: ["chó", "dog", "shiba", "cute", "wink"],
    url: "https://media.tenor.com/5J3d2qG8v0IAAAAM/shiba-inu-wink.gif",
    previewUrl: "https://media.tenor.com/5J3d2qG8v0IAAAAM/shiba-inu-wink.gif"
  },

  // --- DANCE / NHẢY MÚA ---
  {
    id: "gif-dance-1",
    title: "Nhảy múa tưng bừng",
    category: "dance",
    tags: ["nhảy", "dance", "vui", "party", "quẩy"],
    url: "https://media.tenor.com/6bH53vXw5x8AAAAM/dance-happy.gif",
    previewUrl: "https://media.tenor.com/6bH53vXw5x8AAAAM/dance-happy.gif"
  },
  {
    id: "gif-dance-2",
    title: "Snoopy khiêu vũ",
    category: "dance",
    tags: ["nhảy", "dance", "snoopy", "chúc mừng", "quẩy"],
    url: "https://media.tenor.com/84R4cT_nUf4AAAAM/snoopy-dance.gif",
    previewUrl: "https://media.tenor.com/84R4cT_nUf4AAAAM/snoopy-dance.gif"
  },

  // --- PARTY / CHÚC MỪNG ---
  {
    id: "gif-party-1",
    title: "Tung hoa chúc mừng",
    category: "party",
    tags: ["chúc mừng", "congrats", "party", "tiệc", "pháo hoa", "quẩy"],
    url: "https://media.tenor.com/d_oYd4eD76oAAAAM/celebrate-party.gif",
    previewUrl: "https://media.tenor.com/d_oYd4eD76oAAAAM/celebrate-party.gif"
  },
  {
    id: "gif-party-2",
    title: "Bật sâm panh ăn mừng",
    category: "party",
    tags: ["chúc mừng", "champagne", "ăn mừng", "thành công", "party"],
    url: "https://media.tenor.com/FwWw2Z8b4BIAAAAM/celebration-party.gif",
    previewUrl: "https://media.tenor.com/FwWw2Z8b4BIAAAAM/celebration-party.gif"
  },

  // --- AGREE / LIKE / ĐỒNG Ý ---
  {
    id: "gif-agree-1",
    title: "Tuyệt vời (Thumbs up)",
    category: "agree",
    tags: ["like", "ok", "tuyệt", "thumbs up", "đồng ý", "nhất trí"],
    url: "https://media.tenor.com/fK7QGg7l8J4AAAAM/thumbs-up-agree.gif",
    previewUrl: "https://media.tenor.com/fK7QGg7l8J4AAAAM/thumbs-up-agree.gif"
  },
  {
    id: "gif-agree-2",
    title: "Gật đầu tán thành",
    category: "agree",
    tags: ["ok", "nod", "gật đầu", "đồng ý", "yes", "chuẩn"],
    url: "https://media.tenor.com/oW5Q5n6G7hEAAAAM/nodding-yes.gif",
    previewUrl: "https://media.tenor.com/oW5Q5n6G7hEAAAAM/nodding-yes.gif"
  },
  {
    id: "gif-agree-3",
    title: "Vỗ tay tán thưởng",
    category: "agree",
    tags: ["vỗ tay", "clap", "bravo", "tuyệt", "chúc mừng"],
    url: "https://media.tenor.com/4qM1dG5j2hYAAAAM/clapping-applause.gif",
    previewUrl: "https://media.tenor.com/4qM1dG5j2hYAAAAM/clapping-applause.gif"
  },

  // --- SAD / BUỒN / KHÓC ---
  {
    id: "gif-sad-1",
    title: "Khóc ròng",
    category: "sad",
    tags: ["khóc", "buồn", "cry", "sad", "nước mắt", "dỗi"],
    url: "https://media.tenor.com/rM9N6wXy7qUAAAAM/crying-sad.gif",
    previewUrl: "https://media.tenor.com/rM9N6wXy7qUAAAAM/crying-sad.gif"
  },
  {
    id: "gif-sad-2",
    title: "Buồn một mình",
    category: "sad",
    tags: ["buồn", "sad", "cô đơn", "tủi thân", "mưa"],
    url: "https://media.tenor.com/z0jK7f7Q6xMAAAAM/cat-sad.gif",
    previewUrl: "https://media.tenor.com/z0jK7f7Q6xMAAAAM/cat-sad.gif"
  },

  // --- WOW / BẤT NGỜ ---
  {
    id: "gif-wow-1",
    title: "Tròn xoe mắt bất ngờ",
    category: "wow",
    tags: ["bất ngờ", "wow", "shocked", "ngạc nhiên", "omg"],
    url: "https://media.tenor.com/M7u4V5j5j9YAAAAM/shocked-surprised.gif",
    previewUrl: "https://media.tenor.com/M7u4V5j5j9YAAAAM/shocked-surprised.gif"
  },
  {
    id: "gif-wow-2",
    title: "Mắt chữ A miệng chữ O",
    category: "wow",
    tags: ["bất ngờ", "wow", "omg", "shock", "ghê vậy"],
    url: "https://media.tenor.com/4q6G2tPq9xEAAAAM/wow-mind-blown.gif",
    previewUrl: "https://media.tenor.com/4q6G2tPq9xEAAAAM/wow-mind-blown.gif"
  },

  // --- BYE / CHÀO / TẠM BIỆT ---
  {
    id: "gif-bye-1",
    title: "Vẫy tay chào",
    category: "bye",
    tags: ["chào", "bye", "hi", "hello", "tạm biệt", "vẫy tay"],
    url: "https://media.tenor.com/a4g2qQ5u5eIAAAAM/waving-hello.gif",
    previewUrl: "https://media.tenor.com/a4g2qQ5u5eIAAAAM/waving-hello.gif"
  },
  {
    id: "gif-bye-2",
    title: "Hẹn gặp lại",
    category: "bye",
    tags: ["tạm biệt", "bye", "see you", "ngủ ngon", "goodbye"],
    url: "https://media.tenor.com/k9m6M1x2w4UAAAAM/bye-goodbye.gif",
    previewUrl: "https://media.tenor.com/k9m6M1x2w4UAAAAM/bye-goodbye.gif"
  }
];

const CATEGORIES = [
  { id: "all", name: "🔥 Thịnh hành" },
  { id: "haha", name: "😂 Cười vui" },
  { id: "love", name: "❤️ Thả tim" },
  { id: "cute", name: "🐱 Dễ thương" },
  { id: "agree", name: "👍 Đồng ý" },
  { id: "dance", name: "💃 Nhảy múa" },
  { id: "party", name: "🎉 Chúc mừng" },
  { id: "wow", name: "😲 Bất ngờ" },
  { id: "sad", name: "😭 Buồn khóc" },
  { id: "bye", name: "👋 Tạm biệt" }
];

function normalizeStr(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

exports.searchGifs = function (query = "", category = "all", limit = 30) {
  const normQ = normalizeStr(query);
  let results = GIF_DATABASE;

  if (category && category !== "all") {
    results = results.filter(item => item.category === category);
  }

  if (normQ.length > 0) {
    results = results.filter(item => {
      const matchTitle = normalizeStr(item.title).includes(normQ);
      const matchCat = normalizeStr(item.category).includes(normQ);
      const matchTags = item.tags.some(t => normalizeStr(t).includes(normQ));
      return matchTitle || matchCat || matchTags;
    });
  }

  return {
    success: true,
    categories: CATEGORIES,
    count: results.length,
    data: results.slice(0, limit)
  };
};
