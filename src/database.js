const sql = require("mssql");
const SoapService = require("./SoapService");

class DatabaseService {
  constructor(config) {
    // Use provided config or fallback to default values
    this.config = {
      server: config?.server,
      database: config?.database,
      user: config?.user,
      password: config?.password,
      options: {
        encrypt: config?.options?.encrypt ?? true, // Use encryption
        trustServerCertificate: config?.options?.trustServerCertificate ?? true, // Trust self-signed certificates
        enableArithAbort: config?.options?.enableArithAbort ?? true, // Required for some SQL Server versions
      },
      // driver: "msnodesqlv8", // Use msnodesqlv8 driver
      // Connection timeout settings
      connectionTimeout: config?.connectionTimeout || 30000, // 30 seconds
      requestTimeout: config?.requestTimeout || 30000, // 30 seconds
      pool: {
        max: config?.pool?.max || 10,
        min: config?.pool?.min || 0,
        idleTimeoutMillis: config?.pool?.idleTimeoutMillis || 30000,
        acquireTimeoutMillis: config?.pool?.acquireTimeoutMillis || 60000,
        createTimeoutMillis: config?.pool?.createTimeoutMillis || 30000,
        destroyTimeoutMillis: config?.pool?.destroyTimeoutMillis || 5000,
        reapIntervalMillis: config?.pool?.reapIntervalMillis || 1000,
        createRetryIntervalMillis:
          config?.pool?.createRetryIntervalMillis || 200,
      },
      // Additional options for connection issues
      parseJSON: config?.parseJSON ?? true,
      port: config?.port || 1433, // Default SQL Server port
    };

    this.pool = null;
    this.isConnecting = false;
  }

