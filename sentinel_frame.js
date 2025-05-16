const fs = require('fs');

const { FrameUtilities } = require('./frame_utilities');
const { PhysicalValue, VECTOR_TYPES,
    BATTERY_LEVEL_IDENTIFIER, CURRENT_LOOP_IDENTIFIER, TEMPERATURE_IDENTIFIER, HUMIDITY_IDENTIFIER,
    SHOCK_DETECTION_VECTOR, SIGNATURE_VECTOR, SIGNATURE_REFEFENCE, SIGNATURE_EXTENSIONS, SYSTEM_STATUS_REPORT,
    SCALAR_VALUE_SIZE, VECTOR_ELEMENT_VALUE_SIZE, SENSOR_TYPES, ACCELEROMETER_ORIENTATION_TYPES,
    EXTENSION_ACTIVATION_TYPES, EXTENSION_ALGORITHM_FFT_ZOOM,
    EXTENSION_ALGORITHM_TYPES, COMPRESSION_TYPES, SPECTRUM_TYPES } = require('./physical_value');
const { SentinelFirmwareStatus } = require('./firmware_status');
const { SegmentedFrame, FrameSegmentationException } = require('./segmented_frame');
const { decodeUplink } = require('./asystom_sentinel_codec');


class AccessToSettingsFileException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class UnknownVectorTypeException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class UnknownExtensionHandleException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class UnknownExtensionAlgorithmException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class UnknownCompressionTypeException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class NotImplementedException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class InvalidNumberOfElementException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

const SchedulingPeriodScaleFactor = 10;
const SonicFrequencyScaleFactor = 10;
const RPMScaleFactor = 60;

const EXTENSION_SETTINGS_FILE_PREFIX = 'extensionSettings';


class SentinelFrame {
    static logging_on = false;

    static setLogging(value) {
        SentinelFrame.logging_on = value;
    }

    constructor(lorawanMessage) {
        this._lorawanMessage = lorawanMessage;
        this._metadata = {};
        this._scalarValues = [];
        this._signatureValues = [];
        this._extensionValues = [];
        this._firmwareStatus = {};
        this._firmwareVersion = "";
        this._type = this.constructor.name;
        this._decodedResult = {};
        this._segmentedFrame = null;
        this._extensionSettingsFileName = null;
        this._extensionSettings = null;
    }

    getType() {
        return this._type;
    }

    getMetadata() {
        return this._metadata;
    }

    getDeveui = function () {
        return this._metadata.deveui;
    }

    getFport = function () {
        return this._metadata.fPort;
    }

    getElementCount = function () {
        return this._metadata.elementCount;
    }

    getPayload = function () {
        return this._payload;
    }

    getClient = function () {
        return this._metadata.client;
    }

    getGatewayNumber = function () {
        return this._metadata.gatewayNumber;
    }

    getRSSI = function () {
        return this._metadata.rssi;
    }

    getDataRate = function () {
        return this._metadata.dataRate;
    }

    getSoundNoiseRatio = function () {
        return this._metadata.soundNoiseRatio;
    }

    getFrequency = function () {
        return this._metadata.frequency;
    }

    getTimeStamp = function () {
        return this._metadata.timeStamp;
    }

    getSensor = function () {
        return this._metadata.sensor;
    }

    getScalarValues() {
        return this._scalarValues;
    }

    getSignatureValues() {
        return this._signatureValues;
    }

    getExtensionValues() {
        return this._extensionValues;
    }

    getFirmwareStatus() {
        return this._firmwareStatus;
    }

    getFirmwareVersion() {
        return this._firmwareVersion;
    }

    getDecodedResult() {
        return this._decodedResult;
    }

    setDecodedResult(result) {
        this._decodedResult = result;
    }

    getExtensionSettingsFileName() {
        if (this._extensionSettingsFileName === null) {
            this._extensionSettingsFileName = `.${EXTENSION_SETTINGS_FILE_PREFIX}.${this.getDeveui()}.json`;
        }

        return this._extensionSettingsFileName;
    }

    // Store extension settings in a device-specific file
    storeExtensionSettings(extensionSettings) {
        const jsonString = JSON.stringify(extensionSettings, null, 4);

        try {
            fs.writeFileSync(this.getExtensionSettingsFileName(), jsonString);
            if (SentinelFrame.logging_on) {
                console.log(`Extension settings successfully stored in file ${this.getExtensionSettingsFileName()}`);
            }
        }
        catch (err) {
            let errorMessage = `Could not store extension settings in file "${this.getExtensionSettingsFileName()}" (${err})`;
            console.error(errorMessage);
            throw new AccessToSettingsFileException(errorMessage);
        }
    }

