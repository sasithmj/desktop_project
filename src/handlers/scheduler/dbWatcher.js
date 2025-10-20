const DatabaseService = require("../../database.js");

module.exports = function createDbWatcher(handler, scrId) {
  const interval = setInterval(async () => {
    try {
      if (handler.isOfflineMode.get(scrId)) {
        console.log(`[${scrId}] Skipping DB check - offline mode`);
        return;
      }

      if (handler.isDeviceReactivating.get(scrId)) {
        console.log(
          `[${scrId}] Skipping DB check - device reactivation in progress`
        );
        return;
      }

      console.log(`[${scrId}] 🔍 Checking for database changes...`);
      const changeResult = await handler.hasContentChanged(scrId);

      if (changeResult.changed) {
        console.log(`[${scrId}] 🔄 DB Content changed - updating cache`);

        handler.cachedContentList.set(scrId, changeResult.newContent);
        handler.contentHashMap.set(scrId, changeResult.newHash);

        const isCurrentValid = handler.isCurrentContentStillValid(
          scrId,
          changeResult.newContent
        );

        if (!isCurrentValid) {
          console.log(
            `[${scrId}] Current content invalid - switching to new content`
          );
          await handler.checkAndUpdateContent(scrId, true);
        } else {
          console.log(
            `[${scrId}] Current content still valid - continuing without interruption`
          );
        }
      } else {
        console.log(`[${scrId}] ✓ No database changes detected`);
      }
    } catch (err) {
      console.error(`[${scrId}] Error in DB check interval:`, err);
    }
  }, 60000);

  return interval;
};
