import React, { useEffect, useState } from "react";

const FullScreenPlayer = () => {
  const [content, setContent] = useState(null);

  useEffect(() => {
    // Check if we're in an Electron environment
    if (
      typeof window !== "undefined" &&
      window.electronAPI &&
      window.electronAPI.receive
    ) {
      // In Electron environment - listen for IPC messages
      window.electronAPI.receive("displayUrl", (data) => {
        setContent(data);
      });
    } else {
      // In browser environment - simulate content for demo
      console.log("Electron API not available - using demo content");
      setTimeout(() => {
        setContent({
          Type: "url",
          Source: "https://www.youtube.com/embed/nHFna5Bkcxw",
        });
      }, 1000);
    }

    // Cleanup function if needed
    return () => {
      if (
        typeof window !== "undefined" &&
        window.electronAPI &&
        window.electronAPI.removeAllListeners
      ) {
        window.electronAPI.removeAllListeners("displayUrl");
      }
    };
  }, []);

  if (!content) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "24px",
        }}
      >
        Loading content...
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "black" }}>
      {content.Type === "image" && (
        <img
          src={content.Source}
          alt="content"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}

      {content.Type === "video" && (
        <video
          src={content.Source}
          autoPlay
          loop
          controls
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}

      {content.Type === "url" && (
        <iframe
          src={content.Source}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          title="Web Page"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
};

export default FullScreenPlayer;