    // Function to read the extension settings from the local file
    getExtensionSettings() {
        try {
            const extensionSettingsString = fs.readFileSync(this.getExtensionSettingsFileName(), 'utf8');

            // Convertir le contenu du fichier en objet JavaScript
            let extensionSettings = JSON.parse(extensionSettingsString);

            return extensionSettings;
        }
        catch (err) {
            let errorMessage = `Could not read extension settings file "${this.getExtensionSettingsFileName()}" : ${err}`;
            console.warn(errorMessage);
            throw new AccessToSettingsFileException(errorMessage);
        }
    }

    // This polymorphic method turns a raw Sentinel frame into a canonical one.
    // A canonical frame holds all useful information from a frame,
    // whatever its origin and thus internal organization, in a standardized structure.
    makeCanonical() {
        throw new NotImplementedException('makeCanonical method is not implemented');
    }

    // This method extracts measurements and settings from a canonical frame.
    // As the frame is canonical, this method needs not be polymorphic.
    // NB. If the decoding is NOT performed by the LoRaWAN Codec API specification-compliant
    // codec, the return value is "false" if the current frame is a frame segment
    // and not the final one. If it is the final segment of a split frame, and
    // if the CRC is valid, then it returns true.
    // The return value of the LoRaWAN Codec API specification-compliant codec is the
    // standard result as specified by the LoRaWAN Codec API Specification.
    decode(use_codec) {
        if (use_codec === true) {
            if (SentinelFrame.logging_on === true) {
                console.log("---> USING CODEC");
            }

            let codec_decode_input = {
                deveui: this._metadata.deveui,
                gateway:  this._metadata.gatewayNumber,
                bytes: this._payload,
                fPort: this._metadata.elementCount,
                recvTime: this._metadata.timeStamp
            };

            return decodeUplink(codec_decode_input);
        }

        if (SentinelFrame.logging_on === true) {
            console.log("NOT USING CODEC");
        }

        // Case where data seem corrupted
        if (this._metadata.elementCount > 105) {
            let errorMessage = `Invalid number of elements in frame (${this._metadata.elementCount})`;
            console.warn(errorMessage);
            throw new InvalidNumberOfElementException(errorMessage);
        }

        // Get first element id
        let elementId = this._payload[0];

        if (SentinelFrame.logging_on === true) {
            console.log(`First element id = ${elementId}`);
        }

        // Manage system status report from old beacons as system status report from recent ones
        if (this._metadata.elementCount === 67 && elementId === 0xFF) {
            if (this._payload.length === 84) {
                if (SentinelFrame.logging_on === true) {
                    console.log("Setting element count to 1 as this looks like a system status report frame");
                }

                this._metadata.elementCount = 1;
            }

            else {
                let errorMessage = "Inconsistent data from frame (looks partly as a system status report)";
                console.warn(errorMessage);
                throw new InvalidNumberOfElementException(errorMessage);
            }
        }

        // Case of the first chunk of a segmented frame
        if (this._metadata.elementCount === 100) {
            if (SentinelFrame.logging_on === true) {
                console.log(`FPort = ${this._metadata.elementCount} ==> This is the first chunk of a segmented frame.`);
            }

            this._segmentedFrame = new SegmentedFrame(this._payload);
            return false;
        }

        // Case of an intermediary or final segmented frame chunk
        if ((this._metadata.elementCount > 100) && (this._metadata.elementCount < 105)) {
            if (SentinelFrame.logging_on === true) {
                console.log(`FPort = ${this._metadata.elementCount} ==> This is a following chunk of a segmented frame.`);
            }

            if (this._segmentedFrame === null) {
                if (SentinelFrame.logging_on === true) {
                    console.log("This is a following chunk of a segmented frame, but the first one has been lost");
                }

                return false;
            }

            // Avoid getting into trouble if segmented frames are duplicated.
            // This means dropping frame chunks which are exactly the same as the previous one.
            this._segmentedFrame.addPayloadChunk(this._payload);

            // Not the final chunk --> current frame chunk fully processed
            if (! this._segmentedFrame.isComplete()) {
                return false;
            }

            // Final chunk received --> prepare further processing
            if (this._segmentedFrame.checkCrc()) {
                this._payload = this._segmentedFrame.getUsefulPayload();
                this._metadata.elementCount = this._segmentedFrame.getNbElements();
                this._segmentedFrame = null;
            }

            // Case where there was a problem during transmission
            else {
                throw new FrameSegmentationException(`Frame segmentation problem from device ${this.getDeveui()}`);
            }
        }

        let nbScalars;
        let vectorInFrame = false;

        // Case where there is no vector
        if (this._payload.length === (this._metadata.elementCount * SCALAR_VALUE_SIZE)) {  // 2 characters are needed to represent a byte in hex format
            nbScalars = this._metadata.elementCount;
        }
        else {
            if (this._payload.length < (this._metadata.elementCount * SCALAR_VALUE_SIZE)) {
                let errorMessage = `Inconsistent number of elements in frame (${this._metadata.elementCount}) and frame length (${this._payload.length / 2})`;
                console.warn(errorMessage);
                throw new InvalidNumberOfElementException(errorMessage);
            }
            else {
                nbScalars = this._metadata.elementCount - 1;
                vectorInFrame = true;
            }
        }

        if (SentinelFrame.logging_on === true) {
            if (vectorInFrame) {
                console.log(`There is a vector in the frame and ${nbScalars} scalars.`);
            }
            else {
                console.log(`There are only scalars in the frame, they are ${nbScalars}.`);
            }
        }

        // Extract scalar values
        if (nbScalars > 0) {
            this.extractScalarValues(nbScalars);
        }

        // Extract vector content
        if (vectorInFrame) {
            let vectorStart = nbScalars * SCALAR_VALUE_SIZE + 1;

            if (SentinelFrame.logging_on === true) {
                console.log(`Vector length = ${this._payload.length}, start index = ${vectorStart}, end index = ${this._payload.length - 1}`);
            }

            let vector = this._payload.subarray(vectorStart);
            // let vector = this._payload.subarray(this._metadata.elementCount*SCALAR_VALUE_SIZE + 1, this._payload.length - this._metadata.elementCount * SCALAR_VALUE_SIZE);

            let vectorType = this._payload.readUInt8(nbScalars*SCALAR_VALUE_SIZE);

            if (SentinelFrame.logging_on === true) {
                console.log(`Vector type = ${vectorType} (0x${vectorType.toString(16)})`);
            }

            this.processVectorContent(vectorType, vector);
        }

        // Register displayable information
        this.setDecodedResult({
            data: {
                advancedSettings: this._advancedSettings,
                schedulingSettings: this._schedulingSettings,
                extensionSettings: this._extensionSettings,
                scalarValues: this._scalarValues,
                signatureValues: this._signatureValues,
                extensionValues: this._extensionValues
            }
        });

        return true;
    }

