module.exports = function createOnlineWatcher(handler, scrId, onOnline) {
  let lastOnlineStatus = null;

  const interval = setInterval(async () => {
    try {
      const online = await handler.checkInternetConnection();

      if (online !== lastOnlineStatus) {
        if (!online) {
          console.warn(
            `[${scrId}] Lost internet - switching to offline content`
          );
          handler.isOfflineMode.set(scrId, true);
          const offlineContent = handler.getDefaultOfflineContent(scrId);
          handler.currentPlayingContent.set(scrId, offlineContent);
          await handler.safeUpdateWindow(scrId, offlineContent.Source);
        } else {
          console.log(`[${scrId}] Internet restored - reloading live content`);
          handler.isOfflineMode.set(scrId, false);
          handler.cachedContentList.delete(scrId);
          await handler.updateRefreshInterval(scrId);
          if (typeof onOnline === "function") onOnline();
          await handler.checkAndUpdateContent(scrId, true);
        }
        lastOnlineStatus = online;
      }
    } catch (err) {
      console.error(`[${scrId}] Error in online watcher:`, err);
    }
  }, 30000);

  return { interval, setLastOnline: (v) => (lastOnlineStatus = v) };
};
