export const SchedulerClient = {
  start(scrId) {
    return window.electronAPI.startContentScheduler({ scrId });
  },
  stop(scrId) {
    return window.electronAPI.stopContentScheduler(scrId);
  },
  status(scrId) {
    return window.electronAPI.getSchedulerStatus(scrId);
  },
  getCurrent(scrId) {
    return window.electronAPI.getCurrentContent(scrId);
  },
};