    // This method extracts scalar values from the frame
    extractScalarValues(nbScalars) {
        let physicalValues = [];
        let unit = "";
        let name = "";
        let valueInFrame;
        let frame = this._payload;

        for (let i = 0; i < nbScalars * SCALAR_VALUE_SIZE; i += SCALAR_VALUE_SIZE) {

            // Check whether architecture is little endian or not
            if (! FrameUtilities.isLittleEndian()) {
                valueInFrame = frame.readInt16BE(i+1);
            }
            else {
                valueInFrame = frame.readInt16LE(i+1);
            }

            let min = 0.0, max = 100.0;
            let scale = 65535;
            let physicalValue;

            let valueToCompute = true;

            switch (frame[i]) {
                case BATTERY_LEVEL_IDENTIFIER:
                    name = "Battery level";
                    unit = "Volt";
                    if (SentinelFrame.logging_on === true) {
                        console.log("Battery voltage measurement received");
                    }
                    break;
                case CURRENT_LOOP_IDENTIFIER:
                    name = "Current loop";
                    min = 0;        
                    max = 30;
                    break;
                case HUMIDITY_IDENTIFIER:
                    name = "Humidity";
                    unit = "% rH";
                    if (SentinelFrame.logging_on === true) {
                        console.log("Humidity measurement received");
                    }
                    break;
                case TEMPERATURE_IDENTIFIER:
                    name = "Ambient temperature";
                    unit = "°C";
                    if (SentinelFrame.logging_on === true) {
                        console.log("Ambient temperature measurement received");
                    }
                    min = -273.15;
                    max = 2000;
                    break;
                default:
                    console.warn(`Unindentified scalar value indicator (${frame[i]})`);
                    valueToCompute = false;
                    break;
            }

            if (valueToCompute) {
                physicalValue = valueInFrame * (max - min) / scale + min;

                let valueItem = new PhysicalValue(name, unit, physicalValue);

                if (SentinelFrame.logging_on === true) {
                    console.log(valueItem);
                }

                physicalValues.push(valueItem);
            }
        }

        this._scalarValues = physicalValues;
    }

