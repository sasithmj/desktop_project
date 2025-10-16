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
import { SchedulerClient } from "../utils/schedulerClient.js";

export default function RemoteConnect({ onNavigate }) {
  const [deviceConfig, setDeviceConfig] = useState({
    macAddress: "",
    scrId: "",
    scrName: "",
    scrLoc: "",
    ipAddress: "",
    createdBy: "",
    scrStatus: "",
    plantCode: "",
  });
  const [currentContent, setCurrentContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState("stopped");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const config = await window.electronAPI.getDeviceConfig();
        if (config) {
          setDeviceConfig((prev) => ({
            ...prev,
            scrId: config.ScrID,
            macAddress: config.MACAddress,
            plantId: config.PlantCode,
            scrName: config.ScrName,
            scrLoc: config.ScrLoc,
            ipAddress: config.IPAddress,
            createdBy: config.CreatedBy,
            plantCode: config.PlantCode,
          }));
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  useEffect(() => {
    if (!deviceConfig?.scrId) return;
    (async () => {
      try {
        const res = await SchedulerClient.getCurrent(deviceConfig.scrId);
        if (res?.data) setCurrentContent(res.data);
        if (res?.success) {
          const startRes = await SchedulerClient.start(deviceConfig.scrId);
          if (startRes?.success) {
            setSchedulerStatus("running");
            setConnectionStatus(
              startRes.isOffline ? "disconnected" : "connected"
            );
            setLastUpdate(new Date());
          }
        }
      } catch {
        setConnectionStatus("error");
      } finally {
        setLoading(false);
      }
    })();
  }, [deviceConfig?.scrId]);

  const toggleScheduler = async () => {
    try {
      if (schedulerStatus === "running") {
        await SchedulerClient.stop(deviceConfig.scrId);
        setSchedulerStatus("stopped");
      } else {
        const res = await SchedulerClient.start(deviceConfig.scrId);
        if (res?.success) {
          setSchedulerStatus("running");
          setConnectionStatus(res.isOffline ? "disconnected" : "connected");
          setLastUpdate(new Date());
        }
      }
    } catch {
      // keep UI stable
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
    const value = Number.isFinite(minutes) ? minutes : 0;
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

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

              <button
                onClick={() => onNavigate("setup")}
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
                ) : currentContent && currentContent.length > 0 ? (
                  <div className="space-y-6">
                    {currentContent.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-4 border-b pb-4 last:border-0"
                      >
                        {getContentTypeIcon(item.Type)}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {item.Title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.Source}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>Type: {item.Type}</span>
                            <span>Duration: {formatDuration(item.DurMin)}</span>
                            <span>Status: {item.ScheduleType}</span>
                            {item.StartTime ? (
                              <span>
                                Start:{" "}
                                {new Date(item.StartTime).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
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
                    {lastUpdate ? lastUpdate.toLocaleString() : "Never"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
