// diagnostics/sqlServerDiagnostics.js
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SQLServerDiagnostics {
  
  static async checkSQLServerServices() {
    console.log("🔍 Checking SQL Server Services...\n");
    
    try {
      // Check SQL Server service
      const { stdout: sqlServerStatus } = await execPromise('sc query "MSSQL$SQLEXPRESS"');
      console.log("SQL Server (SQLEXPRESS) Service:");
      console.log(sqlServerStatus.includes('RUNNING') ? "✅ RUNNING" : "❌ NOT RUNNING");
      
      if (!sqlServerStatus.includes('RUNNING')) {
        console.log("💡 Try: net start \"MSSQL$SQLEXPRESS\"\n");
      }
    } catch (error) {
      console.log("❌ SQL Server (SQLEXPRESS) service not found or not accessible");
      console.log("💡 Make sure SQL Server Express is installed\n");
    }

    try {
      // Check SQL Server Browser service
      const { stdout: browserStatus } = await execPromise('sc query "SQLBrowser"');
      console.log("SQL Server Browser Service:");
      console.log(browserStatus.includes('RUNNING') ? "✅ RUNNING" : "❌ NOT RUNNING");
      
      if (!browserStatus.includes('RUNNING')) {
        console.log("💡 Try: net start \"SQLBrowser\"\n");
      }
    } catch (error) {
      console.log("❌ SQL Server Browser service not found");
      console.log("💡 This service helps with named instance connections\n");
    }
  }

  static async checkNetworkConnectivity() {
    console.log("🌐 Checking Network Connectivity...\n");
    
    try {
      // Test localhost connectivity
      await execPromise('ping -n 1 localhost');
      console.log("✅ Localhost connectivity OK");
      
      // Test computer name connectivity
      const { stdout: computerName } = await execPromise('hostname');
      const hostName = computerName.trim();
      console.log(`Computer name: ${hostName}`);
      
      await execPromise(`ping -n 1 ${hostName}`);
      console.log(`✅ ${hostName} connectivity OK\n`);
      
    } catch (error) {
      console.log("❌ Network connectivity issues detected\n");
    }
  }

  static async checkSQLServerInstances() {
    console.log("🗄️ Checking SQL Server Instances...\n");
    
    try {
      // Try to list SQL Server instances using sqlcmd
      const { stdout } = await execPromise('sqlcmd -L');
      console.log("Available SQL Server instances:");
      console.log(stdout);
      
      if (stdout.includes('MSI\\SQLEXPRESS') || stdout.includes('SQLEXPRESS')) {
        console.log("✅ SQLEXPRESS instance found");
      } else {
        console.log("❌ SQLEXPRESS instance not found in network list");
      }
    } catch (error) {
      console.log("❌ Could not list SQL Server instances");
      console.log("💡 This might indicate SQL Server tools are not in PATH\n");
    }
  }

  static async testSQLCMDConnection() {
    console.log("🔧 Testing SQLCMD Connection...\n");
    
    const connectionStrings = [
      'sqlcmd -S "MSI\\SQLEXPRESS" -E -d remort -Q "SELECT 1 as test"',
      'sqlcmd -S "localhost\\SQLEXPRESS" -E -d remort -Q "SELECT 1 as test"',
      'sqlcmd -S ".\\SQLEXPRESS" -E -d remort -Q "SELECT 1 as test"',
      'sqlcmd -S "(local)\\SQLEXPRESS" -E -d remort -Q "SELECT 1 as test"'
    ];

    for (const cmd of connectionStrings) {
      try {
        console.log(`Testing: ${cmd.split(' -Q')[0]}`);
        const { stdout } = await execPromise(cmd);
        if (stdout.includes('1')) {
          console.log("✅ SUCCESS - Connection works!");
          console.log(`Working connection string: ${cmd.split(' -Q')[0]}\n`);
          return cmd.split(' -Q')[0];
        }
      } catch (error) {
        console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
      }
    }
    
    console.log("❌ All SQLCMD connection attempts failed\n");
    return null;
  }

  static async checkWindowsAuthentication() {
    console.log("🔐 Checking Windows Authentication...\n");
    
    try {
      // Check current user
      const { stdout: currentUser } = await execPromise('whoami');
      console.log(`Current user: ${currentUser.trim()}`);
      
      // Check if user is in local administrators (often needed for SQL access)
      try {
        const { stdout: adminCheck } = await execPromise('net localgroup administrators');
        if (adminCheck.includes(currentUser.trim().split('\\')[1])) {
          console.log("✅ User is in local administrators group");
        } else {
          console.log("⚠️ User is not in local administrators group");
          console.log("💡 This might affect SQL Server access\n");
        }
      } catch (adminError) {
        console.log("❓ Could not check administrator status\n");
      }
      
    } catch (error) {
      console.log("❌ Could not check Windows authentication info\n");
    }
  }

  static async runFullDiagnostics() {
    console.log("🏥 SQL Server Connection Full Diagnostics");
    console.log("==========================================\n");
    
    await this.checkSQLServerServices();
    await this.checkNetworkConnectivity();
    await this.checkSQLServerInstances();
    await this.checkWindowsAuthentication();
    const workingConnection = await this.testSQLCMDConnection();
    
    console.log("📋 Summary and Recommendations:");
    console.log("================================");
    
    if (workingConnection) {
      console.log("✅ Found working SQLCMD connection!");
      console.log("💡 Your Node.js app should be able to connect with similar settings");
      console.log(`   Server: ${workingConnection.includes('localhost') ? 'localhost\\SQLEXPRESS' : 'MSI\\SQLEXPRESS'}`);
      console.log("   Authentication: Windows Authentication");
      console.log("   Database: remort\n");
    } else {
      console.log("❌ No working connections found. Try these steps:");
      console.log("1. Start SQL Server services:");
      console.log('   net start "MSSQL$SQLEXPRESS"');
      console.log('   net start "SQLBrowser"');
      console.log("2. Check SQL Server Configuration Manager:");
      console.log("   - Enable TCP/IP protocol");
      console.log("   - Set TCP port to 1433 (optional)");
      console.log("3. Check Windows Firewall");
      console.log("4. Verify database 'remort' exists");
      console.log("5. Try connecting with SQL Server Management Studio first\n");
    }
  }

  // Method to generate the correct Node.js config based on diagnostics
  static generateNodeConfig(serverName = "MSI\\SQLEXPRESS") {
    return {
      server: serverName,
      database: "remort",
      driver: "msnodesqlv8",
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      }
    };
  }
}

// Export for use in main application or run directly
if (require.main === module) {
  SQLServerDiagnostics.runFullDiagnostics().catch(console.error);
}

module.exports = SQLServerDiagnostics;