    // Extract physical values from a signature vector
    // The input vector argument is a Buffer
    extractSignatureValues(vector) {
        let physicalValues = [];

        let nbElements = vector.length / VECTOR_ELEMENT_VALUE_SIZE;

        for (let frameIndex = 0, measurementIndex = 0; frameIndex < nbElements*VECTOR_ELEMENT_VALUE_SIZE; frameIndex += VECTOR_ELEMENT_VALUE_SIZE, ++measurementIndex) {

            // Check whether architecture is little endian or not
            let valueInFrame;
            if (! FrameUtilities.isLittleEndian()) {
                valueInFrame = vector.readInt16BE(frameIndex);
            }
            else {
                valueInFrame = vector.readInt16LE(frameIndex);
            }

            let scale = 65535;
            let physicalValue;

            // Skip values that are not useful anymore
            if (PhysicalValue.signaturePhysicalValues[measurementIndex].name === "") {
                continue;
            }

            physicalValue = valueInFrame * (PhysicalValue.signaturePhysicalValues[measurementIndex].max - PhysicalValue.signaturePhysicalValues[measurementIndex].min) / scale + PhysicalValue.signaturePhysicalValues[measurementIndex].min;

            let valueItem = PhysicalValue.signaturePhysicalValues[measurementIndex];
            valueItem.value = physicalValue;

            if (SentinelFrame.logging_on === true) {
                console.log(valueItem);
            }

            physicalValues.push(valueItem);
        }

        this._signatureValues = physicalValues;
    }

    // Extract physical values from an extension vector (FFT zoom)
    // The input vector argument is a Buffer
    extractExtensionValues(vector) {

        // Get the last known extension settings
        if (this._extensionSettings === null) {
            this._extensionSettings = this.getExtensionSettings();
        }

        let extensionHandle = vector[vector.length - 1];

        // Check that the handle as uplinked corresponds to the one known to C8y inventory
        if (extensionHandle !== this._extensionSettings.handle) {
            let errorMessage = `Unknown extension settings handle "${extensionHandle}", cannot proceed.`;
            console.warn(errorMessage);
            throw new UnknownExtensionHandleException(errorMessage);
        }

        // Currently, only algorithm #0 (FFT zoom) is supported
        if (this._extensionSettings.algorithm !== 0) {
            let errorMessage = `Unknown extension algorithm "${this._extensionSettings.algorithm}, only FFT zoom (#0) is implemented yet. Cannot proceed.`;
            console.warn(errorMessage);
            throw new UnknownExtensionAlgorithmException(errorMessage);
        }

        // The payload consists in values according to a frequency spectrum.
        let payloadLength = vector.length - 1;

        let signatureElementSize; // In bytes
        let nbElements;
        let scale;
        let errorMessage;

        switch(this._extensionSettings.compressionType) {
            case 0:
            case 2:
            case 4:
                nbElements = payloadLength;
                signatureElementSize = 1;
                scale = 255.0;
                break;
            case 1:
            case 3:
                nbElements = payloadLength / 2;
                signatureElementSize = 2;
                scale = 65535.0;
                break;
            default:
                errorMessage = `Unknown compression type (${this._extensionSettings.compressionType}), cannot proceed.`;
                console.warn(errorMessage);
                throw new UnknownCompressionTypeException(errorMessage);
            }

        let extensionValues = [];

        let decodeFunction;
        if (! FrameUtilities.isLittleEndian()) {
            decodeFunction = vector.readUint16BE.bind(vector);
        }
        else {
            decodeFunction = vector.readUint16LE.bind(vector);
        }

        for (let frameIndex = 0, measurementIndex = 0; frameIndex < nbElements * signatureElementSize; frameIndex += signatureElementSize, ++measurementIndex) {

            let valueInFrame;

            // Values are little endian-organized
            if (signatureElementSize === 1) {
                valueInFrame = vector[frameIndex];
            }
            else {
                valueInFrame = decodeFunction(frameIndex);
            }

            if (PhysicalValue.fftZoomPhysicalValues[measurementIndex].getName() === "") {
                continue;
            }

            let valueItem = PhysicalValue.fftZoomPhysicalValues[measurementIndex];

            let physicalValue = valueInFrame * (valueItem.getMax() - valueItem.getMin()) / scale + valueItem.getMin();

            valueItem.value = physicalValue;

            extensionValues.push(valueItem);
        }

        this._extensionValues = extensionValues;
    }

