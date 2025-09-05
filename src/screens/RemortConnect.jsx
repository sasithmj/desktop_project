import React, { useState, useEffect } from "react";
import {
  Monitor,
  Settings,
  Play,
  Pause,
  Globe,
  Image,
  Video,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import ContentScheduler from "./ContentScheduler.jsx";

export default function RemoteConnect({ onNavigate, onRefreshConfig }) {
  const [deviceConfig, setDeviceConfig] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState("stopped");
  const [refreshInterval, setRefreshInterval] = useState(1);
  const [showContentScheduler, setShowContentScheduler] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    loadDeviceConfig();
  }, []);

  useEffect(() => {
    if (deviceConfig?.scrId) {
      console.log("Loading device Config..........");
      loadCurrentContent();
    }
  }, [deviceConfig]);

  const loadDeviceConfig = async () => {
    try {
      const config = await window.electronAPI.getDeviceConfig();
      if (config) {
        console.log("Device config loaded:", config);
        setDeviceConfig(config);
        const screenId = await window.electronAPI.getDeviceByMac(
          config.macAddress
        );
      }
    } catch (error) {
      console.error("Error loading device config:", error);
    }
  };

  const loadCurrentContent = async () => {
    try {
      console.log("deviceConfig:", deviceConfig);
      if (deviceConfig?.scrId) {
        console.log(
          "Loading current content for screen ID:",
          deviceConfig.scrId
        );
        const result = await window.electronAPI.getCurrentContent(
          deviceConfig.scrId
        );
        console.log("Current content result:", result);
        if (result.success && result.data) {
          // setCurrentContent(result.data);

          startContentMonitoring(result.data); // pass content
        }
      }
    } catch (error) {
      console.error("Error loading current content:", error);
    } finally {
      setLoading(false);
    }
  };

  const startContentMonitoring = async (contentData) => {
    try {
      if (deviceConfig?.scrId) {
        console.log(
          "Starting content scheduler for device:",
          deviceConfig.scrId
        );

        const result = await window.electronAPI.startContentScheduler({
          scrId: deviceConfig.scrId,
          refreshInterval: refreshInterval * 60 * 1000,
        });

        console.log("Start scheduler result:", result);

        if (result.success) {
          setSchedulerStatus("running");
          setConnectionStatus("connected");
          // setCurrentContent(result.data);
          setLastUpdate(new Date());
        }

        if (result.data) {
          setCurrentContent(result.data);
        }
      }
    } catch (error) {
      console.error("Error starting content monitoring:", error);
      setConnectionStatus("error");
    }
  };

  const toggleScheduler = async () => {
    try {
      if (schedulerStatus === "running") {
        await window.electronAPI.stopContentScheduler(deviceConfig?.scrId);
        setSchedulerStatus("stopped");
      } else {
        await startContentMonitoring();
      }
    } catch (error) {
      console.error("Error toggling scheduler:", error);
    }
  };

  const updateRefreshInterval = async (newInterval) => {
    try {
      await window.electronAPI.updateRefreshInterval({
        scrId: deviceConfig?.scrId,
        interval: newInterval * 60 * 1000,
      });
      setRefreshInterval(newInterval);
    } catch (error) {
      console.error("Error updating refresh interval:", error);
    }
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case "url":
        return <Globe className="w-5 h-5 text-blue-500" />;
      case "image":
        return <Image className="w-5 h-5 text-green-500" />;
      case "video":
        return <Video className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "N/A";
    return (
      dateTime.getUTCFullYear() +
      "-" +
      String(dateTime.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(dateTime.getUTCDate()).padStart(2, "0") +
      " " +
      String(dateTime.getUTCHours()).padStart(2, "0") +
      ":" +
      String(dateTime.getUTCMinutes()).padStart(2, "0") +
      ":" +
      String(dateTime.getUTCSeconds()).padStart(2, "0")
    );
  };

  if (showContentScheduler && deviceConfig?.scrId) {
    return (
      <ContentScheduler
        scrId={deviceConfig.scrId}
        onNavigate={() => setShowContentScheduler(false)}
      />
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Monitor className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Remote Display
                  </h1>
                  <p className="text-sm text-gray-600">
                    Screen ID: {deviceConfig?.scrId || "Not configured"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                {getStatusIcon()}
                <span className="text-sm font-medium text-gray-700">
                  {getStatusText()}
                </span>
              </div>

              {/* Scheduler Status */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleScheduler}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                    schedulerStatus === "running"
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {schedulerStatus === "running" ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Start</span>
                    </>
                  )}
                </button>
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Content Display */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-500" />
                  Current Content
                </h2>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600">
                      Loading content...
                    </span>
                  </div>
                ) : currentContent ? (
                  <div className="space-y-4">
                    <div className="flex items-start space-x-4">
                      {getContentTypeIcon(currentContent.Type)}
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {currentContent.Title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {currentContent.Source}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>Type: {currentContent.Type}</span>
                          <span>
                            Duration: {formatDuration(currentContent.DurMin)}
                          </span>
                          <span>Status: {currentContent.ScheduleType}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">
                      No content currently displayed
                    </p>
                  </div> 
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Quick Actions
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => onNavigate("setup")}
                    className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-gray-500" />
                    <span className="font-medium">Device Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Device Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Device Info
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Screen ID
                  </label>
                  <p className="text-sm text-gray-900">
                    {deviceConfig?.scrId || "Not set"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    MAC Address
                  </label>
                  <p className="text-sm text-gray-900 font-mono">
                    {deviceConfig?.macAddress || "Unknown"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Plant ID
                  </label>
                  <p className="text-sm text-gray-900">
                    {deviceConfig?.plantId || "Not set"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Last Update
                  </label>
                  <p className="text-sm text-gray-900">
                    {lastUpdate ? formatDateTime(lastUpdate) : "Never"}
                  </p>
                </div>
              </div>
            </div>

            {/* Scheduler Settings */}
            {showSettings && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Scheduler Settings
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Refresh Interval
                    </label>
                    <select
                      value={refreshInterval}
                      onChange={(e) =>
                        updateRefreshInterval(parseInt(e.target.value))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value={5}>1 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduler Status
                    </label>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          schedulerStatus === "running"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      />
                      <span className="text-sm text-gray-900 capitalize">
                        {schedulerStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
