import React, { useEffect, useState } from "react";
import RemoteConnect from "../src/screens/RemortConnect.jsx";
import SetupScreen from "../src/screens/SetupScreen.jsx";
import Login from "./screens/Login.jsx";
import ContentScheduler from "./screens/ContentScheduler.jsx";
import LocalSchedular from "./screens/LocalSchedular.jsx";

export default function App() {
  const [configExists, setConfigExists] = useState(null); // null = loading
  const [currentScreen, setCurrentScreen] = useState(null);

  const navigate = (screen) => {
    setCurrentScreen(screen);
  };

  const handleConfigSaved = () => {
    setConfigExists(true);
    setCurrentScreen("remote"); // jump to RemoteConnect after saving config
  };

  const refreshConfig = async () => {
    setConfigExists(null); // Loading state
    try {
      const config = await window.electronAPI.getDeviceConfig();
      const exist = await window.electronAPI.checkDeviceExists();

      if (exist) {
        console.log("config from app.jsx:", config);
        if (config) {
          console.log("Configuration found:", config);
          setConfigExists(true);
          setCurrentScreen("remote"); // go straight to RemoteConnect
        } else {
          console.log("Configuration missing");
          setConfigExists(false);
          setCurrentScreen("setup");
        } 
      } else {
        console.log("Configuration missing in db");
        setConfigExists(false);
        setCurrentScreen("setup");
      }
    } catch (error) {
      console.error("Error checking device config:", error);
      setConfigExists(false);
      setCurrentScreen("setup");
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

  // Show screens based on state
  if (currentScreen === "setup") {
    return (
      <SetupScreen onNavigate={navigate} onConfigSaved={handleConfigSaved} />
    );
  }

  if (currentScreen === "login") {
    return <Login onNavigate={navigate} />;
  }

  if (currentScreen === "schedular") {
    return (
      <LocalSchedular onNavigate={navigate} onConfigSaved={handleConfigSaved} />
    );
  }

  // Default → RemoteConnect if config exists
  return (
    <RemoteConnect onNavigate={navigate} onRefreshConfig={refreshConfig} />
  );
}
