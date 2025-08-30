import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Database,
  Server,
  User,
  Lock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Settings,
  Monitor,
  ArrowLeft,
  Wrench,
  MapPin,
} from "lucide-react";
import Login from "./Login.jsx";

export default function SetupScreen({ onNavigate, onConfigSaved }) {
  const [config, setConfig] = useState({
    server: "",
    database: "",
    user: "",
    password: "",
  });

  const [deviceConfig, setDeviceConfig] = useState({
    macAddress: "",
    scrId: "",
    plantId: "",
    scrName: "",
    scrLoc: "",
    ipAddress: "",
    createdBy: "",
    scrStatus: "",
    onStatus: "",
    plantCode: "",
  });

  const [plantcodes, setPlantCodeIds] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [loadingDeviceData, setLoadingDeviceData] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isDbConfigured, setIsDbConfigured] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [macAddress, setMacAddress] = useState("");
  const [scrId, setscrId] = useState("");
  const [plantId, setPlantId] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.warn("Configuration loading timed out");
        setLoading(false);
        setStatus({
          type: "error",
          message: "Configuration loading timed out. Please try again.",
        });
      }, 10000); // 10 second timeout

      try {
        const result = await window.electronAPI.getDeviceConfig();

        if (result && result.dbConfig) {
          setConfig(result.dbConfig);
          // Check if database is configured by testing if all required fields are present
          const dbConfigured =
            result.dbConfig.server &&
            result.dbConfig.database &&
            result.dbConfig.user &&
            result.dbConfig.password;
          setIsDbConfigured(dbConfigured);
        }
        if (result && result.deviceConfig) {
          setDeviceConfig(result.deviceConfig);
        }

        // Load MAC address
        const macResult = await window.electronAPI.getMacAddress();
        if (macResult) {
          console.log("MAC Address:", macResult);
          setDeviceConfig((prev) => ({ ...prev, macAddress: macResult }));
        }

        // Only load device data if database is configured
        if (isDbConfigured) {
          await loadDeviceData();
        }

        setStatus({
          type: "info",
          message: isDbConfigured
            ? "Configuration loaded successfully. Database is configured."
            : "Please configure database connection first.",
        });
      } catch (error) {
        console.error("Failed to load config:", error);
        setStatus({
          type: "error",
          message: "Failed to load existing configuration",
        });
        setPlantCodeIds([]);
        setLocations([]);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const loadDeviceData = async () => {
    await window.electronAPI.saveDeviceConfig(config);

    setLoadingDeviceData(true);
    try {
      // Load screen IDs
      const device = await window.electronAPI.getDeviceByMac(
        deviceConfig.macAddress
      );

      setDeviceConfig((prev) => ({
        ...prev,
        scrId: device.device.scrID,

        scrId: device.device.ScrID,
        plantId: device.device.ScrID,
        scrName: device.device.ScrName,
        scrLoc: device.device.ScrLoc,
        ipAddress: device.device.IPAddress,
        createdBy: device.device.CreatedBy,
        plantCode: device.device.PlantCode,
      }));

      console.log("Device by MAC:", device);
      console.log("Attempting to load plant codes......");
      const plantcodeResults = await window.electronAPI.getPlantCodes();
      console.log("Screen IDs API response:", plantcodeResults);
      if (
        plantcodeResults &&
        plantcodeResults.success &&
        plantcodeResults.data
      ) {
        console.log("plantcodeResults IDs:", plantcodeResults.data);
        setPlantCodeIds(plantcodeResults.data);
      } else {
        console.warn("Screen IDs result:", plantcodeResults);
        setPlantCodeIds([]);
      }

      // Load locations
      console.log("Attempting to load locations...");
      const locationResult = await window.electronAPI.getLocations();
      console.log("Locations API response:", locationResult);
      if (locationResult && locationResult.success && locationResult.data) {
        console.log("Locations:", locationResult.data);
        setLocations(locationResult.data);
      } else {
        console.warn("Locations result:", locationResult);
        setLocations([]);
      }
    } catch (error) {
      console.warn("Could not load device data:", error);
      setPlantCodeIds([]);
      setLocations([]);
    } finally {
      setLoadingDeviceData(false);
    }
  };

  const validateField = (name, value) => {
    switch (name) {
      case "server":
        return value.trim() ? "" : "Server is required";
      case "database":
        return value.trim() ? "" : "Database name is required";
      case "user":
        return value.trim() ? "" : "Username is required";
      case "password":
        return value.length >= 1 ? "" : "Password is required";
      default:
        return "";
    }
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(config).forEach((key) => {
      const error = validateField(key, config[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    // Clear status when user makes changes
    if (status.message) {
      setStatus({ type: "", message: "" });
    }

    // Reset database configured status when user changes db config
    setIsDbConfigured(false);
    setConnectionStatus(null);
  };

  const handleDeviceChange = (e) => {
    const { name, value } = e.target;
    setDeviceConfig((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear status when user makes changes
    if (status.message) {
      setStatus({ type: "", message: "" });
    }
  };

  const handleTestConnection = () => {
    // Save the action we want to do after login
    setPendingAction(() => runTestConnection);
    setShowLoginModal(true);
  };

  const runTestConnection = async () => {
    if (!validateForm()) {
      setStatus({
        type: "error",
        message: "Please fix validation errors before testing connection",
      });
      return;
    }

    setTesting(true);
    setConnectionStatus(null);

    try {
      const result = await window.electronAPI.testDatabaseConnection(config);

      if (result.success) {
        setConnectionStatus("success");
        setIsDbConfigured(true);
        setStatus({
          type: "success",
          message:
            "Database connection successful! Device configuration is now enabled.",
        });

        // Load device data after successful connection
        await loadDeviceData();
      } else {
        setConnectionStatus("error");
        setIsDbConfigured(false);
        setStatus({
          type: "error",
          message: `Connection failed: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      setConnectionStatus("error");
      setIsDbConfigured(false);
      setStatus({
        type: "error",
        message: "Error testing database connection",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDiagnoseConnection = async () => {
    setDiagnosing(true);
    setStatus({ type: "", message: "" });

    try {
      const result = await window.electronAPI.runDatabaseDiagnostics();
      if (result.success) {
        setStatus({
          type: "success",
          message: "Diagnostics completed. Check console for details.",
        });
      } else {
        setStatus({
          type: "error",
          message: result.error || "Diagnostics failed",
        });
      }
    } catch (error) {
      console.error("Diagnostics error:", error);
      setStatus({
        type: "error",
        message: error.message || "Diagnostics failed",
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setStatus({
        type: "error",
        message: "Please fix validation errors before saving",
      });
      return;
    }

    if (!isDbConfigured) {
      setStatus({
        type: "error",
        message: "Please test and verify database connection before saving",
      });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const result = await window.electronAPI.saveDeviceConfig({
        dbConfig: config,
        deviceConfig: deviceConfig,
      });

      if (result.success) {
        setStatus({
          type: "success",
          message: "Configuration saved successfully!",
        });

        // Call onConfigSaved callback to update parent state
        if (onConfigSaved) {
          onConfigSaved();
        }

        // Navigate after a brief delay to show success message
        setTimeout(() => {
          if (onNavigate) onNavigate();
        }, 1500);
      } else {
        setStatus({
          type: "error",
          message: `Failed to save: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Error saving config:", error);
      setStatus({
        type: "error",
        message: "Error saving configuration",
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
            Loading configuration...
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
            Device Setup
          </h2>
          <p className="text-gray-600 text-sm">
            Configure your database connection first, then setup device
          </p>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Status Message */}
          {status.message && (
            <div
              className={`mb-4 p-3 rounded-lg border flex items-center space-x-3 ${getStatusColor()}`}
            >
              {getStatusIcon()}
              <span className="font-medium text-sm">{status.message}</span>
            </div>
          )}

          {/* Form */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Database Configuration Section - Now on Left */}
            <div className="flex-1 bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Database Configuration
                <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded-full ml-2">
                  Step 1
                </span>
              </h3>

              <div className="space-y-3">
                {/* Server Field */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Database Server
                  </label>
                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="server"
                      value={config.server}
                      onChange={handleChange}
                      placeholder="e.g., MSI\\SQLEXPRESS or localhost"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                        errors.server
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                  </div>
                  {errors.server && (
                    <p className="mt-1 text-xs text-red-600">{errors.server}</p>
                  )}
                </div>

                {/* Database Field */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Database Name
                  </label>
                  <div className="relative">
                    <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="database"
                      value={config.database}
                      onChange={handleChange}
                      placeholder="Enter database name"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                        errors.database
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                  </div>
                  {errors.database && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.database}
                    </p>
                  )}
                </div>

                {/* Username Field */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="user"
                      value={config.user}
                      onChange={handleChange}
                      placeholder="Database username"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                        errors.user
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                  </div>
                  {errors.user && (
                    <p className="mt-1 text-xs text-red-600">{errors.user}</p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={config.password}
                      onChange={handleChange}
                      placeholder="Database password"
                      className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                        errors.password
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Connection Status in DB Section */}
                {connectionStatus && (
                  <div className="mt-3 p-2 rounded-lg border flex items-center space-x-2">
                    {connectionStatus === "success" ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 font-medium text-xs">
                          Connected ✓
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-600 font-medium text-xs">
                          Connection failed
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Device Configuration Section - Now on Right */}
            <div
              className={`flex-1 p-4 rounded-lg border transition-all ${
                isDbConfigured
                  ? "bg-blue-50 border-blue-200"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-3 flex items-center ${
                  isDbConfigured ? "text-blue-800" : "text-gray-500"
                }`}
              >
                <Monitor className="w-5 h-5 mr-2" />
                Device Configuration
                <span
                  className={`text-xs px-2 py-1 rounded-full ml-2 ${
                    isDbConfigured
                      ? "bg-blue-200 text-blue-700"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  Step 2
                </span>
                {!isDbConfigured && (
                  <Lock className="w-4 h-4 ml-2 text-gray-400" />
                )}
              </h3>

              {!isDbConfigured && (
                <div className="mb-3 p-2 bg-yellow-100 border border-yellow-300 rounded-lg">
                  <p className="text-xs text-yellow-700 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Complete database configuration and test connection first
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {/* MAC Address Field */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      isDbConfigured ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    MAC Address
                  </label>
                  <input
                    type="text"
                    name="macAddress"
                    value={deviceConfig.macAddress || ""}
                    onChange={handleDeviceChange}
                    disabled={!isDbConfigured}
                    placeholder="Enter MAC address (e.g., 00:14:22:01:23:45)"
                    pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      !isDbConfigured
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white"
                    }`}
                  />
                </div>
                {/* Screen Name Field */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      isDbConfigured ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Screen Name *
                  </label>
                  <input
                    type="text"
                    name="scrName"
                    value={deviceConfig.scrName || ""}
                    onChange={handleDeviceChange}
                    disabled={!isDbConfigured}
                    placeholder="Enter screen name (e.g., Screen One)"
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      !isDbConfigured
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white"
                    }`}
                  />
                </div>

                {/* Screen Location Field */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      isDbConfigured ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Screen Location *
                  </label>
                  <input
                    type="text"
                    name="scrLoc"
                    value={deviceConfig.scrLoc || ""}
                    onChange={handleDeviceChange}
                    disabled={!isDbConfigured}
                    placeholder="Enter location (e.g., Lobby, Conference Room)"
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      !isDbConfigured
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white"
                    }`}
                  />
                </div>

                {/* IP Address Field */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      isDbConfigured ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    IP Address
                  </label>
                  <input
                    type="text"
                    name="ipAddress"
                    value={deviceConfig.ipAddress || ""}
                    onChange={handleDeviceChange}
                    disabled={!isDbConfigured}
                    placeholder="Enter IP address (e.g., 192.168.1.10)"
                    pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      !isDbConfigured
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white"
                    }`}
                  />
                </div>

                {/* Created By Field */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      isDbConfigured ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Created By
                  </label>
                  <input
                    type="text"
                    name="createdBy"
                    value={deviceConfig.createdBy || ""}
                    onChange={handleDeviceChange}
                    disabled={!isDbConfigured}
                    placeholder="Enter creator name (e.g., Admin)"
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      !isDbConfigured
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white"
                    }`}
                  />
                </div>

                {/* Plant Location Field (Dropdown) */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      isDbConfigured ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Plant Location *
                    {loadingDeviceData && (
                      <Loader2 className="w-3 h-3 animate-spin inline ml-2" />
                    )}
                  </label>
                  <div className="relative">
                    <MapPin
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                        isDbConfigured ? "text-gray-400" : "text-gray-300"
                      }`}
                    />
                    <select
                      name="plantCode"
                      value={deviceConfig.plantCode || ""}
                      onChange={handleDeviceChange}
                      disabled={!isDbConfigured || loadingDeviceData}
                      className={`w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                        !isDbConfigured || loadingDeviceData
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-white"
                      }`}
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

          {/* Help Text */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm">
              Setup Instructions:
            </h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>
                • <strong>Step 1:</strong> Configure and test your database
                connection
              </li>
              <li>
                • <strong>Step 2:</strong> Select screen ID and plant location
                (enabled after DB connection)
              </li>
              <li>
                • For SQL Server Express: Use format like "COMPUTER\\SQLEXPRESS"
              </li>
              <li>• For local instances: Use "localhost" or "127.0.0.1"</li>
              <li>• Ensure SQL Server is running and accepts connections</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex space-x-3">
            {/* Back to App button - only show if we have existing config */}
            {config.server && config.database && (
              <button
                onClick={() => onNavigate && onNavigate("main")}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to App</span>
              </button>
            )}

            <button
              onClick={handleDiagnoseConnection}
              disabled={diagnosing || saving}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              {diagnosing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Diagnosing...</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>Diagnose</span>
                </>
              )}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={testing || saving}
              className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            <button
              onClick={handleSave}
              disabled={saving || testing || !isDbConfigured}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-sm ${
                !isDbConfigured
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white"
              }`}
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
