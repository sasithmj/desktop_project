const os = require("os");

class NetworkUtils {
  constructor() {
    // You can add any initialization logic here if needed
  }

  /**
   * Attempts to determine if an interface is physical (not virtual)
   * @param {string} interfaceName - Name of the interface
   * @returns {boolean} True if likely physical interface
   */
  _isPhysicalInterface(interfaceName) {
    const physicalPrefixes = ["eth", "en", "wlan", "wl", "Wi-Fi", "Ethernet"];
    const virtualPrefixes = [
      "veth",
      "docker",
      "br-",
      "vmnet",
      "vbox",
      "tap",
      "tun",
    ];

    // Check if it's likely virtual
    if (
      virtualPrefixes.some((prefix) =>
        interfaceName.toLowerCase().includes(prefix.toLowerCase())
      )
    ) {
      return false;
    }

    // Check if it's likely physical
    if (
      physicalPrefixes.some((prefix) =>
        interfaceName.toLowerCase().includes(prefix.toLowerCase())
      )
    ) {
      return true;
    }

    // Default to true for unknown interfaces
    return true;
  }

  /**
   * Gets the MAC address of the first non-internal network interface
   * @returns {string|null} MAC address or null if not found
   */
  getMacAddress() {
    const networkInterfaces = os.networkInterfaces();
    const candidates = [];

    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];

      for (const iface of interfaces) {
        if (
          !iface.internal &&
          iface.mac !== "00:00:00:00:00:00" &&
          this._isPhysicalInterface(interfaceName)
        ) {
          candidates.push({
            name: interfaceName,
            mac: iface.mac,
            family: iface.family,
            address: iface.address,
          });
        }
      }
    }

    // Sort by interface name for consistency
    candidates.sort((a, b) => a.name.localeCompare(b.name));

    return candidates.length > 0 ? candidates[0].mac : null;
  }

  /**
   * Gets all available network interfaces with their details
   * @returns {Object} Network interfaces object
   */
  getAllNetworkInterfaces() {
    return os.networkInterfaces();
  }

  /**
   * Gets all MAC addresses from non-internal interfaces
   * @returns {Array<string>} Array of MAC addresses
   */
  getAllMacAddresses() {
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = [];

    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];

      for (const iface of interfaces) {
        if (!iface.internal && iface.mac !== "00:00:00:00:00:00") {
          macAddresses.push(iface.mac);
        }
      }
    }

    return macAddresses;
  }

  /**
   * Gets MAC address for a specific interface name
   * @param {string} interfaceName - Name of the network interface
   * @returns {string|null} MAC address or null if not found
   */
  getMacAddressByInterface(interfaceName) {
    const networkInterfaces = os.networkInterfaces();
    const interfaces = networkInterfaces[interfaceName];

    if (!interfaces) {
      return null;
    }

    for (const iface of interfaces) {
      if (!iface.internal && iface.mac !== "00:00:00:00:00:00") {
        return iface.mac;
      }
    }

    return null;
  }

  /**
   * Gets network interface details by MAC address
   * @param {string} macAddress - MAC address to search for
   * @returns {Object|null} Interface details or null if not found
   */
  getInterfaceByMacAddress(macAddress) {
    const networkInterfaces = os.networkInterfaces();

    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];

      for (const iface of interfaces) {
        if (iface.mac === macAddress) {
          return {
            name: interfaceName,
            ...iface,
          };
        }
      }
    }

    return null;
  }
}

module.exports = NetworkUtils;