    // Turn activation bitmask into a text string
    getActivationBitmaskString(bitmask) {
        let theResult = "";

        for (let i = 0; i < 4; ++i) {
            let theByte = bitmask[i];

            for (let j = 0; j < 8; ++j) {
                let isOn = (theByte & (0x1 << j)) !== 0;
                if (isOn) {
                    switch ((8*i) + j) {
                        case 0:
                            theResult += "Battery level scheduling is active\n";
                            break;
                        case 2:
                            theResult += "Humidity scheduling is active\n";
                            break;
                        case 4:
                            theResult += "Mileage scheduling is active\n";
                            break;
                        case 7:
                            theResult += "Pressure scheduling is active\n";
                            break;
                        case 8:
                            theResult += "Wake-on event scheduling is active\n";
                            break;
                        case 9:
                            theResult += "Machine drift scheduling is active\n";
                            break;
                        case 10:
                            theResult += "Shock detection scheduling is active\n";
                            break;
                        case 11:
                            theResult += "Signature scheduling is active\n";
                            break;
                        case 12:
                            theResult += "Signature reference scheduling is active\n";
                            break;
                        case 13:
                            theResult += "Signature extension scheduling is active\n";
                            break;
                        case 14:
                            theResult += "Temperature scheduling is active\n";
                            break;
                        case 16:
                            theResult += "PT100 probe scheduling is active\n";
                            break;
                        case 17:
                            theResult += "TC probe scheduling is active\n";
                            break;
                        case 18:
                            theResult += "Ambient aggregator scheduling is active\n";
                            break;
                        case 19:
                            theResult += "Wave scheduling is active\n";
                            break;
                        case 20:
                            theResult += "LoRa link scheduling is active\n";
                            break;
                        case 21:
                            theResult += "Settings reader scheduling is active\n";
                            break;
                        default:
                            break;
                    }
                }
            }
        }

        return theResult;
    }

    // Extract scheduling settings
    extractSchedulingSettings(schedulingSettings) {
        this._schedulingSettings = {
            activationBitmask: schedulingSettings.subarray(0, 4).toString('hex'),
            ambientPeriodicity: schedulingSettings.readUInt16LE(4) * SchedulingPeriodScaleFactor,
            predictionPeriodicity: schedulingSettings.readUInt16LE(6) * SchedulingPeriodScaleFactor,
            introspectionPeriodicity: schedulingSettings.readUInt16LE(8) * SchedulingPeriodScaleFactor
        };

        if (SentinelFrame.logging_on === true) {
            console.log(this.getActivationBitmaskString(schedulingSettings));
            console.log(`Ambient periodicity = ${this._schedulingSettings.ambientPeriodicity}`);
            console.log(`Prediction periodicity = ${this._schedulingSettings.predictionPeriodicity}`);
            console.log(`Introspection periodicity = ${this._schedulingSettings.introspectionPeriodicity}`);
        }
    }

    // Store sensor-related information
    setSensorInformation(bitmask) {
        this._advancedSettings.sensorInformation = {
            enumeration: "",
        };

        let sensorEnumeration = bitmask[0];  // 32-bit status data is stored as little endian on firmware and copied as-is

        if ((sensorEnumeration & 0x3) === 0x3) {
            this._advancedSettings.sensorInformation.enumeration += "AnyAccelerometer\n";
        }

        if ((sensorEnumeration & 0xc) === 0xc) {
            this._advancedSettings.sensorInformation.enumeration += "AnyMicrophone";
        }

        // Only supported sensors are accelerometer and microphone
        // If the bitfield contains nothing, then it's an error
        if ((sensorEnumeration & 0xf) === 0) {
            this._advancedSettings.sensorInformation.enumeration = "NoSensor";
            console.warn("No sensor information in frame, this is unexpected");
        }

        // To-Do : there is a bug here --> the sensor orientation is expressed on 3 bytes, not 1, and not at this place either
        // This must be tested by specifying the orientation for FFT zoom settings in the Grafana plugin
        // and checking the output hex string in the web browser
        let sensorOrientation = bitmask[2];
        if (sensorOrientation === 0) {
            this._advancedSettings.sensorInformation.orientation = "NoOrientation";
        }
        else if (sensorOrientation === 1) {
            this._advancedSettings.sensorInformation.orientation = "XPreferred";
        }
        else if (sensorOrientation === 2) {
            this._advancedSettings.sensorInformation.orientation = "YPreferred";
        }
        else if (sensorOrientation === 4) {
            this._advancedSettings.sensorInformation.orientation = "ZPreferred\n";
        }
    }

