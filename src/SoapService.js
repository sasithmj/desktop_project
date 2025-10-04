const axios = require("axios");

class SoapService {
  constructor() {
    // this.endpoint = "http://10.76.152.20/display/api/app_data.asmx";
    this.endpoint = "http://bdxdisplayapp.somee.com/api/app_data.asmx";
    this.apiKey = "yFlMjSup.IbHOCjyRiTb8QOO9Ltsbr";
    this.skey =
      "9c4572c4e6ce5ac08292f1b8affad147794d8a9ad55b2b3f08ae2fa15868ec5f";
  }

  decodeXmlEntities(str) {
    if (!str) return str;
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Generic SOAP request sender with detailed debugging
  async sendRequest(action, xmlBody) {
    try {
      const response = await axios({
        method: "post",
        url: this.endpoint,
        data: xmlBody,
        headers: {
          "Content-Type": "text/xml",
          "api-key": this.apiKey,
        },
        // Additional axios config to match curl behavior
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 600; // Don't throw on any HTTP status
        },
      });

      if (response.status !== 200) {
        console.error(`HTTP ${response.status} error:`, response.data);
      }
      return response.data;
    } catch (err) {
      console.error(`SOAP request failed [${action}]:`, err);
      if (err.response) {
        console.error("Response status:", err.response.status);
        console.error("Response headers:", err.response.headers);
        console.error("Response data:", err.response.data);
      }
      throw err;
    }
  }

  extractResult(soapResponse, tagName) {
    const regex = new RegExp(
      `<${tagName}><!\\[CDATA\\[(.*?)\\]\\]></${tagName}>|<${tagName}>(.*?)</${tagName}>`,
      "s"
    );
    const match = soapResponse.match(regex);
    if (match) {
      let content = match[1] || match[2];
      if (content) {
        // Always decode XML entities here
        content = this.decodeXmlEntities(content);

        try {
          return JSON.parse(content);
        } catch {
          return content; // Return as string if not JSON
        }
      }
    }
    return null;
  }

  async registerDevice({
    screenName,
    screenLocation,
    ip,
    mac,
    screenStatus,
    plantCode,
  }) {
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
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_registerd_device xmlns="http://www.ddacode.lk/">
      <skey>${this.skey}</skey>
      <mac>${mac}</mac>
    </get_registerd_device>
  </soap:Body>
</soap:Envelope>`;

    const rawResponse = await this.sendRequest("get_registerd_device", xmlBody);
    return this.extractResult(rawResponse, "get_registerd_deviceResult");
  }

  async getAllPlantCodes() {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_plant_code xmlns="http://www.ddacode.lk/">
      <skey>${this.skey}</skey>
    </get_plant_code>
  </soap:Body>
</soap:Envelope>`;

    const rawResponse = await this.sendRequest("get_plant_code", xmlBody);
    return this.extractResult(rawResponse, "get_plant_codeResult");
  }

  async getRefreshTime(screenId) {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_next_refresh xmlns="http://www.ddacode.lk/">
      <skey>${this.skey}</skey>
      <screnid>${screenId}</screnid>
    </get_next_refresh>
  </soap:Body>
</soap:Envelope>`;

    const rawResponse = await this.sendRequest("get_next_refresh", xmlBody);
    return this.extractResult(rawResponse, "get_next_refreshResult");
  }
}

module.exports = SoapService;
