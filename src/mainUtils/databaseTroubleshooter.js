// utils/databaseTroubleshooter.js
const sql = require("mssql");
const net = require("net");

class DatabaseTroubleshooter {
  constructor(config) {
    this.config = config;
  }

  // Test basic network connectivity
  async testNetworkConnection() {
    return new Promise((resolve) => {
      const [server, port] = this.parseServerAddress();
      const socket = new net.Socket();

      socket.setTimeout(5000);

      socket.connect(port, server, () => {
        socket.destroy();
        resolve({
          success: true,
          message: `Network connection to ${server}:${port} successful`,
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          success: false,
          message: `Network connection failed: ${err.message}`,
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          success: false,
          message: `Network connection timeout to ${server}:${port}`,
        });
      });
    });
  }

  parseServerAddress() {
    const serverString = this.config.server;
    let server,
      port = 1433; // Default SQL Server port

    if (serverString.includes(",")) {
      [server, port] = serverString.split(",");
      port = parseInt(port);
    } else if (serverString.includes(":")) {
      [server, port] = serverString.split(":");
      port = parseInt(port);
    } else {
      server = serverString;
    }

    // Handle named instances (like MSI\SQLEXPRESS)
    if (server.includes("\\")) {
      // Named instances typically use dynamic ports or 1433
      port = this.config.port || 1433;
    }

    return [server.split("\\")[0], port];
  }

  // Test different connection configurations
  async testMultipleConfigurations() {
    const testConfigs = [
      // Original config
      { ...this.config, name: "Original Config" },

      // Without encryption
      {
        ...this.config,
        name: "Without Encryption",
        options: {
          ...this.config.options,
          encrypt: false,
        },
      },

      // With explicit port
      {
        ...this.config,
        name: "With Explicit Port",
        port: 1433,
      },

      // Longer timeout
      {
        ...this.config,
        name: "Longer Timeout",
        connectionTimeout: 60000,
        requestTimeout: 60000,
      },

      // TCP/IP connection string format
      {
        ...this.config,
        name: "TCP Format",
        server: this.config.server.replace("\\", ",1433\\"),
      },
    ];

    console.log("Testing multiple connection configurations...\n");

    const results = [];

    for (const config of testConfigs) {
      console.log(`Testing: ${config.name}`);
      try {
        const pool = new sql.ConnectionPool(config);
        await pool.connect();
        await pool.request().query("SELECT 1");
        await pool.close();

        const result = {
          config: config.name,
          success: true,
          message: "Connection successful",
        };
        console.log(`✅ ${config.name}: SUCCESS`);
        results.push(result);

        // If we found a working config, we can break
        break;
      } catch (error) {
        const result = {
          config: config.name,
          success: false,
          error: error.message,
        };
        console.log(`❌ ${config.name}: ${error.message}`);
        results.push(result);
      }
      console.log("");
    }

    return results;
  }

  // Comprehensive diagnosis
  async diagnose() {
    console.log("🔍 Starting Database Connection Diagnosis\n");
    console.log("Configuration:");
    console.log(`  Server: ${this.config.server}`);
    console.log(`  Database: ${this.config.database}`);
    console.log(`  User: ${this.config.user}`);
    console.log(`  Encrypt: ${this.config.options?.encrypt}`);
    console.log(
      `  Trust Certificate: ${this.config.options?.trustServerCertificate}\n`
    );

    const diagnosis = {
      networkTest: null,
      configTests: [],
      recommendations: [],
    };

    // Test 1: Network connectivity
    console.log("1️⃣ Testing network connectivity...");
    diagnosis.networkTest = await this.testNetworkConnection();
    console.log(
      diagnosis.networkTest.success ? "✅" : "❌",
      diagnosis.networkTest.message
    );
    console.log("");

    // Test 2: Multiple configurations
    console.log("2️⃣ Testing different configurations...");
    diagnosis.configTests = await this.testMultipleConfigurations();

    // Generate recommendations
    diagnosis.recommendations = this.generateRecommendations(diagnosis);

    return diagnosis;
  }

  generateRecommendations(diagnosis) {
    const recommendations = [];

    if (!diagnosis.networkTest.success) {
      recommendations.push("❗ Network connectivity failed. Check if:");
      recommendations.push("  - SQL Server is running");
      recommendations.push(
        "  - SQL Server is configured to accept TCP/IP connections"
      );
      recommendations.push(
        "  - Windows Firewall allows SQL Server connections"
      );
      recommendations.push("  - The server name is correct");
    }

    const hasSuccessfulConfig = diagnosis.configTests.some(
      (test) => test.success
    );

    if (!hasSuccessfulConfig) {
      recommendations.push("❗ All connection attempts failed. Try:");
      recommendations.push("  - Check SQL Server Configuration Manager");
      recommendations.push("  - Verify SQL Server Browser service is running");
      recommendations.push("  - Check if SQL Authentication is enabled");
      recommendations.push("  - Verify username and password are correct");
      recommendations.push(
        "  - Try connecting with SQL Server Management Studio first"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Connection issues resolved!");
    }

    return recommendations;
  }

  // Quick connection test
  static async quickTest(config) {
    const troubleshooter = new DatabaseTroubleshooter(config);
    try {
      const pool = new sql.ConnectionPool(config);
      await pool.connect();
      const result = await pool
        .request()
        .query("SELECT GETDATE() as current_time, @@VERSION as version");
      await pool.close();

      return {
        success: true,
        message: "Connection successful",
        serverTime: result.recordset[0].current_time,
        version: result.recordset[0].version,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }
}

module.exports = DatabaseTroubleshooter;
