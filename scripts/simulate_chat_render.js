const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const dbMsgs = await prisma.messages.findMany({
    where: { conversationId: '8b9b9cbe-fbff-413a-82a2-2c1fc1e38fc0' },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Loaded ${dbMsgs.length} messages from DB`);

  // Map Prisma DB messages to Dart2js MessageModel representation
  // In Dart2js MessageModel (A.k1):
  // a: id
  // b: conversationId
  // c: senderId
  // d: type ("text", "image", etc.)
  // e: content
  // f: imageUrl
  // r: audioUrl/videoUrl
  // w: isRead
  // x: isDelivered
  // y: isRecalled
  // z: replyMessageId
  // Q: reactions
  // as: { a: timestamp_ms }
  const dartMsgs = dbMsgs.map(m => ({
    a: m.id,
    b: m.conversationId,
    c: m.senderId,
    d: m.type,
    e: m.content,
    f: m.imageUrl,
    r: m.videoUrl,
    w: false,
    x: false,
    y: m.isRecalled,
    z: null,
    Q: null,
    as: { a: new Date(m.createdAt).getTime() },
    status: 'sent'
  }));

  // Now, simulate the user sending 1 NEW IMAGE:
  // An optimistic message is added at the end of the list:
  const optMsg = {
    a: 'optimistic-' + Date.now() + '-abcde',
    b: '8b9b9cbe-fbff-413a-82a2-2c1fc1e38fc0',
    c: 'efe1bee5-f9df-46ce-83b6-50127a2334bd',
    d: 'image',
    e: 'data:image/jpeg;base64,...',
    f: 'data:image/jpeg;base64,...',
    r: null,
    w: false,
    x: false,
    y: false,
    z: null,
    Q: null,
    as: { a: Date.now() },
    status: 'sending',
    clientTempId: 'optimistic-' + Date.now() + '-abcde'
  };

  const msgsWithOpt = [...dartMsgs, optMsg];
  console.log(`Total messages with optimistic: ${msgsWithOpt.length}`);

  // Test the exact _checkImg function from main.dart.js:
  function _checkImg(m) {
    if (!m) return false;
    if (m.status === "sending" || (m.a && (typeof m.a === "string") && (m.a.indexOf("optimistic-") === 0 || m.a.indexOf("uploading-") === 0 || m.a.indexOf("temp_") === 0))) return false;
    var t = m.d; if (t === "image") return true;
    var c = (m.e || "").toLowerCase(), u = m.f || "";
    if (c.indexOf("data:image") === 0 || u.length > 0) return true;
    return c.indexOf(".jpg") !== -1 || c.indexOf(".jpeg") !== -1 || c.indexOf(".png") !== -1 || c.indexOf(".webp") !== -1 || c.indexOf(".gif") !== -1 || c.indexOf(".jfif") !== -1 || c.indexOf(".heic") !== -1 || c.indexOf(".heif") !== -1 || c.indexOf(".avif") !== -1 || c.indexOf(".bmp") !== -1 || c.indexOf("/chat-media/") !== -1 || c.indexOf("/images/") !== -1;
  }

  // Simulate A.au_.$2 clustering logic for each item
  const results = [];
  const f = msgsWithOpt;

  for (let a0 = 0; a0 < f.length; a0++) {
    const e = f[a0];
    let renderedAs = 'normal_bubble';

    if (_checkImg(e)) {
      // Check if skipped as part of cluster
      if (a0 > 0 && f[a0 - 1] && _checkImg(f[a0 - 1]) && f[a0 - 1].c === e.c) {
        var _tPrev = (f[a0 - 1].as && typeof f[a0 - 1].as.a === "number") ? f[a0 - 1].as.a : 0;
        var _tCur = (e.as && typeof e.as.a === "number") ? e.as.a : 0;
        if (Math.abs(_tCur - _tPrev) < 60000) {
          renderedAs = 'HIDDEN_B_AU (skipped in cluster)';
        }
      }

      if (renderedAs !== 'HIDDEN_B_AU (skipped in cluster)') {
        var _cl = [e];
        for (var _ck = a0 + 1; _ck < f.length; _ck++) {
          var _nxt = f[_ck];
          if (_nxt && _checkImg(_nxt) && _nxt.c === e.c) {
            var _t1 = (_cl[_cl.length - 1].as && typeof _cl[_cl.length - 1].as.a === "number") ? _cl[_cl.length - 1].as.a : 0;
            var _t2 = (_nxt.as && typeof _nxt.as.a === "number") ? _nxt.as.a : 0;
            if (Math.abs(_t2 - _t1) < 60000) _cl.push(_nxt);
            else break;
          } else break;
        }

        if (_cl.length >= 2) {
          renderedAs = `ALBUM_DECK of ${_cl.length} photos`;
        } else {
          renderedAs = 'single_photo_bubble';
        }
      }
    } else {
      if (e.status === 'sending') {
        renderedAs = 'SENDING_OPTIMISTIC_IMAGE';
      } else {
        renderedAs = `text_or_other (${e.d})`;
      }
    }

    results.push({ index: a0, id: e.a, isRecalled: e.y, renderedAs });
  }

  console.table(results);
}

main().finally(() => prisma.$disconnect());
