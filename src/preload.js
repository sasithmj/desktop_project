const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Device Management
  getMacAddress: () => ipcRenderer.invoke("get-mac-address"),
  connectToDB: () => ipcRenderer.invoke("connect-to-db"),
  saveDeviceConfig: (config) =>
    ipcRenderer.invoke("save-device-config", config),
  getDeviceConfig: () => ipcRenderer.invoke("get-device-config"),
  checkDeviceExists: (macAddress) =>
    ipcRenderer.invoke("check-device-exists", macAddress),
  getDeviceByMac: (macAddress) =>
    ipcRenderer.invoke("get-device-by-mac", macAddress),
  registerDevice: (deviceInfo) =>
    ipcRenderer.invoke("register-device", deviceInfo),
  updateDeviceStatus: (customId, isOnline) =>
    ipcRenderer.invoke("update-device-status", customId, isOnline),

  // Database Configuration
  testDatabaseConnection: (config) =>
    ipcRenderer.invoke("test-database-connection", config),
  saveDatabaseConfig: (config) =>
    ipcRenderer.invoke("save-database-config", config),
  getDatabaseConfig: () => ipcRenderer.invoke("get-database-config"),
  runDatabaseDiagnostics: () => ipcRenderer.invoke("run-database-diagnostics"),

  // Content Management
  displayUrl: (url) => ipcRenderer.invoke("display-url", url),
  closeDisplay: () => ipcRenderer.invoke("close-display"),
  fetchContentItems: (customId) =>
    ipcRenderer.invoke("fetch-content-items", customId),
  getCurrentContent: (customId) =>
    ipcRenderer.invoke("get-current-content", customId),

  // Enhanced Content Management
  addContentItem: (contentData) =>
    ipcRenderer.invoke("add-content-item", contentData),
  updateContentItem: (id, updates) =>
    ipcRenderer.invoke("update-content-item", { id, updates }),
  deleteContentItem: (id) => ipcRenderer.invoke("delete-content-item", id),
  getScheduledContent: (customId) =>
    ipcRenderer.invoke("get-scheduled-content", customId),
  getDefaultContent: (customId) =>
    ipcRenderer.invoke("get-default-content", customId),
  getLiveContent: (customId) =>
    ipcRenderer.invoke("get-live-content", customId),
  getContentByType: (params) =>
    ipcRenderer.invoke("get-content-by-type", params),
  getContentByScrId: (params) =>
    ipcRenderer.invoke("get-content-by-scrid", params),
  bulkUpdateContent: (params) =>
    ipcRenderer.invoke("bulk-update-content", params),
  validateContentSchedule: (params) =>
    ipcRenderer.invoke("validate-content-schedule", params),

  // Location and Screen Management
  getLocations: () => ipcRenderer.invoke("get-locations"),
  getScreenIds: () => ipcRenderer.invoke("get-screenids"),
  getPlantCodes: () => ipcRenderer.invoke("get-plantcodes"),


  // Window Management
  openSettings: () => ipcRenderer.invoke("open-settings", "network"),
  toggleControlPanel: () => ipcRenderer.invoke("toggle-control-panel"),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  showQuitDialog: () => ipcRenderer.invoke("show-quit-dialog"),

  // Content Scheduler
  startContentScheduler: (config) =>
    ipcRenderer.invoke("start-content-scheduler", config),
  stopContentScheduler: () => ipcRenderer.invoke("stop-content-scheduler"),
  getSchedulerStatus: () => ipcRenderer.invoke("get-scheduler-status"),
  updateRefreshInterval: (interval) =>
    ipcRenderer.invoke("update-refresh-interval", interval),

  // System Information
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  getNetworkInfo: () => ipcRenderer.invoke("get-network-info"),

  // Logging and Diagnostics
  getApplicationLogs: () => ipcRenderer.invoke("get-application-logs"),
  clearApplicationLogs: () => ipcRenderer.invoke("clear-application-logs"),
  exportLogs: (format) => ipcRenderer.invoke("export-logs", format),

  // Configuration Management
  exportConfiguration: () => ipcRenderer.invoke("export-configuration"),
  importConfiguration: (configData) =>
    ipcRenderer.invoke("import-configuration", configData),
  resetConfiguration: () => ipcRenderer.invoke("reset-configuration"),

  // Real-time Updates
  onContentUpdate: (callback) => ipcRenderer.on("content-update", callback),
  onDeviceStatusChange: (callback) =>
    ipcRenderer.on("device-status-change", callback),
  onDatabaseConnectionChange: (callback) =>
    ipcRenderer.on("database-connection-change", callback),

  loginAttempt: (creds) => ipcRenderer.invoke("login-attempt", creds),
  updateLoginCredentials: (creds) =>
    ipcRenderer.invoke("update-login-credentials", creds),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
