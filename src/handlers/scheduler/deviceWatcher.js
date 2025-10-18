module.exports = function createDeviceWatcher(handler, scrId, onReactivated) {
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
        if (typeof onReactivated === "function") onReactivated();
        await handler.checkAndUpdateContent(scrId, true);
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
