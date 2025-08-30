const axios = require("axios");

class SoapService {
  constructor() {
    this.endpoint = "http://bdxdisplayapp.somee.com/api/app_data.asmx";
    this.apiKey = "yFlMjSup.IbHOCjyRiTb8QOO9Ltsbr";
    this.skey = "9c4572c4e6ce5ac08292f1b8affad147794d8a9ad55b2b3f08ae2fa15868ec5f";
  }

  // Generic SOAP request sender
  async sendRequest(action, xmlBody) {
    try {
      const response = await axios.post(this.endpoint, xmlBody, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "api-key": this.apiKey,
          "SOAPAction": `http://www.ddacode.lk/${action}`,
        },
      });
      console.log("soap response:",response.data)
      return response.data; // raw SOAP XML
    } catch (err) {
      console.error(`SOAP request failed [${action}]:`, err.message);
      throw err;
    }
  }

  extractResult(soapResponse, tagName) {
    const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, "s");
    const match = soapResponse.match(regex);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]); // Try parse JSON
      } catch {
        return match[1]; // Return plain text (like "OK")
      }
    }
    return null;
  }

  // Register device/screen
  async registerDevice({ screenName, screenLocation, ip, mac, screenStatus, plantCode }) {
    const xmlBody = `
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Reg_app xmlns="http://www.ddacode.lk/">
          <skey>${this.skey}</skey>
          <Screen_name>${screenName}</Screen_name>
          <Screen_location>${screenLocation}</Screen_location>
          <IP>${ip}</IP>
          <MAC>${mac}</MAC>
          <Screen_sts>${screenStatus}</Screen_sts>
          <plant_code>${plantCode}</plant_code>
        </Reg_app>
      </soap:Body>
    </soap:Envelope>`;

    const rawResponse = await this.sendRequest("Reg_app", xmlBody);
    return this.extractResult(rawResponse, "Reg_appResult"); // "OK"
  }

  // Get content for a screen
  async getContent({ screenID }) {
    const xmlBody = `
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <get_URL xmlns="http://www.ddacode.lk/">
          <screenID>${screenID}</screenID>
          <skey>${this.skey}</skey>
        </get_URL>
      </soap:Body>
    </soap:Envelope>`;

    const rawResponse = await this.sendRequest("get_URL", xmlBody);
    return this.extractResult(rawResponse, "get_URLResult"); // JSON array
  }

  async getDeviceByMac(mac) {
    const xmlBody = `
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <get_registerd_device xmlns="http://www.ddacode.lk/">
          <skey>${this.skey}</skey>
          <mac>${mac}</mac>
        </get_registerd_device>
      </soap:Body>
    </soap:Envelope>`;

    const rawResponse = await this.sendRequest("get_registerd_device", xmlBody);
    return this.extractResult(rawResponse, "get_registerd_deviceResult"); // JSON array of devices
  }

  async getAllPlantCodes() {
    const xmlBody = `
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <get_plant_code xmlns="http://www.ddacode.lk/">
          <skey>${this.skey}</skey>
        </get_plant_code>
      </soap:Body>
    </soap:Envelope>`;

    const rawResponse = await this.sendRequest("get_plant_code", xmlBody);
    return this.extractResult(rawResponse, "get_plant_codeResult"); // JSON array of plants
  }
}

module.exports = SoapService;
