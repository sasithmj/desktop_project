module.exports = {
  clampInterval(ms, fallback = 60000) {
    if (!Number.isFinite(ms) || ms < 10000) {
      return Math.max(ms || 0, fallback);
    }
    return ms;
  },
};
