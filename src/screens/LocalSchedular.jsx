import React, { useState } from "react";

export default function LocalSchedular({ onNavigate, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [startTime, setStartTime] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title || !duration || !startTime || !file) {
      setError("All fields are required");
      return;
    }

    onSave({
      title,
      duration: parseInt(duration, 10),
      startTime,
      file,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-96"
      >
        <h1 className="text-xl font-bold mb-4">Schedule Video</h1>

        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded mb-3"
        />

        <input
          type="number"
          placeholder="Duration (Minutes)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full p-2 border rounded mb-3"
        />

        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full p-2 border rounded mb-3"
        />

        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full p-2 border rounded mb-3"
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 border rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
