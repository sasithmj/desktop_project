import React, { useEffect, useState } from "react";
import RemoteConnect from "../src/screens/RemortConnect.jsx";
import SetupScreen from "../src/screens/SetupScreen.jsx";
import FullScreenPlayer from "./screens/FullScreenPlayer.jsx";
import Login from "./screens/Login.jsx";

export default function App() {
  const [configExists, setConfigExists] = useState(null); // null = loading, true/false = result
  const [currentScreen, setCurrentScreen] = useState("main"); // "main" or "setup"

  const navigate = (screen) => {
    setCurrentScreen(screen);
  };

  const handleConfigSaved = () => {
    // When configuration is saved, update the state to show main app
    setConfigExists(true);
  };

  const refreshConfig = async () => {
    setConfigExists(null); // Set to loading state
    try {
      const config = await window.electronAPI.getDeviceConfig();
      if (config && config.dbConfig && config.deviceConfig) {
        console.log("Configuration found:", config);
        setConfigExists(true);
      } else {
        console.log("Configuration incomplete or missing:", config);
        setConfigExists(false);
      }
    } catch (error) {
      console.error("Error checking device config:", error);
      setConfigExists(false);
    }
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  if (configExists === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading configuration...</p>
      </div>
    );
  }

  // If no configuration exists, always show setup screen
  if (!configExists) {
    return (
      <SetupScreen onNavigate={navigate} onConfigSaved={handleConfigSaved} />
    );
  }

  // If configuration exists, show based on current screen
  if (currentScreen === "setup") {
    return (
      <SetupScreen onNavigate={navigate} onConfigSaved={handleConfigSaved} />
    );
  }
  if (currentScreen === "login") {
    return <Login onNavigate={navigate} />;
  }
  if (currentScreen === "fullscreen") {
    return (
      <FullScreenPlayer
        onNavigate={navigate}
        onConfigSaved={handleConfigSaved}
      />
    );
  }

  return (
    <RemoteConnect onNavigate={navigate} onRefreshConfig={refreshConfig} />
  );
}