  async connect() {
    console.log("Connecting to SQL Server with config:", this.config);
    return true;
    // sql.connect(
    //   {
    //     server: "MSI\\SQLEXPRESS",
    //     database: "remort",
    //     user: "sa",
    //     password: "Sasithmj2000#",
    //     options: {
    //       encrypt: true, // Use encryption
    //       trustServerCertificate: true, // Trust self-signed certificates
    //       enableArithAbort: true, // Required for some SQL Server versions
    //     },
    //     // driver: "msnodesqlv8",
    //     port: 1433,
    //   },
    //   (err) => {
    //     if (err) {
    //       console.error("Database connection error:", err);
    //       throw err;
    //     }
    //     console.log("Connected to SQL Server successfully");
    //   }
    // );
    try {
      // Prevent multiple connection attempts
      if (this.isConnecting) {
        console.log("Connection attempt already in progress, waiting...");
        while (this.isConnecting) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return this.pool;
      }

      if (this.pool && this.pool.connected) {
        return this.pool;
      }

      this.isConnecting = true;
      console.log("Attempting to connect to SQL Server...");
      console.log(`Server: ${this.config.server}`);
      console.log(`Database: ${this.config.database}`);
      console.log(`User: ${this.config.user}`);

      // Close existing pool if it exists but is not connected
      if (this.pool) {
        try {
          await this.pool.close();
        } catch (closeError) {
          console.warn("Error closing existing pool:", closeError.message);
        }
        this.pool = null;
      }

      // Create new connection pool
      this.pool = new sql.ConnectionPool(this.config);

      // Add error event handler
      this.pool.on("error", (err) => {
        console.error("SQL Pool Error:", err);
        this.pool = null;
        this.isConnecting = false;
      });

      // Connect to the pool
      await this.pool.connect();

      console.log("Successfully connected to SQL Server");
      this.isConnecting = false;
      return this.pool;
    } catch (error) {
      this.isConnecting = false;
      this.pool = null;

      console.error("Database connection error:", error);

      // Provide more specific error messages
      if (error.code === "ETIMEOUT") {
        throw new Error(
          `Connection timeout. Please check if SQL Server is running and accessible at ${this.config.server}`
        );
      } else if (error.code === "ELOGIN") {
        throw new Error(`Login failed. Please check username and password.`);
      } else if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Connection refused. Please check if SQL Server is running on port ${this.config.port}`
        );
      } else {
        throw new Error(
          `Database connection failed: ${error.message || error.toString()}`
        );
      }
    }
  }

  async testConnection() {
    try {
      const pool = await this.connect();
      const result = await pool.request().query("SELECT 1 as test");
      return result.recordset[0].test === 1;
    } catch (error) {
      console.error("Test connection failed:", error);
      return false;
    }
  }

  async disconnect() {
    if (this.pool) {
      try {
        await this.pool.close();
        this.pool = null;
        console.log("Database connection closed");
      } catch (error) {
        console.error("Error closing database connection:", error);
      }
    }
  }

  async executeQuery(query, inputs = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();

      // Add parameters to the request
      Object.keys(inputs).forEach((key) => {
        request.input(key, inputs[key]);
      });

      const result = await request.query(query);
      return result;
    } catch (error) {
      console.error("Query execution error:", error);
      throw error;
    }
  }

  // Device Management Methods
  async getDeviceByScrId(scrId) {
    const query = `
      SELECT Id, ScrId, DivName, Loc, ApiKey, IsOnline, LastSeenAt, CreatedAt, CreatedBy
      FROM DevicesTbl 
      WHERE ScrId = @scrId
    `;
    const result = await this.executeQuery(query, { scrId });
    return result.recordset[0] || null;
  }

  async getContentItemsByScrId(scrId) {
    const query = `
      SELECT Id, ScrId, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt
      FROM ContentItems_tbl 
      WHERE ScrId = @scrId
      ORDER BY 
        CASE 
          WHEN ScheduleType = 'Live' THEN 1
          WHEN ScheduleType = 'Schedule' THEN 2
          WHEN ScheduleType = 'Default' THEN 3
        END,
        StartTime ASC
    `;
    const result = await this.executeQuery(query, { scrId });
    return result.recordset || [];
  }

  async updateDeviceStatus(customId, isOnline = true) {
    const query = `
      UPDATE DevicesTbl 
      SET IsOnline = @isOnline, LastSeenAt = GETDATE()
      WHERE ScrId = @scrId
    `;
    await this.executeQuery(query, { scrId: customId, isOnline });
    return true;
  }

  async registerDevice(
    scrName,
    scrLoc,
    ipAddress,
    macAddress,
    createdBy,
    scrStatus,
    onStatus,
    plantCode
  ) {
    try {
      // Check if device already exists
      const existingDevice = await this.getDeviceByMacAddress(macAddress);

      let result;

      if (existingDevice) {
        // // ✅ Update existing device
        // result = await this.updateDeviceByMacAddress(
        //   scrName,
        //   scrLoc,
        //   ipAddress,
        //   macAddress,
        //   createdBy,
        //   scrStatus,
        //   onStatus,
        //   plantCode
        // );

        console.log("Device updated successfully:", result);

        return {
          success: true,
          message: "Device updated successfully",
          device: {
            id: existingDevice.Id,
            scrId: existingDevice.ScrID,
            name: scrName,
            location: scrLoc,
            plantId: plantCode,
          },
        };
      } else {
        // ✅ Insert new device
        result = await this.storeMacAddressMapping(
          scrName,
          scrLoc,
          ipAddress,
          macAddress,
          createdBy,
          scrStatus,
          onStatus,
          plantCode
        );

        const deviceData=this.getDeviceByMacAddress(macAddress);
        console.log("device data from storedAddress: ",deviceData)

        return {
          success: true,
          message: "Device registered successfully",
          deviceData:deviceData
        };
      }
    } catch (error) {
      console.error("Error registering device:", error);
      throw error;
    }
  }

  async storeMacAddressMapping(
    scrName,
    scrLoc,
    ipAddress,
    macAddress,
    createdBy,
    scrStatus = "",
    onStatus = "",
    plantCode
  ) {

    try {
      const soapService = new SoapService(); // now it's an instance
      const res = await soapService.registerDevice({
        screenName: scrName,
        screenLocation: scrLoc,
        ip: ipAddress,
        mac: macAddress,
        screenStatus: scrStatus,
        plantCode
      });

      if (res === "OK") {
        console.log("Device registered successfully!");
      } else {
        console.error("Device registration failed:", res);
      }

    } catch (err) {
      console.error("Failed to register device", err);
      throw err;
    }

  }
  // async storeMacAddressMapping(
  //   scrName,
  //   scrLoc,
  //   ipAddress,
  //   macAddress,
  //   createdBy,
  //   scrStatus = "",
  //   onStatus = "",
  //   plantCode
  // ) {
  //   const query = `
  //       INSERT INTO DevicesTbl 
  //       (ScrName, ScrLoc, IPAddress, MACAddress, CreatedDate, CreatedBy, ScrStatus, OnStatus, PlantCode)
  //       VALUES 
  //       (@scrName, @scrLoc, @ipAddress, @macAddress, GETDATE(), @createdBy, @scrStatus , @onStatus , @plantCode)
  //   `;
  //   await this.executeQuery(query, {
  //     scrName,
  //     scrLoc,
  //     ipAddress,
  //     macAddress,
  //     createdBy,
  //     scrStatus,
  //     onStatus,
  //     plantCode,
  //   });
  // }

  async updateDeviceByMacAddress(
    scrName,
    scrLoc,
    ipAddress,
    macAddress,
    createdBy,
    scrStatus,
    onStatus,
    plantCode
  ) {
    const query = `
        UPDATE DevicesTbl
        SET ScrName = @scrName,
        ScrLoc = @scrLoc,
        IPAddress = @ipAddress,
        CreatedBy = @createdBy,
        ScrStatus = @scrStatus,
        OnStatus = @onStatus,
        PlantCode = @plantCode
    WHERE MACAddress = @macAddress
    `;
    console.log("Updating device with MAC:", macAddress);
    await this.executeQuery(query, {
      scrName,
      scrLoc,
      ipAddress,
      createdBy,
      scrStatus,
      onStatus,
      plantCode,
      macAddress,
    });
  }
  // async updateDeviceByMacAddress(
  //   scrName,
  //   scrLoc,
  //   ipAddress,
  //   macAddress,
  //   createdBy,
  //   scrStatus,
  //   onStatus,
  //   plantCode
  // ) {
  //   const query = `
  //       UPDATE DevicesTbl
  //       SET ScrName = @scrName,
  //       ScrLoc = @scrLoc,
  //       IPAddress = @ipAddress,
  //       CreatedBy = @createdBy,
  //       ScrStatus = @scrStatus,
  //       OnStatus = @onStatus,
  //       PlantCode = @plantCode
  //   WHERE MACAddress = @macAddress
  //   `;
  //   console.log("Updating device with MAC:", macAddress);
  //   await this.executeQuery(query, {
  //     scrName,
  //     scrLoc,
  //     ipAddress,
  //     createdBy,
  //     scrStatus,
  //     onStatus,
  //     plantCode,
  //     macAddress,
  //   });
  // }

  async getLocationList() {
    const query = `
      SELECT DISTINCT Loc 
      FROM DevicesTbl 
      WHERE Loc IS NOT NULL AND Loc != ''
      ORDER BY Loc
    `;
    const result = await this.executeQuery(query);
    return result.recordset.map((row) => row.Loc);
  }

  async getScreenIds() {
    const query = `
      SELECT ScrId, DivName, Loc
      FROM DevicesTbl 
      ORDER BY DivName
    `;
    const result = await this.executeQuery(query);
    return result.recordset;
  }
  async getScreenIdByMAC(macAddress) {
    const query = `
      SELECT ScrID
      FROM DevicesTbl
      WHERE MACAddress = @macAddress 
      
    `;
    const result = await this.executeQuery(query);
    return result.recordset;
  }

  // async getPlantCodes() {
  //   const query = `
  //     SELECT *
  //     FROM PlantTbl 
  //     ORDER BY PlantCode
  //   `;
  //   const result = await this.executeQuery(query);
  //   return result.recordset;
  // }
  async getPlantCodes() {
    try {
      const soapService = new SoapService(); // now it's an instance
      const plantCodes = await soapService.getAllPlantCodes();
      console.log("plant codes from soap:", plantCodes)
      return plantCodes; // already parsed JSON [{PlantCode:"BEK",...}]
    } catch (err) {
      console.error("Failed to fetch plant codes from SOAP:", err);
      throw err;
    }
  }

  // async getCurrentContentForDevice(customId) {
  //   const query = `
  //   SELECT Id, ScrID, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt
  //   FROM DevicesURLTbl
  //   WHERE ScrID = @scrId
  //   AND (
  //     ScheduleType = 'Live'
  //     OR ScheduleType = 'Default'
  //     OR (
  //       ScheduleType = 'Schedule'
  //       AND StartTime <= GETDATE()
  //       AND DATEADD(MINUTE, DurMin, StartTime) >= GETDATE()
  //     )
  //   )
  //   ORDER BY
  //     CASE
  //       WHEN ScheduleType = 'Live' THEN 1
  //       WHEN ScheduleType = 'Schedule' THEN 2
  //       WHEN ScheduleType = 'Default' THEN 3
  //     END,
  //     StartTime DESC
  // `;

  //   const result = await this.executeQuery(query, { scrId: customId });
  //   const records = result.recordset;

  //   console.log("Current content for device:", records);

  //   if (!records || records.length === 0) return null;

  //   // Case 1: Highest priority content (Live or Schedule)
  //   if (records[0].ScheduleType !== "Default") {
  //     return records[0];
  //   }

  //   // Case 2: All are Default — pick one at random
  //   const defaultItems = records.filter(
  //     (item) => item.ScheduleType === "Default"
  //   );
  //   if (defaultItems.length > 1) {
  //     const randomIndex = Math.floor(Math.random() * defaultItems.length);
  //     return defaultItems[randomIndex];
  //   }

  //   return defaultItems[0];
  // }

  async getCurrentContentForDevice(targetScrID="SR000001") {
    // Filter content for the specific device
    const soapService = new SoapService();
    const contentList = await soapService.getContent({screenID:"SR000001"})
    console.log(contentList);
    // const deviceContent = contentList.filter(item => item.ScrID === targetScrID);
    
    // if (!deviceContent || deviceContent.length === 0) {
    //   console.log("No content for the Display...");
    //   return null;
    // }
  
    const currentTime = new Date();
    
    // Filter and categorize content based on schedule type and time conditions
    const validContent = deviceContent.filter(item => {
      const scheduleType = item.SchedileType || item.ScheduleType; // Handle typo in field name
      
      if (scheduleType === 'Live' || scheduleType === 'Default') {
        return true;
      }
      
      if (scheduleType === 'Schedule') {
        const startTime = new Date(item.StartTime);
        const endTime = new Date(startTime.getTime() + (item.DurMin * 60 * 1000));
        
        // Check if current time is within the scheduled window
        return currentTime >= startTime && currentTime <= endTime;
      }
      
      return false;
    });
  
    if (validContent.length === 0) {
      console.log("No valid content for the Display...");

      return null;
    }
  
    // Sort by priority and StartTime (same logic as SQL ORDER BY)
    validContent.sort((a, b) => {
      const scheduleTypeA = a.SchedileType || a.ScheduleType;
      const scheduleTypeB = b.SchedileType || b.ScheduleType;
      
      // Priority: Live = 1, Schedule = 2, Default = 3
      const getPriority = (type) => {
        switch(type) {
          case 'Live': return 1;
          case 'Schedule': return 2;
          case 'Default': return 3;
          default: return 4;
        }
      };
      
      const priorityA = getPriority(scheduleTypeA);
      const priorityB = getPriority(scheduleTypeB);
      
      // First sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Then sort by StartTime DESC (newest first)
      const startTimeA = new Date(a.StartTime);
      const startTimeB = new Date(b.StartTime);
      return startTimeB - startTimeA;
    });
  
    console.log("Current content for device:", validContent);
  
    // Case 1: Highest priority content (Live or Schedule)
    const topItem = validContent[0];
    const topScheduleType = topItem.SchedileType || topItem.ScheduleType;
    
    if (topScheduleType !== "Default") {
      return topItem;
    }
  
    // Case 2: All are Default — return all default items for app logic to handle
    const defaultItems = validContent.filter(item => {
      const scheduleType = item.SchedileType || item.ScheduleType;
      return scheduleType === "Default";
    });
  
    return {
      type: "DEFAULT_POOL",
      items: defaultItems,
    };
  }
  // async getCurrentContentForDevice(customId) {
  //   const query = `
  //   SELECT Id, ScrID, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt
  //   FROM DevicesURLTbl 
  //   WHERE ScrID = @scrId
  //   AND (
  //     ScheduleType = 'Live' 
  //     OR ScheduleType = 'Default'
  //     OR (
  //       ScheduleType = 'Schedule'
  //       AND StartTime <= GETDATE() 
  //       AND DATEADD(MINUTE, DurMin, StartTime) >= GETDATE()
  //     )
  //   )
  //   ORDER BY 
  //     CASE 
  //       WHEN ScheduleType = 'Live' THEN 1
  //       WHEN ScheduleType = 'Schedule' THEN 2
  //       WHEN ScheduleType = 'Default' THEN 3
  //     END,
  //     StartTime DESC
  // `;

  //   const result = await this.executeQuery(query, { scrId: customId });
  //   const records = result.recordset;

  //   console.log("Current content for device:", records);

  //   if (!records || records.length === 0) return null;

  //   // Case 1: Highest priority content (Live or Schedule)
  //   if (records[0].ScheduleType !== "Default") {
  //     return records[0];
  //   }

  //   // Case 2: All are Default — return all default items for app logic to handle
  //   const defaultItems = records.filter(
  //     (item) => item.ScheduleType === "Default"
  //   );

  //   return {
  //     type: "DEFAULT_POOL",
  //     items: defaultItems,
  //   };
  // }

  // async getDeviceByMacAddress(macAddress) {
  //   const query = `
  //     SELECT *
  //     FROM DevicesTbl 
  //     WHERE MACAddress = @macAddress
  //   `;
  //   console.log("Fetching device by MAC address:", macAddress);
  //   const result = await this.executeQuery(query, { macAddress });
  //   return result.recordset[0] || null;
  // }
  async getDeviceByMacAddress(macAddress) {
    try {
      const soapService = new SoapService(); // create instance
      const macDevices = await soapService.getDeviceByMac(macAddress);
      if (Array.isArray(macDevices) && macDevices.length > 0) {
        return macDevices[0]; // return the first result
      }

      return null; // no devices found
    } catch (err) {
      console.error("Failed to fetch device from SOAP:", err);
      throw err;
    }
  }

  async getDeviceStatus(scrId) {
    const query = `
      SELECT ScrStatus 
      FROM DevicesTbl 
      WHERE ScrId = @scrId
    `;
    const result = await this.executeQuery(query, { scrId });
    console.log("Device status for ScrId:", scrId, result.recordset[0]);
    return result.recordset[0];
  }

  async checkDeviceExists(macAddress) {
    const device = await this.getDeviceByMacAddress(macAddress);
    return {
      exists: !!device,
      device: device,
    };
  }

  // Content Management Methods
  async addContentItem(
    scrId,
    type,
    source,
    duration,
    scheduleStatus,
    startTime,
    title
  ) {
    const query = `
      INSERT INTO ContentItems_tbl (ScrId, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt)
      VALUES (@scrId, @type, @source, @duration, @scheduleStatus, @startTime, @title, GETDATE())
    `;

    const result = await this.executeQuery(query, {
      scrId,
      type,
      source,
      duration,
      scheduleStatus,
      startTime: startTime || null,
      title,
    });

    return result;
  }

  async updateContentItem(id, updates) {
    const setClause = Object.keys(updates)
      .filter((key) => key !== "id")
      .map((key) => `${key} = @${key}`)
      .join(", ");

    const query = `
      UPDATE ContentItems_tbl 
      SET ${setClause}
      WHERE Id = @id
    `;

    const params = { id, ...updates };
    await this.executeQuery(query, params);
    return true;
  }

  async deleteContentItem(id) {
    const query = `DELETE FROM ContentItems_tbl WHERE Id = @id`;
    await this.executeQuery(query, { id });
    return true;
  }

  async getScheduledContent(scrId) {
    const query = `
      SELECT Id, ScrId, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt
      FROM ContentItems_tbl 
      WHERE ScrId = @scrId AND ScheduleType = 'Schedule'
      ORDER BY StartTime ASC
    `;
    const result = await this.executeQuery(query, { scrId });
    return result.recordset;
  }

  async getDefaultContent(scrId) {
    const query = `
      SELECT Id, ScrId, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt
      FROM ContentItems_tbl 
      WHERE ScrId = @scrId AND ScheduleType = 'Default'
      ORDER BY CreatedAt DESC
    `;
    const result = await this.executeQuery(query, { scrId });
    return result.recordset;
  }

  async getLiveContent(scrId) {
    const query = `
      SELECT Id, ScrId, Type, Source, DurMin, ScheduleType, StartTime, Title, CreatedAt
      FROM ContentItems_tbl 
      WHERE ScrId = @scrId AND ScheduleType = 'Live'
      ORDER BY CreatedAt DESC
    `;
    const result = await this.executeQuery(query, { scrId });
    return result.recordset;
  }

  // Health check method
  async isHealthy() {
    try {
      const pool = await this.connect();
      const result = await pool.request().query("SELECT 1 as health_check");
      return result.recordset[0].health_check === 1;
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }

  getConnectionStatus() {
    return {
      connected: this.pool && this.pool.connected,
      isConnecting: this.isConnecting,
      config: {
        server: this.config.server,
        database: this.config.database,
        user: this.config.user,
      },
    };
  }
}

module.exports = DatabaseService;
