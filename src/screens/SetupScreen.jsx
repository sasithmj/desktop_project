import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Settings,
  Database,
  Monitor,
  ArrowLeft,
  MapPin,
} from "lucide-react";

export default function SetupScreen({ onNavigate, onConfigSaved }) {
  const [deviceConfig, setDeviceConfig] = useState({
    macAddress: "",
    scrId: "",
    scrName: "",
    scrLoc: "",
    ipAddress: "",
    createdBy: "",
    scrStatus: "SC1",
    plantCode: "",
  });

  const [plantcodes, setPlantCodeIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDeviceData, setLoadingDeviceData] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);



  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
  
        // 1️⃣ Load MAC Address
        const macResult = await window.electronAPI.getMacAddress();
        console.log("MAC Address:", macResult);
  
        if (!macResult) {
          throw new Error("MAC Address not found");
        }
  
        // Update deviceConfig with MAC immediately
        setDeviceConfig((prev) => ({ ...prev, macAddress: macResult }));
  
        // 2️⃣ Fetch device info using the MAC
        const deviceResult = await window.electronAPI.getDeviceByMac(macResult);
        console.log("Device info:", deviceResult);
  
        if (deviceResult?.device) {
          const device = deviceResult.device;
          setDeviceConfig((prev) => ({
            ...prev,
            scrId: device.ScrID,
            plantId: device.PlantCode,
            scrName: device.ScrName,
            scrLoc: device.ScrLoc,
            ipAddress: device.IPAddress,
            createdBy: device.CreatedBy,
            plantCode: device.PlantCode,
          }));
        }
  
        // 3️⃣ Load plant codes (SOAP call)
        const plantcodeResults = await window.electronAPI.getPlantCodes();
        console.log("Plant codes:", plantcodeResults);
  
        setPlantCodeIds(
          plantcodeResults?.success ? plantcodeResults.data : []
        );
  
        // 4️⃣ Set status for UI
        setStatus({
          type: "info",
          message: "Device setup ready. Fill details and save.",
        });
      } catch (error) {
        console.error("Init error:", error);
        setStatus({
          type: "error",
          message: "Failed to load initial data",
        });
        setPlantCodeIds([]);
      } finally {
        setLoading(false);
      }
    };
  
    init();
  }, []);
  

  const handleTestConnection = () => {
    // Save the action we want to do after login
    setPendingAction(() => handleSave);
    setShowLoginModal(true);
  };

  const handleDeviceChange = (e) => {
    const { name, value } = e.target;
    setDeviceConfig((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (status.message) setStatus({ type: "", message: "" });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus({ type: "", message: "" });

    console.log("device config for soap: ",deviceConfig)

    try {
      const result = await window.electronAPI.registerDeviceSOAP(deviceConfig);

      if (result.success) {
        setStatus({
          type: "success",
          message: "Device registered successfully!",
        });

        if (onConfigSaved) onConfigSaved();
        setTimeout(() => {
          if (onNavigate) onNavigate("main");
        }, 1500);
      } else {
        setStatus({
          type: "error",
          message: `Failed to register: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Save error:", error);
      setStatus({
        type: "error",
        message: "Error registering device",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = () => {
    switch (status.type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "info":
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status.type) {
      case "success":
        return "text-green-600 bg-green-50 border-green-200";
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      case "info":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 flex items-center space-x-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <div className="text-gray-700 text-xl font-medium">
            Loading setup...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-[800px] overflow-hidden">
      <div className="w-[800px] h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="text-center p-6 border-b border-gray-100 relative">
          <div className="absolute top-4 right-4 cursor-pointer text-gray-500 hover:text-gray-700">
            <Settings className="w-5 h-5" />
          </div>
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            Device Setup (SOAP)
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {status.message && (
            <div
              className={`mb-4 p-3 rounded-lg border flex items-center space-x-3 ${getStatusColor()}`}
            >
              {getStatusIcon()}
              <span className="font-medium text-sm">{status.message}</span>
            </div>
          )}

          {/* Device Config Form */}
          <div className="flex flex-col gap-4 p-4 rounded-lg border bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold mb-3 flex items-center text-blue-500">
              <Monitor className="w-5 h-5 mr-2" />
              Device Configuration
            </h3>

            <div className="space-y-3">
              {/* MAC */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  MAC Address
                </label>
                <input
                  type="text"
                  name="macAddress"
                  value={deviceConfig.macAddress || ""}
                  onChange={handleDeviceChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  disabled
                />
              </div>

              {/* Screen Name */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Screen Name *
                </label>
                <input
                  type="text"
                  name="scrName"
                  value={deviceConfig.scrName || ""}
                  onChange={handleDeviceChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Screen Location *
                </label>
                <input
                  type="text"
                  name="scrLoc"
                  value={deviceConfig.scrLoc || ""}
                  onChange={handleDeviceChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* IP */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  name="ipAddress"
                  value={deviceConfig.ipAddress || ""}
                  onChange={handleDeviceChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Created By */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Created By
                </label>
                <input
                  type="text"
                  name="createdBy"
                  value={deviceConfig.createdBy || ""}
                  onChange={handleDeviceChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Plant */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Plant Location
                  {loadingDeviceData && (
                    <Loader2 className="w-3 h-3 animate-spin inline ml-2" />
                  )}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    name="plantCode"
                    value={deviceConfig.plantCode || ""}
                    onChange={handleDeviceChange}
                    disabled={loadingDeviceData}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">
                      {loadingDeviceData
                        ? "Loading plant locations..."
                        : "Select a plant location"}
                    </option>
                    {plantcodes.map((plant, index) => (
                      <option key={index} value={plant.PlantCode}>
                        {plant.PlantCode} - {plant.PlantName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {showLoginModal && (
        <Login
          onNavigate={onNavigate}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            if (pendingAction) pendingAction();
          }}
        />
      )}
    </div>
  );
}