    // Set Wake_On-Event information
    // See firmware header file utils/datamodel.h
    setWoeInfos(woeBytes, index) {
        let paramsAndFlagAndMode = woeBytes.readUInt16LE(index);
        let thresholdAndProfile = woeBytes.readUInt16LE(index + 2);

        this._advancedSettings.wakeOnEventInformation = {
            woeMode: paramsAndFlagAndMode & 0xF,
            woeFlag: ((paramsAndFlagAndMode & 0x10) >> 4) === 1,
            woeParam: (paramsAndFlagAndMode & 0xFFE0) >> 5,
            woeProfile: thresholdAndProfile & 0x3,
            woeThreshold: (thresholdAndProfile & 0xFFFC) >> 2,
            woePretrigThreshold: woeBytes.readUInt16LE(index + 4),
            woePostrigThreshold: woeBytes.readUInt16LE(index + 6),
        }

        switch(this._advancedSettings.wakeOnEventInformation.woeMode) {
            case 0:
                this._advancedSettings.wakeOnEventInformation.woeModeString = "WoeInactive";
                break;
            case 1:
                this._advancedSettings.wakeOnEventInformation.woeModeString = "WoeMotionTrig";
                break;
            case 2:
                this._advancedSettings.wakeOnEventInformation.woeModeString = "WoeMotionTrigAuto";
                break;
            case 3:
                this._advancedSettings.wakeOnEventInformation.woeModeString = "WoeSchedulerTrig";
                break;
            case 4:
                this._advancedSettings.wakeOnEventInformation.woeModeString = "WoeAnalogTrig";
                break;
            case 5:
                this._advancedSettings.wakeOnEventInformation.woeModeString = "WoeContactTrig";
                break;
            default:
                console.error(`Unknown Wake-On-Event mode "${this._advancedSettings.wakeOnEventInformation.woeMode}"`);
                break;
        }

        if (SentinelFrame.logging_on === true) {
            console.log(this._advancedSettings.wakeOnEventInformation);
        }
    }

    // Register LoRaWAN configuration in the frame
    setLorawanConfig(bytes, index) {
        this._advancedSettings.lorawanConfig = {};

        if ((bytes[index] & 0x1) !== 0) {
            this._advancedSettings.lorawanConfig.adrIsEnabled = true;
        }
        else {
            this._advancedSettings.lorawanConfig.adrIsEnabled = false;
        }

        if ((bytes[index] & (0x1 << 1)) !== 0) {
            this._advancedSettings.lorawanConfig.transmissionIsAcked = true;
        }
        else {
            this._advancedSettings.lorawanConfig.transmissionIsAcked = false;
        }

        if ((bytes[index] & (0x1 << 2)) !== 0) {
            this._advancedSettings.lorawanConfig.networkIsPrivate = true;
        }
        else {
            this._advancedSettings.lorawanConfig.networkIsPrivate = false;
        }

        if ((bytes[index] & (0x1 << 3)) !== 0) {
            this._advancedSettings.lorawanConfig.lorawanCodingRateIsBase = true;
        }
        else {
            this._advancedSettings.lorawanConfig.lorawanCodingRateIsBase = false;
        }

        if ((bytes[index] & (0x1 << 4)) !== 0) {
            this._advancedSettings.lorawanConfig.dwellTimeIsOn = true;
        }
        else {
            this._advancedSettings.lorawanConfig.dwellTimeIsOn = false;
        }

        if ((bytes[index] & (0x1 << 5)) !== 0) {
            this._advancedSettings.lorawanConfig.retransmitAckTwice = true;
        }
        else {
            this._advancedSettings.lorawanConfig.retransmitAckTwice = false;
        }

        if ((bytes[index] & (0x1 << 6)) !== 0) {
            this._advancedSettings.lorawanConfig.packetSplitIsEnabled = true;
        }
        else {
            this._advancedSettings.lorawanConfig.packetSplitIsEnabled = false;
        }

        this._advancedSettings.lorawanConfig.specialFrequencySettings = bytes.readUInt16LE(index + 2);
        this._advancedSettings.lorawanConfig.linkCheckPeriod = bytes.readUInt16LE(index + 4);

        if (SentinelFrame.logging_on === true) {
            console.log(this._advancedSettings.lorawanConfig);
        }
    }

