// Mobile permission prompts and network handoffs can briefly drop signaling.
function createCallDisconnectGrace({delayMs = 15000, setTimer = setTimeout, clearTimer = clearTimeout} = {}) {
  const pending = new Map();
  function cancel(userId) {
    const record = pending.get(userId);
    if (!record) return false;
    clearTimer(record.timer);
    pending.delete(userId);
    return true;
  }
  function schedule(userId, expire) {
    cancel(userId);
    const record = {};
    record.timer = setTimer(() => {
      if (pending.get(userId) !== record) return;
      pending.delete(userId);
      expire();
    }, delayMs);
    record.timer?.unref?.();
    pending.set(userId, record);
  }
  return {cancel, schedule};
}
module.exports = {createCallDisconnectGrace};
