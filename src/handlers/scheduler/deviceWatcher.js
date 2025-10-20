module.exports = function createDeviceWatcher(
  handler,
  scrId,
  onReactivated,
  onStartPlaybackTimer
) {
  let lastDeviceStatus = null;

  const interval = setInterval(async () => {
    try {
      const deviceStatus = await handler.checkDeviceStatus(scrId);
      const isDeviceActive = deviceStatus && deviceStatus.isActive;

      if (!isDeviceActive && lastDeviceStatus !== false) {
        console.warn(
          `[${scrId}] Device deactivated - showing deactivation message`
        );
        const deactivatedContent = handler.getDeviceDeactivatedContent(scrId);
        handler.currentPlayingContent.set(scrId, deactivatedContent);
        await handler.safeUpdateWindow(scrId, deactivatedContent.Source);
        lastDeviceStatus = false;
      } else if (isDeviceActive && lastDeviceStatus === false) {
        console.log(`[${scrId}] Device reactivated - reloading content`);
        handler.isOfflineMode.set(scrId, false);
        handler.cachedContentList.delete(scrId);
        handler.defaultIndex.set(scrId, 0);
        handler.currentPlayingContent.delete(scrId);

        // Set flag to prevent DB watcher from interfering
        handler.isDeviceReactivating.set(scrId, true);

        // Reset the main refresh interval timer to prevent 1-minute refresh
        if (typeof onReactivated === "function") onReactivated();

        // Clear any existing content timer to prevent duplication
        const existingTimer = handler.contentTimers.get(scrId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          handler.contentTimers.delete(scrId);
          console.log(
            `[${scrId}] Cleared existing content timer during reactivation`
          );
        }

        // Load content immediately and start playback timer
        await handler.checkAndUpdateContent(scrId, true);

        // Start the playback timer when device is reactivated
        if (typeof onStartPlaybackTimer === "function") onStartPlaybackTimer();

        // Clear the flag after a short delay to allow DB watcher to resume
        setTimeout(() => {
          handler.isDeviceReactivating.set(scrId, false);
          console.log(
            `[${scrId}] Device reactivation complete - DB watcher can resume`
          );
        }, 10000); // Increased to 10 seconds to prevent interference

        lastDeviceStatus = true;
      } else if (isDeviceActive) {
        lastDeviceStatus = true;
      }
    } catch (err) {
      console.error(`[${scrId}] Error in device status watcher:`, err);
    }
  }, 60000);

  return { interval, setLastDevice: (v) => (lastDeviceStatus = v) };
};