    // Extract advanced settings
    extractAdvancedSettings(advancedSettings) {
        this._advancedSettings = {
            sensorInformationBitmask: advancedSettings.subarray(0, 4).toString('hex'),
        };

        if (SentinelFrame.logging_on === true) {
            console.log(this._advancedSettings.sensorInformationBitmask);
        }

        this.setSensorInformation(advancedSettings);

        if (SentinelFrame.logging_on === true) {
            console.log(this._advancedSettings.sensorInformation);
        }

        this._advancedSettings.frequencies = {
            sonicFrequencyHigh: advancedSettings.readUInt16LE(4) * SonicFrequencyScaleFactor,
            sonicFrequencyLow: advancedSettings.readUInt16LE(6) * SonicFrequencyScaleFactor,
            vibrationFrequencyHigh: advancedSettings.readUInt16LE(8),
            vibrationFrequencyLow: advancedSettings.readUInt16LE(10),
        }

        if (SentinelFrame.logging_on === true) {
            console.log(this._advancedSettings.frequencies);
        }

        this._advancedSettings.rotationSpeedBoundaries = {
            rpmUpperBoundary: advancedSettings.readUInt16LE(12) * RPMScaleFactor,
            rpmLowerBoundary: advancedSettings.readUInt16LE(14) * RPMScaleFactor,
        }

        if (SentinelFrame.logging_on === true) {
            console.log(this._advancedSettings.rotationSpeedBoundaries);
        }

        this._advancedSettings.mileageThreshold = advancedSettings.readUInt16LE(16);

        if (SentinelFrame.logging_on === true) {
            console.log(`Mileage threshold = ${this._advancedSettings.mileageThreshold}`);
        }

        this._advancedSettings.referenceCustomParam = advancedSettings.readUInt16LE(18);

        if (SentinelFrame.logging_on === true) {
            console.log(`Reference custom param = ${this._advancedSettings.referenceCustomParam}`);
        }

        this._advancedSettings.customSpectrumType = advancedSettings.readUInt16LE(20);

        if (SentinelFrame.logging_on === true) {
            console.log(`Custom spectrum type = ${this._advancedSettings.customSpectrumType}`);
        }

        this._advancedSettings.customSpectrumParam = advancedSettings.readUInt16LE(22);

        if (SentinelFrame.logging_on === true) {
            console.log(`Custom spectrum param = ${this._advancedSettings.customSpectrumParam}`);
        }

        this._advancedSettings.woeBitmask = advancedSettings.subarray(24, 4);

        if (SentinelFrame.logging_on === true) {
            console.log(`WOE bitmask = ${this._advancedSettings.woeBitmask}`);
        }

        this.setWoeInfos(advancedSettings, 24);

        this.setLorawanConfig(advancedSettings, 32);
    }

    // Extract extension settings
    extractExtensionSettings(extensionSettings) {
        this._extensionSettings = {};

        // Extension handle
        this._extensionSettings.handle = extensionSettings[0];
    
        // Extension activation state
        this._extensionSettings.activation = extensionSettings[1];
    
        // Case where the activation type is unknown
        if (EXTENSION_ACTIVATION_TYPES.includes(this._extensionSettings.activation) === false) {
            let error_message = `Unknown extension activation state (${this._extensionSettings.activation})`;
            console.warn(error_message);
        }
    
        // Activation steps (for periodic activation state)
        this._extensionSettings.steps = extensionSettings[2];
    
        // Extension algorithm
        this._extensionSettings.algorithm = extensionSettings[3];
    
        // Case where the extension algorithm is unknown
        if (EXTENSION_ALGORITHM_TYPES.includes(this._extensionSettings.algorithm) === false) {
            let error_message = `Unknown extension algorithm type (${this._extensionSettings.algorithm})`;
            console.warn(error_message);
        }
    
        // Sensor type for extension algorithm
        this._extensionSettings.sensorType = extensionSettings[4];
    
        // Case where the sensor type is unknown
        if (SENSOR_TYPES.includes(this._extensionSettings.sensorType) === false) {
            let error_message = `Unknown sensor type (${this._extensionSettings.sensorType})`;
            console.warn(error_message);
        }
    
        // Accelerometer orientation
        this._extensionSettings.accelerometerOrientation = extensionSettings[5];
    
        // Case where the accelerometer orientation is unknown
        if (ACCELEROMETER_ORIENTATION_TYPES.includes(this._extensionSettings.accelerometerOrientation) === false) {
            let error_message = `Unknown accelerometer orientation (${this._extensionSettings.accelerometerOrientation})`;
            console.warn(error_message);
        }
    
        // Extract FFT zoom algorithm parameters
        if (this._extensionSettings.algorithm === EXTENSION_ALGORITHM_FFT_ZOOM) {
    
            // Upper frequency
            this._extensionSettings.upperFrequency = extensionSettings.subarray(6, 10).readUInt32LE();
    
            // Lower frequency
            this._extensionSettings.lowerFrequency = extensionSettings.subarray(10, 14).readUInt32LE();
    
            // Compression type
            this._extensionSettings.compressionType = extensionSettings.subarray(14, 18).readUInt32LE();
    
            // Case where the compression type is unknown
            if (COMPRESSION_TYPES.includes(this._extensionSettings.compressionType) === false) {
                let error_message = `Unknown compression type (${this._extensionSettings.compressionType})`;
                console.warn(error_message);
            }
    
            // Spectrum type
            this._extensionSettings.spectrumType = extensionSettings.subarray(18, 22).readUInt32LE();
    
            // Case where the spectrum type is unknown
            if (SPECTRUM_TYPES.includes(this._extensionSettings.spectrumType) === false) {
                let error_message = `Unknown spectrum type (${this._extensionSettings.spectrumType})`;
                console.warn(error_message);
            }
    
            this._extensionSettings.cutOffFrequency = extensionSettings.subarray(22, 26).readUInt32LE();
        }

        // Store current extension settings in a file
        this.storeExtensionSettings(this._extensionSettings);
    }

