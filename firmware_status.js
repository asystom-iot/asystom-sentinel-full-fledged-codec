class UnknownSentinelDeviceHealth extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class SentinelDeviceHealth {
    constructor(description, value) {
        this._description = description;
        this._value = value;
      }

    toString() {
        return `${this._description}`;
    }

    getValue() {
        return this._value;
    }

    static getEnum(value) {
        let result = Object.values(SentinelDeviceHealth)[value];
        if (result === undefined) {
            throw new UnknownSentinelDeviceHealth(`Invalid Sentinel device health value (${value})`);
        }
        return result;
    }

    // Specifying the numerical value attached to each enum value is just a safety measure, in case someone would introduce new enum values in between.
    // Indeed, these values represent the precise numerical value uplinked in a beacon data frame.
    static LorawanOk = new SentinelDeviceHealth('LoRaWAN Ok', 0);
    static LorawnUnknownUnsollicitedReception = new SentinelDeviceHealth('LoRaWAN unknown unsollicited reception', 1);
    static LorawanInvalidDoubleDataLength = new SentinelDeviceHealth('LoRaWAN invalid double data length', 2);
    static LorawanUnknownTransmissionError = new SentinelDeviceHealth('LoRaWAN unknown transmission error', 3);
    static LorawanPendingTransmission = new SentinelDeviceHealth('LoRaWAN pending transmission', 4);
    static LorawanLinkCheckFailed = new SentinelDeviceHealth('LoRaWAN link check failed', 5);
    static LorawanConsecutiveUnsollicitedMessageMissed = new SentinelDeviceHealth('LoRaWAN consecutive unsollicited message missed', 6);
    static LorawanInvalidParameterReceived = new SentinelDeviceHealth('LoRaWAN invalid parameter received', 7);
    static LorawanModemWakeupFailed = new SentinelDeviceHealth('LoRaWAN modem wakeup failed', 8);
    static LorawanDataRateTooLow = new SentinelDeviceHealth('LoRaWAN data rate too low', 9);
}


class SentinelFirmwareStatus {
    static extractFirmwareStatus(lastBootCausesSoftware, lastBootCausesHardware1stByte, lastBootCausesHardware2ndByte) {

        let firmwareStatus = {
            lastBootCauses: [],
            softwareStatus: ""
        };

        // Register HW-related boot causes
        if ((lastBootCausesHardware2ndByte & 0x1) != 0) {
            // console.log(">> Low Leakage Wakeup");
            firmwareStatus.lastBootCauses.push("Low Leakage Wakeup");
        }

        if ((lastBootCausesHardware2ndByte & (0x1 << 1)) != 0) {
            // console.log(">> Low Voltage Detect Reset");
            firmwareStatus.lastBootCauses.push("Low Voltage Detect Reset");
        }

        if ((lastBootCausesHardware2ndByte & (0x1 << 2)) != 0) {
            // console.log(">> Loss of Clock Reset");
            firmwareStatus.lastBootCauses.push("Loss of Clock Reset");
        }
        
        if ((lastBootCausesHardware2ndByte & (0x1 << 3)) != 0) {
            // console.log(">> Loss of Lock Reset");
            firmwareStatus.lastBootCauses.push("Loss of Lock Reset");
        }
        
        if ((lastBootCausesHardware2ndByte & (0x1 << 5)) != 0) {
            // console.log(">> Watchdog");
            firmwareStatus.lastBootCauses.push("Watchdog");
        }
        
        if ((lastBootCausesHardware2ndByte & (0x1 << 6)) != 0) {
            // console.log(">> External Reset Pin");
            firmwareStatus.lastBootCauses.push("External Reset Pin");
        }
        
        if ((lastBootCausesHardware2ndByte & (0x1 << 7)) != 0) {
            // console.log(">> Power On Reset");
            firmwareStatus.lastBootCauses.push("Power On Reset");
        }
        
        if ((lastBootCausesHardware1stByte & 0x1) != 0) {
            // console.log(">> Jtag Generated Reset");
            firmwareStatus.lastBootCauses.push("Jtag Generated Reset");
        }
        
        if ((lastBootCausesHardware1stByte & (0x1 << 1)) != 0) {
            // console.log(">> Core Lockup");
            firmwareStatus.lastBootCauses.push("Core Lockup");
        }
        
        if ((lastBootCausesHardware1stByte & (0x1 << 2)) != 0) {
            // console.log(">> Software - SYSRESETREQ bit");
            firmwareStatus.lastBootCauses.push("Software - SYSRESETREQ bit");
        }

        if ((lastBootCausesHardware1stByte & (0x1 << 3)) != 0) {
            // console.log(">> MDM-AP System Reset Request");
            firmwareStatus.lastBootCauses.push("MDM-AP System Reset Request");
        }

        if ((lastBootCausesHardware1stByte & (0x1 << 5)) != 0) {
            // console.log(">> Stop Mode Acknowledge Error Reset");
            firmwareStatus.lastBootCauses.push("Stop Mode Acknowledge Error Reset");
        }

        // Register device software-related boot causes
        // console.log(`software_infos = ${firmwareStatus.lastBootCauses}`);
        // console.log(`software_infos as hex = Ox${lastBootCausesSoftware.toString(16)}`);

        let lastBootCauseSoftwareAsEnum;
        try {
            lastBootCauseSoftwareAsEnum = SentinelDeviceHealth.getEnum(lastBootCausesSoftware);
            firmwareStatus.softwareStatus = lastBootCauseSoftwareAsEnum.toString();
        }
        catch(ex) {
            firmwareStatus.softwareStatus = ex.message;
        }

        return firmwareStatus;
    }
}

module.exports = {
    SentinelDeviceHealth,
    SentinelFirmwareStatus
}