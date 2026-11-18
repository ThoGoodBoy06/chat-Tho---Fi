// Dịch vụ cung cấp kho ảnh GIF & Sticker động phong phú cho Chat Tho-Fi
// Đặc biệt bổ sung bộ sưu tập Bubu & Dudu, Mochi Peach Cat và động vật cute

const GIF_DATABASE = [
  // ==========================================
  // --- BỘ SƯU TẬP ĐẶC BIỆT: BUBU & DUDU 🐼🐻 ---
  // ==========================================
  {
    id: "bubu-kiss-1",
    title: "Bubu Dudu hôn nhau ngọt ngào",
    category: "bubu",
    tags: ["bubu", "dudu", "hôn", "kiss", "love", "yêu", "cute", "dễ thương", "gấu", "thả tim"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-kisses-bhd4hi21lvcr867p.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-kisses-bhd4hi21lvcr867p.gif"
  },
  {
    id: "bubu-hug-1",
    title: "Bubu Dudu ôm nhau ấm áp",
    category: "bubu",
    tags: ["bubu", "dudu", "ôm", "hug", "love", "yêu", "cute", "dễ thương", "cuddle", "gấu"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-hugs-yaz4po52dmgzfqyf.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-hugs-yaz4po52dmgzfqyf.gif"
  },
  {
    id: "bubu-happy-1",
    title: "Bubu Dudu vui vẻ cười toe toét",
    category: "bubu",
    tags: ["bubu", "dudu", "vui", "happy", "cười", "haha", "cute", "dễ thương", "gấu"],
    url: "https://gifdb.com/images/branded/high/bubu-happy-dudu-mcruqb7z5ltuz8y5.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-happy-dudu-mcruqb7z5ltuz8y5.gif"
  },
  {
    id: "bubu-dance-1",
    title: "Bubu khiêu vũ một mình",
    category: "bubu",
    tags: ["bubu", "dudu", "nhảy", "dance", "khiêu vũ", "vui", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/bubu-dancing-alone-dudu-diu5kmp6fs1z292d.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dancing-alone-dudu-diu5kmp6fs1z292d.gif"
  },
  {
    id: "bubu-run-1",
    title: "Bubu Dudu chạy tung tăng",
    category: "bubu",
    tags: ["bubu", "dudu", "chạy", "run", "nhanh", "tung tăng", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-running-osqv1g4ez66kw89i.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-running-osqv1g4ez66kw89i.gif"
  },
  {
    id: "bubu-wiggle-1",
    title: "Bubu Dudu lắc lư nhún nhảy",
    category: "bubu",
    tags: ["bubu", "dudu", "lắc lư", "nhún nhảy", "dance", "wiggle", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/wiggly-bubu-dudu-ut6vjd2lcisbtfwf.gif",
    previewUrl: "https://gifdb.com/images/branded/high/wiggly-bubu-dudu-ut6vjd2lcisbtfwf.gif"
  },
  {
    id: "bubu-milk-1",
    title: "Bubu Dudu uống trà sữa",
    category: "bubu",
    tags: ["bubu", "dudu", "trà sữa", "boba", "milk", "uống", "cute", "ngon", "đói"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-milk-sips-715zn9pe6tnyrs25.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-milk-sips-715zn9pe6tnyrs25.gif"
  },
  {
    id: "bubu-noodle-1",
    title: "Bubu Dudu ăn mì ramen",
    category: "bubu",
    tags: ["bubu", "dudu", "ăn mì", "noodles", "đói", "ramen", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/two-cartoon-bears-are-eating-noodles-with-chopsticks-o4vmgdxk2z3ysdmd.gif",
    previewUrl: "https://gifdb.com/images/branded/high/two-cartoon-bears-are-eating-noodles-with-chopsticks-o4vmgdxk2z3ysdmd.gif"
  },
  {
    id: "bubu-kiss-sweet-1",
    title: "Bubu thơm má Dudu",
    category: "bubu",
    tags: ["bubu", "dudu", "thơm má", "hôn", "kiss", "love", "yêu", "ngọt ngào", "cute"],
    url: "https://gifdb.com/images/branded/high/bubu-kiss-sweet-dudu-7uf4hstqt631qmlp.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-kiss-sweet-dudu-7uf4hstqt631qmlp.gif"
  },
  {
    id: "bubu-smile-1",
    title: "Bubu Dudu mỉm cười đáng yêu",
    category: "bubu",
    tags: ["bubu", "dudu", "cười", "smile", "đáng yêu", "cute", "hiền"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-smiling-0rkqi6qkikk9tsk0.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-smiling-0rkqi6qkikk9tsk0.gif"
  },
  {
    id: "bubu-shake-1",
    title: "Bubu lắc lắc gọi Dudu dậy",
    category: "bubu",
    tags: ["bubu", "dudu", "dậy đi", "lắc", "shake", "gọi", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/bubu-shakes-dudu-okacyxxtlvxaxebk.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-shakes-dudu-okacyxxtlvxaxebk.gif"
  },
  {
    id: "bubu-wait-1",
    title: "Bubu Dudu ngồi chờ ngóng",
    category: "bubu",
    tags: ["bubu", "dudu", "chờ", "đợi", "wait", "ngóng", "cô đơn", "cute"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-waiting-wzobfqzqp8ccv3qm.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-waiting-wzobfqzqp8ccv3qm.gif"
  },
  {
    id: "bubu-sweat-1",
    title: "Bubu Dudu toát mồ hôi bối rối",
    category: "bubu",
    tags: ["bubu", "dudu", "toát mồ hôi", "bối rối", "ngại", "sweat", "lo lắng", "cute"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-sweaty-7sb1wlb1dda677c8.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-sweaty-7sb1wlb1dda677c8.gif"
  },
  {
    id: "bubu-dino-1",
    title: "Bubu Dudu mặc đồ khủng long",
    category: "bubu",
    tags: ["bubu", "dudu", "khủng long", "dinosaur", "hóa trang", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-dinosaur-costume-c2ssi8b7u8hxkjzg.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-dinosaur-costume-c2ssi8b7u8hxkjzg.gif"
  },
  {
    id: "bubu-duck-1",
    title: "Bubu Dudu cưỡi vịt",
    category: "bubu",
    tags: ["bubu", "dudu", "cưỡi vịt", "duck", "chơi", "vui", "cute"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-rides-a-duck-ez8o09fkzm1n0q6v.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-rides-a-duck-ez8o09fkzm1n0q6v.gif"
  },
  {
    id: "bubu-bike-1",
    title: "Bubu Dudu đèo nhau đi xe đạp",
    category: "bubu",
    tags: ["bubu", "dudu", "xe đạp", "bike", "đi dạo", "hẹn hò", "date", "love"],
    url: "https://gifdb.com/images/branded/high/two-bears-riding-a-bike-lyyww79wr3eefobz.gif",
    previewUrl: "https://gifdb.com/images/branded/high/two-bears-riding-a-bike-lyyww79wr3eefobz.gif"
  },
  {
    id: "bubu-picnic-1",
    title: "Bubu Dudu picnic dâu tây",
    category: "bubu",
    tags: ["bubu", "dudu", "picnic", "dâu tây", "ăn", "ngon", "love", "cute"],
    url: "https://gifdb.com/images/branded/high/two-bears-picnicking-with-strawberries-mu89bejyrhqrb8sj.gif",
    previewUrl: "https://gifdb.com/images/branded/high/two-bears-picnicking-with-strawberries-mu89bejyrhqrb8sj.gif"
  },
  {
    id: "bubu-makeup-1",
    title: "Bubu trang điểm cho Dudu",
    category: "bubu",
    tags: ["bubu", "dudu", "trang điểm", "makeup", "đẹp", "dễ thương", "cute"],
    url: "https://gifdb.com/images/branded/high/bubu-dudu-apply-make-up-17xiucdnywjiy3jo.gif",
    previewUrl: "https://gifdb.com/images/branded/high/bubu-dudu-apply-make-up-17xiucdnywjiy3jo.gif"
  },
  {
    id: "bubu-heart-flying-1",
    title: "Bubu Dudu hôn bắn tim tung tóe",
    category: "bubu",
    tags: ["bubu", "dudu", "bắn tim", "hôn", "kiss", "love", "yêu", "lãng mạn"],
    url: "https://gifdb.com/images/branded/high/teddy-bears-kissing-with-flying-hearts-06yc7as5j7s0zkh4.gif",
    previewUrl: "https://gifdb.com/images/branded/high/teddy-bears-kissing-with-flying-hearts-06yc7as5j7s0zkh4.gif"
  },
  {
    id: "bubu-comfort-1",
    title: "Bubu ôm dỗ dành Dudu buồn",
    category: "bubu",
    tags: ["bubu", "dudu", "dỗ dành", "ôm", "hug", "buồn", "sad", "an ủi"],
    url: "https://gifdb.com/images/branded/high/sad-teddy-bears-sending-hugs-pn18ovupys7q8g9g.gif",
    previewUrl: "https://gifdb.com/images/branded/high/sad-teddy-bears-sending-hugs-pn18ovupys7q8g9g.gif"
  },

  // ==========================================
  // --- MOCHI PEACH CAT & STICKER CƯNG XỈU 🐱 ---
  // ==========================================
  {
    id: "mochi-heart-1",
    title: "Mochi Cat ôm tim bự",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "tim", "heart", "love", "cute", "dễ thương", "cưng"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-holding-heart-y9fz23so3eptrx4o.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-holding-heart-y9fz23so3eptrx4o.gif"
  },
  {
    id: "mochi-snuggle-1",
    title: "Mochi Cat cọ má cưng xỉu",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "cọ má", "snuggle", "cưng", "love", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-standing-snuggles-ku8t53rkpfayxaej.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-standing-snuggles-ku8t53rkpfayxaej.gif"
  },
  {
    id: "mochi-boba-1",
    title: "Mochi Cat hút trà sữa boba",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "trà sữa", "boba", "uống", "cute", "ngon"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-sipping-boba-drink-p15n5nm1rj9fgys6.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-sipping-boba-drink-p15n5nm1rj9fgys6.gif"
  },
  {
    id: "mochi-kiss-1",
    title: "Mochi Cat thổi nụ hôn trái tim",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "thổi hôn", "kiss", "tim", "heart", "love", "cute"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-blowing-heart-kisses-bt2balq8hhq2osh9.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-blowing-heart-kisses-bt2balq8hhq2osh9.gif"
  },
  {
    id: "mochi-jump-1",
    title: "Mochi Cat nhảy cẫng vui sướng",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "nhảy", "vui", "sướng", "happy", "cute"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-jumping-up-dw1x83bkbrh2rgss.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-jumping-up-dw1x83bkbrh2rgss.gif"
  },
  {
    id: "mochi-icecream-1",
    title: "Mochi Cat chia nhau cây kem",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "kem", "ice cream", "chia sẻ", "ngon", "love"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-sharing-ice-pop-lc308e8ib1mccc4f.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-sharing-ice-pop-lc308e8ib1mccc4f.gif"
  },
  {
    id: "mochi-dance-1",
    title: "Mochi Cat lắc lư theo nhạc",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "nhảy", "nhạc", "dance", "lắc lư", "cute"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-bumping-to-music-zrffaqti4o0ridin.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-bumping-to-music-zrffaqti4o0ridin.gif"
  },
  {
    id: "mochi-giggle-1",
    title: "Mochi Cat cười khúc khích",
    category: "cute",
    tags: ["mochi", "mèo", "cat", "cười", "haha", "giggle", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/mochi-cat-giggling-on-top-of-pillow-orma9guxsmzqmtug.gif",
    previewUrl: "https://gifdb.com/images/branded/high/mochi-cat-giggling-on-top-of-pillow-orma9guxsmzqmtug.gif"
  },
  {
    id: "cat-puss-in-boots-1",
    title: "Bé mèo mắt tròn xoe năn nỉ",
    category: "cute",
    tags: ["mèo", "cat", "năn nỉ", "please", "cute", "dễ thương", "long lanh"],
    url: "https://gifdb.com/images/branded/high/shrek-cute-cat-please-teddep3bmxr58n78.gif",
    previewUrl: "https://gifdb.com/images/branded/high/shrek-cute-cat-please-teddep3bmxr58n78.gif"
  },
  {
    id: "cat-hello-1",
    title: "Bé mèo vẫy tay chào Meow",
    category: "cute",
    tags: ["mèo", "cat", "chào", "meow", "hello", "hi", "cute", "dễ thương"],
    url: "https://gifdb.com/images/branded/high/sweet-little-cute-cat-meow-hi-dzfwgl4wj601ahyb.gif",
    previewUrl: "https://gifdb.com/images/branded/high/sweet-little-cute-cat-meow-hi-dzfwgl4wj601ahyb.gif"
  },

  // ==========================================
  // --- HAHA / CƯỜI VUI 😂 ---
  // ==========================================
  {
    id: "gif-haha-1",
    title: "Mèo cười thả ga",
    category: "haha",
    tags: ["cười", "haha", "funny", "laugh", "lol", "vui", "hài", "mèo"],
    url: "https://media.tenor.com/2roX3uxz_68AAAAM/cat-laugh.gif",
    previewUrl: "https://media.tenor.com/2roX3uxz_68AAAAM/cat-laugh.gif"
  },
  {
    id: "gif-haha-2",
    title: "Minions cười nghiêng ngả",
    category: "haha",
    tags: ["cười", "haha", "minion", "laughing", "vui"],
    url: "https://media.tenor.com/y1v2l6mD9Z8AAAAM/laughing-minions.gif",
    previewUrl: "https://media.tenor.com/y1v2l6mD9Z8AAAAM/laughing-minions.gif"
  },
  {
    id: "gif-haha-3",
    title: "Cười đắc ý hehe",
    category: "haha",
    tags: ["cười", "haha", "funny", "smile", "smirk"],
    url: "https://media.tenor.com/T_490Q_j9pEAAAAM/hehe-laugh.gif",
    previewUrl: "https://media.tenor.com/T_490Q_j9pEAAAAM/hehe-laugh.gif"
  },
  {
    id: "gif-haha-4",
    title: "Tom & Jerry cười sảng khoái",
    category: "haha",
    tags: ["cười", "haha", "tom", "jerry", "hilarious"],
    url: "https://media.tenor.com/Z6jWcZ6w1VwAAAAM/tom-and-jerry-laughing.gif",
    previewUrl: "https://media.tenor.com/Z6jWcZ6w1VwAAAAM/tom-and-jerry-laughing.gif"
  },

  // ==========================================
  // --- LOVE / THẢ TIM ❤️ ---
  // ==========================================
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
    title: "Mắt trái tim mê mẩn",
    category: "love",
    tags: ["thích", "mê", "love", "heart eyes", "crush"],
    url: "https://media.tenor.com/eB_G2z2pE9oAAAAM/heart-eyes-love.gif",
    previewUrl: "https://media.tenor.com/eB_G2z2pE9oAAAAM/heart-eyes-love.gif"
  },

  // ==========================================
  // --- DANCE / NHẢY MÚA 💃 ---
  // ==========================================
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

  // ==========================================
  // --- PARTY / CHÚC MỪNG 🎉 ---
  // ==========================================
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

  // ==========================================
  // --- AGREE / LIKE / ĐỒNG Ý 👍 ---
  // ==========================================
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

  // ==========================================
  // --- SAD / BUỒN / KHÓC 😭 ---
  // ==========================================
  {
    id: "gif-sad-1",
    title: "Khóc ròng nước mắt",
    category: "sad",
    tags: ["khóc", "buồn", "cry", "sad", "nước mắt", "dỗi"],
    url: "https://media.tenor.com/rM9N6wXy7qUAAAAM/crying-sad.gif",
    previewUrl: "https://media.tenor.com/rM9N6wXy7qUAAAAM/crying-sad.gif"
  },
  {
    id: "gif-sad-2",
    title: "Mèo con buồn cô đơn",
    category: "sad",
    tags: ["buồn", "sad", "cô đơn", "tủi thân", "mưa", "mèo"],
    url: "https://media.tenor.com/z0jK7f7Q6xMAAAAM/cat-sad.gif",
    previewUrl: "https://media.tenor.com/z0jK7f7Q6xMAAAAM/cat-sad.gif"
  },

  // ==========================================
  // --- BYE / CHÀO / TẠM BIỆT 👋 ---
  // ==========================================
  {
    id: "gif-bye-1",
    title: "Vẫy tay chào vui vẻ",
    category: "bye",
    tags: ["chào", "bye", "hi", "hello", "tạm biệt", "vẫy tay"],
    url: "https://media.tenor.com/a4g2qQ5u5eIAAAAM/waving-hello.gif",
    previewUrl: "https://media.tenor.com/a4g2qQ5u5eIAAAAM/waving-hello.gif"
  },
  {
    id: "gif-bye-2",
    title: "Hẹn gặp lại nhé",
    category: "bye",
    tags: ["tạm biệt", "bye", "see you", "ngủ ngon", "goodbye"],
    url: "https://media.tenor.com/k9m6M1x2w4UAAAAM/bye-goodbye.gif",
    previewUrl: "https://media.tenor.com/k9m6M1x2w4UAAAAM/bye-goodbye.gif"
  }
];

const CATEGORIES = [
  { id: "all", name: "🔥 Thịnh hành" },
  { id: "bubu", name: "🐼 Bubu & Dudu" },
  { id: "cute", name: "🐱 Cưng xỉu" },
  { id: "love", name: "❤️ Thả tim" },
  { id: "haha", name: "😂 Cười vui" },
  { id: "dance", name: "💃 Nhảy múa" },
  { id: "agree", name: "👍 Đồng ý" },
  { id: "party", name: "🎉 Chúc mừng" },
  { id: "sad", name: "😭 Buồn dỗi" },
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

exports.searchGifs = function (query = "", category = "all", limit = 60) {
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
