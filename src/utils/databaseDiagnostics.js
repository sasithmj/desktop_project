const { exec } = require("child_process");
const { promisify } = require("util");
const net = require("net");

const execAsync = promisify(exec);

class DatabaseDiagnostics {
  static async checkSQLServerStatus() {
    console.log("🔍 Checking SQL Server Status...");

    try {
      // Check if SQL Server service is running
      const { stdout } = await execAsync("sc query MSSQLSERVER");
      if (stdout.includes("RUNNING")) {
        console.log("✅ SQL Server (MSSQLSERVER) is running");
      } else {
        console.log("❌ SQL Server (MSSQLSERVER) is not running");
      }
    } catch (error) {
      console.log("❌ Could not check SQL Server service status");
    }

    try {
      // Check if SQL Server Express is running
      const { stdout } = await execAsync("sc query MSSQL$SQLEXPRESS");
      if (stdout.includes("RUNNING")) {
        console.log("✅ SQL Server Express (SQLEXPRESS) is running");
      } else {
        console.log("❌ SQL Server Express (SQLEXPRESS) is not running");
      }
    } catch (error) {
      console.log("❌ Could not check SQL Server Express service status");
    }
  }

  static async testConnection(server, port = 1433) {
    console.log(`🔌 Testing connection to ${server}:${port}...`);

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 5000;

      socket.setTimeout(timeout);

      socket.on("connect", () => {
        console.log(`✅ Successfully connected to ${server}:${port}`);
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        console.log(`❌ Connection timeout to ${server}:${port}`);
        socket.destroy();
        resolve(false);
      });

      socket.on("error", (error) => {
        console.log(
          `❌ Connection error to ${server}:${port}: ${error.message}`
        );
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, server);
    });
  }

  static async testSQLCMDConnection(server, database = "master") {
    console.log(`🔧 Testing SQLCMD connection to ${server}...`);

    const commands = [
      `sqlcmd -S "${server}" -E -d ${database} -Q "SELECT 1 as test"`,
      `sqlcmd -S "${server}" -U sa -P Sasithmj2000# -d ${database} -Q "SELECT 1 as test"`,
      `sqlcmd -S "localhost\\SQLEXPRESS" -E -d ${database} -Q "SELECT 1 as test"`,
      `sqlcmd -S ".\\SQLEXPRESS" -E -d ${database} -Q "SELECT 1 as test"`,
    ];

    for (const cmd of commands) {
      try {
        console.log(`Testing: ${cmd.split(" -Q")[0]}`);
        const { stdout } = await execAsync(cmd);
        if (stdout.includes("1")) {
          console.log("✅ SQLCMD connection successful!");
          return true;
        }
      } catch (error) {
        console.log(`❌ SQLCMD failed: ${error.message.split("\n")[0]}`);
      }
    }

    return false;
  }

  static async runFullDiagnostics() {
    console.log("🚀 Running Database Connection Diagnostics...\n");

    // Check SQL Server services
    await this.checkSQLServerStatus();
    console.log("");

    // Test network connections
    const servers = ["MSI", "localhost", "127.0.0.1"];
    for (const server of servers) {
      await this.testConnection(server, 1433);
    }
    console.log("");

    // Test SQLCMD connections
    const instances = [
      "MSI\\SQLEXPRESS",
      "localhost\\SQLEXPRESS",
      ".\\SQLEXPRESS",
    ];
    for (const instance of instances) {
      await this.testSQLCMDConnection(instance);
    }

    console.log("\n📋 Troubleshooting Tips:");
    console.log("1. Ensure SQL Server is installed and running");
    console.log("2. Check if SQL Server Browser service is running");
    console.log("3. Verify the instance name (SQLEXPRESS)");
    console.log("4. Check Windows Firewall settings");
    console.log("5. Verify SQL Server authentication mode");
    console.log(
      "6. Try using Windows Authentication instead of SQL Authentication"
    );
  }
}

module.exports = DatabaseDiagnostics;
