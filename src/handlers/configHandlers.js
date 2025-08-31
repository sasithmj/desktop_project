const { ipcMain } = require("electron");
const { app } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const DatabaseService = require("../database.js");
const bcrypt = require("bcryptjs");

class ConfigHandlers {
  constructor() {
    this.configPath = path.join(app.getPath("userData"), "device-config.json");
    this.loginConfigPath = path.join(
      app.getPath("userData"),
      "login-config.json"
    );

    this.registerHandlers();
    this.initLoginConfig();
  }

  async initLoginConfig() {
    try {
      // If no login config file exists, create one with default credentials
      try {
        await fs.access(this.loginConfigPath);
      } catch {
        const defaultCreds = {
          username: "admin",
          passwordHash: bcrypt.hashSync("Admin1234", 10), // Change default password here
        };
        await fs.writeFile(
          this.loginConfigPath,
          JSON.stringify(defaultCreds, null, 2)
        );
        console.log("Login config created:", this.loginConfigPath);
      }
    } catch (err) {
      console.error("Error initializing login config:", err);
    }
  }

  registerHandlers() {
    ipcMain.handle(
      "save-device-config",
      this.saveDeviceConfigHandler.bind(this)
    );
    // ipcMain.handle("connect-to-db", this.connectToDB.bind(this));
    ipcMain.handle("get-device-config", this.getDeviceConfigHandler.bind(this));
    ipcMain.handle("update-db-config", this.updateDbConfigHandler.bind(this));
    ipcMain.handle(
      "test-database-connection",
      this.testDatabaseConnectionHandler.bind(this)
    );
    ipcMain.handle(
      "run-database-diagnostics",
      this.runDatabaseDiagnosticsHandler.bind(this)
    );

    ipcMain.handle("login-attempt", this.loginAttemptHandler.bind(this));
    ipcMain.handle(
      "update-login-credentials",
      this.updateLoginCredentialsHandler.bind(this)
    );
  }

  async saveDeviceConfigHandler(event, config) {
    try {
      // Save config to file
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

      console.log("config data in saveConfig:",config);
      const databaseService = new DatabaseService();
      
      await databaseService.registerDevice(
        config.scrName,
        config.scrLoc,
        config.ipAddress,
        config.macAddress,
        config.createdBy,
        config.scrStatus,
        config.onStatus,
        config.plantCode
      );

      // // Notify other handlers about the new db service
      // if (this.onDbServiceReady) {
      //   this.onDbServiceReady(this.dbService);
      // }

      return { success: true };
    } catch (error) {
      console.error("Failed to save config or connect to database:", error);
      return { success: false, error: error.message };
    }
  }
  // async saveDeviceConfigHandler(event, config) {
  //   try {
  //     // Save config to file
  //     await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

  //     // Initialize database service
  //     this.dbService = new DatabaseService(config.dbConfig);

  //     // Test connection and register/update device
  //     await this.dbService.connect();
  //     console.log("Database connected successfully");
  //     await this.dbService.registerDevice(
  //       config.deviceConfig.scrName,
  //       config.deviceConfig.scrLoc,
  //       config.deviceConfig.ipAddress,
  //       config.deviceConfig.macAddress,
  //       config.deviceConfig.createdBy,
  //       config.deviceConfig.scrStatus,
  //       config.deviceConfig.onStatus,
  //       config.deviceConfig.plantCode
  //     );

  //     // Notify other handlers about the new db service
  //     if (this.onDbServiceReady) {
  //       this.onDbServiceReady(this.dbService);
  //     }

  //     return { success: true };
  //   } catch (error) {
  //     console.error("Failed to save config or connect to database:", error);
  //     return { success: false, error: error.message };
  //   }
  // }

  async getDeviceConfigHandler() {
    try {
      const configData = await fs.readFile(this.configPath, "utf8");
      const config = JSON.parse(configData);

      console.log("Loaded device config:", config);

      // Initialize database service if config exists
      // if (config) {
      //   this.dbService = new DatabaseService(config.dbConfig);
      //   if (this.onDbServiceReady) {
      //     this.onDbServiceReady(this.dbService);
      //   }
      // }

      return config;
    } catch (error) {
      // Config file doesn't exist or is invalid
      return null;
    }
  }

  async updateDbConfigHandler(event, newDbConfig) {
    try {
      // Load existing config
      const configData = await fs.readFile(this.configPath, "utf8");
      const config = JSON.parse(configData);

      // Update dbConfig
      config.dbConfig = newDbConfig;

      // Save updated config
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

      // Re-initialize database connection
      this.dbService = new DatabaseService(newDbConfig);
      await this.dbService.connect();
      console.log("Database config updated and reconnected.");

      // Notify others (if needed)
      if (this.onDbServiceReady) {
        this.onDbServiceReady(this.dbService);
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to update DB config:", error);
      return { success: false, error: error.message };
    }
  }

  setDbServiceCallback(callback) {
    this.onDbServiceReady = callback;
  }

  async testDatabaseConnectionHandler(event, config) {
    try {
      this.dbService = new DatabaseService(config);

      // Test connection and register/update device
      await this.dbService.connect();
      console.log("Database connected successfully");

      // Notify other handlers about the new db service
      if (this.onDbServiceReady) {
        this.onDbServiceReady(this.dbService);
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to test database connection:", error);
      return { success: false, error: error.message };
    }
  }

  async runDatabaseDiagnosticsHandler(event) {
    try {
      const DatabaseDiagnostics = require("../utils/databaseDiagnostics");
      await DatabaseDiagnostics.runFullDiagnostics();
      return {
        success: true,
        message: "Diagnostics completed. Check console for details.",
      };
    } catch (error) {
      console.error("Failed to run database diagnostics:", error);
      return { success: false, error: error.message };
    }
  }

  getDbService() {
    return this.dbService;
  }

  async loginAttemptHandler(event, { username, password }) {
    console.log("Login attempt with username:", username);
    try {
      const storedCreds = JSON.parse(
        await fs.readFile(this.loginConfigPath, "utf8")
      );

      if (
        username === storedCreds.username &&
        bcrypt.compareSync(password, storedCreds.passwordHash)
      ) {
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("Login check failed:", error);
      return { success: false, error: error.message };
    }
  }

  async updateLoginCredentialsHandler(event, { username, password }) {
    try {
      const hashed = bcrypt.hashSync(password, 10);
      const newCreds = { username, passwordHash: hashed };
      await fs.writeFile(
        this.loginConfigPath,
        JSON.stringify(newCreds, null, 2)
      );
      return { success: true };
    } catch (error) {
      console.error("Failed to update login credentials:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ConfigHandlers;
