import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Settings,
  Monitor,
  FileText,
  Image,
  Video,
  Globe,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

export default function ContentScheduler({ customId, onNavigate }) {
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState("stopped");
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    type: "url",
    source: "",
    duration: 30,
    scheduleStatus: "Default",
    startTime: "",
    title: "",
  });

  useEffect(() => {
    loadContentItems();
    loadSchedulerStatus();
  }, [customId]);

  const loadContentItems = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.fetchContentItems(customId);
      if (result.success) {
        setContentItems(result.data || []);
      }
    } catch (error) {
      console.error("Error loading content items:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedulerStatus = async () => {
    try {
      const status = await window.electronAPI.getSchedulerStatus();
      setSchedulerStatus(status?.status || "stopped");
      setRefreshInterval(status?.refreshInterval || 5);
    } catch (error) {
      console.error("Error loading scheduler status:", error);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.source.trim()) newErrors.source = "Source is required";
    if (formData.duration < 1 || formData.duration > 1440) {
      newErrors.duration = "Duration must be between 1 and 1440 minutes";
    }
    if (formData.scheduleStatus === "Schedule" && !formData.startTime) {
      newErrors.startTime = "Start time is required for scheduled content";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const contentData = {
        customId,
        type: formData.type,
        source: formData.source,
        duration: formData.duration,
        scheduleStatus: formData.scheduleStatus,
        startTime:
          formData.scheduleStatus === "Schedule" ? formData.startTime : null,
        title: formData.title,
      };

      let result;
      if (editingItem) {
        result = await window.electronAPI.updateContentItem(
          editingItem.Id,
          contentData
        );
      } else {
        result = await window.electronAPI.addContentItem(contentData);
      }

      if (result.success) {
        setShowAddForm(false);
        setEditingItem(null);
        resetForm();
        await loadContentItems();
      }
    } catch (error) {
      console.error("Error saving content item:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      type: item.Type,
      source: item.Source,
      duration: item.DurMin,
      scheduleStatus: item.SchedileSts,
      startTime: item.StatTime
        ? new Date(item.StatTime).toISOString().slice(0, 16)
        : "",
      title: item.Title,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this content item?")) return;

    try {
      const result = await window.electronAPI.deleteContentItem(id);
      if (result.success) {
        await loadContentItems();
      }
    } catch (error) {
      console.error("Error deleting content item:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      type: "url",
      source: "",
      duration: 30,
      scheduleStatus: "Default",
      startTime: "",
      title: "",
    });
    setErrors({});
  };

  const toggleScheduler = async () => {
    try {
      if (schedulerStatus === "running") {
        await window.electronAPI.stopContentScheduler();
        setSchedulerStatus("stopped");
      } else {
        await window.electronAPI.startContentScheduler({
          customId,
          refreshInterval: refreshInterval * 60 * 1000,
        });
        setSchedulerStatus("running");
      }
    } catch (error) {
      console.error("Error toggling scheduler:", error);
    }
  };

  const updateRefreshInterval = async (newInterval) => {
    try {
      await window.electronAPI.updateRefreshInterval(newInterval * 60 * 1000);
      setRefreshInterval(newInterval);
    } catch (error) {
      console.error("Error updating refresh interval:", error);
    }
  };

  const getContentByStatus = (status) => {
    if (status === "all") return contentItems;
    return contentItems.filter((item) => item.SchedileSts === status);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Live":
        return <Play className="w-4 h-4 text-green-500" />;
      case "Schedule":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "Default":
        return <Settings className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "url":
        return <Globe className="w-4 h-4 text-blue-500" />;
      case "image":
        return <Image className="w-4 h-4 text-green-500" />;
      case "video":
        return <Video className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "N/A";
    return new Date(dateTime).toLocaleString();
  };

  const filteredContent = getContentByStatus(selectedTab);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Content Scheduler
              </h1>
              <p className="text-gray-600 mt-1">
                Manage content for Screen ID: {customId}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Refresh:</span>
                <select
                  value={refreshInterval}
                  onChange={(e) =>
                    updateRefreshInterval(parseInt(e.target.value))
                  }
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
              <button
                onClick={toggleScheduler}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium ${
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
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: "all", label: "All Content", count: contentItems.length },
                {
                  id: "Live",
                  label: "Live",
                  count: getContentByStatus("Live").length,
                },
                {
                  id: "Schedule",
                  label: "Scheduled",
                  count: getContentByStatus("Schedule").length,
                },
                {
                  id: "Default",
                  label: "Default",
                  count: getContentByStatus("Default").length,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    selectedTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Add Content Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingItem(null);
              resetForm();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Content</span>
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingItem ? "Edit Content" : "Add New Content"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleFormChange("title", e.target.value)}
                    className={`w-full border rounded-md px-3 py-2 ${
                      errors.title ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="Enter content title"
                  />
                  {errors.title && (
                    <p className="text-red-500 text-sm mt-1">{errors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleFormChange("type", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="url">URL</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source *
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => handleFormChange("source", e.target.value)}
                    className={`w-full border rounded-md px-3 py-2 ${
                      errors.source ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder={
                      formData.type === "url"
                        ? "https://example.com"
                        : "/path/to/file"
                    }
                  />
                  {errors.source && (
                    <p className="text-red-500 text-sm mt-1">{errors.source}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      handleFormChange("duration", parseInt(e.target.value))
                    }
                    min="1"
                    max="1440"
                    className={`w-full border rounded-md px-3 py-2 ${
                      errors.duration ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.duration && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.duration}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.scheduleStatus}
                    onChange={(e) =>
                      handleFormChange("scheduleStatus", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="Default">Default</option>
                    <option value="Live">Live</option>
                    <option value="Schedule">Schedule</option>
                  </select>
                </div>

                {formData.scheduleStatus === "Schedule" && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) =>
                        handleFormChange("startTime", e.target.value)
                      }
                      className={`w-full border rounded-md px-3 py-2 ${
                        errors.startTime ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {errors.startTime && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.startTime}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingItem ? "Update" : "Add"} Content</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Content List */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading content...</p>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">No content items found</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredContent.map((item) => (
                    <tr key={item.Id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.Title}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {item.Source}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(item.Type)}
                          <span className="text-sm text-gray-900 capitalize">
                            {item.Type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(item.SchedileSts)}
                          <span className="text-sm text-gray-900">
                            {item.SchedileSts}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(item.DurMin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(item.StatTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.Id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