    // Extract system status data
    // The "vector" argument points to the start of the status data, i.e. the first byte following the vector type
    // Thus it points to the byte representing the data indicator and is followed by the "last boot cause" 32-bit field
    extractSystemStatusData(vector) {

        // Get last boot causes (software)
        let lastBootCausesSoftware = vector.readInt16BE(0);

        if (SentinelFrame.logging_on === true) {
            console.log(`Last boot cause (software) = 0x${lastBootCausesSoftware.toString(16)}`);
        }

        // Get last boot causes (hardware)
        let lastBootCausesHardware1stByte = vector[2];
        let lastBootCausesHardware2ndByte = vector[3];

        this._firmwareStatus = SentinelFirmwareStatus.extractFirmwareStatus(lastBootCausesSoftware, lastBootCausesHardware1stByte, lastBootCausesHardware2ndByte);

        // Extract the version number
        let indexInVector = 4;    // 4 bytes for the last boot causes
        let firmwareVersionAsBytes = vector.subarray(indexInVector, indexInVector + 5);    // The firmware version is represented by 5 bytes
        this._firmwareVersion = firmwareVersionAsBytes.toString();

        if (SentinelFrame.logging_on === true) {
            console.log(`Firmware version : ${this._firmwareVersion}`);
        }

        // Extract scheduling settings
        indexInVector += 5;
        this.extractSchedulingSettings(vector.subarray(indexInVector, indexInVector + 10));

        // Extract private settings
        indexInVector += 10;
        this.extractAdvancedSettings(vector.subarray(indexInVector, indexInVector + 38));

        // Extract signature settings
        indexInVector += 38;
        this.extractExtensionSettings(vector.subarray(indexInVector));
    }

    // Process a vector in the data frame
    // The "vector" argument points to the first byte following the "vectorType" argument, which represents the type of vector
    processVectorContent(vectorType, vector) {

        // Case where the vector type is unknown
        if (VECTOR_TYPES.includes(vectorType) === false) {
            let error_message = `Unknown vector type (${vectorType})`;
            console.warn(error_message);
            throw new UnknownVectorTypeException(error_message);
        }

        switch(vectorType) {
            case SHOCK_DETECTION_VECTOR:
                break;

            case SIGNATURE_VECTOR:
                this.extractSignatureValues(vector);
                break;

            case SIGNATURE_REFEFENCE:
                break;

            case SIGNATURE_EXTENSIONS:
                this.extractExtensionValues(vector);
                break;

            case SYSTEM_STATUS_REPORT:
                this.extractSystemStatusData(vector);
                break;

            default:
                // Should not occur (except if modified in another thread - ok, forget it !)
                break;
        }
    }
}


module.exports = {
    SentinelFrame,
    NotImplementedException,
    UnknownVectorTypeException,
    InvalidNumberOfElementException,
    UnknownExtensionAlgorithmException,
    UnknownExtensionHandleException,
    AccessToSettingsFileException
}