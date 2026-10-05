async function registerPushDevice(prisma, userId, {fcmToken, platform = 'web', deviceId}, userAgent = '') {
  const native = platform === 'ios' || platform === 'android';
  const detectedPlatform = native ? platform :
    (/mobile|android|iphone|ipad|ipod/i.test(userAgent) ? 'web_mobile' : 'web_desktop');
  // Only replace this installation. Other phones belonging to this user remain subscribed.
  if (deviceId) await prisma.userDevices.deleteMany({
    where: {userId, deviceId, fcmToken: {not: fcmToken}}
  });
  await prisma.users.updateMany({
    where: {id: {not: userId}, fcmToken}, data: {fcmToken: null}
  });
  await prisma.userDevices.upsert({
    where: {fcmToken},
    update: {userId, platform: detectedPlatform, deviceId: deviceId || null, updatedAt: new Date()},
    create: {userId, fcmToken, platform: detectedPlatform, deviceId: deviceId || null}
  });
  await prisma.users.update({where: {id: userId}, data: {fcmToken}});
}
module.exports = {registerPushDevice};
