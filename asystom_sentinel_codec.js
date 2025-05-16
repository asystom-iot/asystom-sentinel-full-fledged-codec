const fs = require('fs');

const { FrameUtilities } = require('./frame_utilities');
const { PhysicalValue, VECTOR_TYPES,
    BATTERY_LEVEL_IDENTIFIER, CURRENT_LOOP_IDENTIFIER, TEMPERATURE_IDENTIFIER, HUMIDITY_IDENTIFIER,
    SHOCK_DETECTION_VECTOR, SIGNATURE_VECTOR, SIGNATURE_REFEFENCE, SIGNATURE_EXTENSIONS, SYSTEM_STATUS_REPORT,
    SCALAR_VALUE_SIZE, VECTOR_ELEMENT_VALUE_SIZE, SENSOR_TYPES, ACCELEROMETER_ORIENTATION_TYPES,
    EXTENSION_ACTIVATION_TYPES, EXTENSION_ALGORITHM_FFT_ZOOM,
    EXTENSION_ALGORITHM_TYPES, COMPRESSION_TYPES, SPECTRUM_TYPES } = require('./physical_value');
const { SentinelFirmwareStatus } = require('./firmware_status');
const { SegmentedFrame } = require('./segmented_frame');

// Constants
const SchedulingPeriodScaleFactor = 10;
const SonicFrequencyScaleFactor = 10;
const RPMScaleFactor = 60;

// Local variables
let _segmentedFrames = {};
let _previousSegment = {};

// Last extension settings (received or fetched from file)
const EXTENSION_SETTINGS_FILE = 'extensionSettings.json';
let lastExtensionSettings = null;

// Result variables
let decodeResult;
let advancedSettings;
let extensionSettings;
let firmwareStatus = {};
let timeStamp;


// Store extension settings in a file
function storeExtensionSettings(extensionSettings) {
    const jsonString = JSON.stringify(extensionSettings, null, 4);

    try {
        fs.writeFileSync(EXTENSION_SETTINGS_FILE, jsonString);
        console.log(`Extension settings successfully stored in file ${EXTENSION_SETTINGS_FILE}`);
    }
    catch (err) {
        console.error(`Could not store extension settings in file ${EXTENSION_SETTINGS_FILE} (${err})`);
    }
}

// LoRaWAN Payload Code API Specification-compatible uplink decoding function
function decodeUplink(input) {

    // Reset result variables
    firmwareStatus = {};
    timeStamp = input.recvTime;
    advancedSettings = {};
    extensionSettings = {};

    // Set value of some global variables
    decodeResult = {
        data: {},
        errors: [],
        warnings: [],
    };

    // Case where data seem corrupted
    if (input.fPort > 105) {
        decodeResult.errors.push(`Invalid number of elements in frame (${input.fPort})`);
        return decodeResult;
    }

    // Get first element id
    let elementId = input.bytes[0];

    // Manage system status report from old beacons as system status report from recent ones
    if (input.fPort === 67 && elementId === 0xFF) {
        if (input.bytes.length === 84) {
            input.fPort = 1;
        }
        else {
            decodeResult.errors.push("Inconsistent data from frame (looks partly like a system status report)");
            return decodeResult;
        }
    }

    // Case of the first chunk of a segmented frame
    if (input.fPort === 100) {
        _segmentedFrames[input.deveui] = new SegmentedFrame(input.bytes);
        decodeResult.warnings.push("First frame of a segmented data frame; additional data frames are needed");
        _previousSegment[input.deveui] = input;
        return decodeResult;
    }

    // Case of an intermediary or final segmented frame chunk
    if ((input.fPort > 100) && (input.fPort < 105)) {
        if (_segmentedFrames[input.deveui] === undefined) {
            decodeResult.warnings.push("This is a following chunk of a segmented frame, but the first one has been lost");
            _previousSegment[input.deveui] = undefined;
            return decodeResult;
        }

        // Normal case : the current frame segment is the expected one
        if (input.fPort === (_previousSegment[input.deveui].fPort + 1)) {

            // Append the new frame segment
            _segmentedFrames[input.deveui].addPayloadChunk(input.bytes);

            // Reconstructed frame is not yet complete
            let lengthComparisonResult = _segmentedFrames[input.deveui].checkLength();
            if (lengthComparisonResult === -1) {
                decodeResult.warnings.push("Complementary frame of a segmented data frame; additional data frames are needed");

                // Register the current frame to avoid trouble with duplicate frames
                _previousSegment[input.deveui] = input;

                return decodeResult;
            }

            // Reconstructed frame is too long
            if (lengthComparisonResult === 1) {
                decodeResult.warnings.push("The reconstructed frame is too large ! Resetting the context.");

                _segmentedFrames[input.deveui] = undefined;
                _previousSegment[input.deveui] = undefined;

                return decodeResult;
            }

            // Reconstructed frame has the right length
            if (_segmentedFrames[input.deveui].checkCrc()) {
                input.bytes = _segmentedFrames[input.deveui].getUsefulPayload();
                input.fPort = _segmentedFrames[input.deveui].getNbElements();
                _segmentedFrames[input.deveui] = undefined;
                _previousSegment[input.deveui] = undefined;
            }

            // Case where there was a problem during transmission
            else {
                decodeResult.errors.push("Frame segmentation problem (CRC check failed)");
                return decodeResult;
            }
        }

        // Check whether the frame segment has been duplicated
        else if (input.fPort === _previousSegment[input.deveui].fPort) {
            decodeResult.warnings.push(`Previous payload : ${_previousSegment[input.deveui].bytes.toString('hex')}`);
            decodeResult.warnings.push(`Current payload : ${input.bytes.toString('hex')}`);
            decodeResult.warnings.push(`Previous timestamp : ${_previousSegment[input.deveui].recvTime}`);
            decodeResult.warnings.push(`Current timestamp : ${input.recvTime}`);

            // Case of a duplicate frame
            if ((Buffer.compare(_previousSegment[input.deveui].bytes, input.bytes) === 0) &&
                (Math.abs(input.recvTime - _previousSegment[input.deveui].recvTime) < 2000)) {
                decodeResult.warnings.push("This is a duplicate frame segment, just ignore it.");
                return decodeResult;
            }

            // Case of continuity solution
            else {
                decodeResult.warnings.push(`This is not a duplicate frame segment ==> frame segments have been lost`);
                _segmentedFrames[input.deveui] = undefined;
                _previousSegment[input.deveui] = undefined;
                return decodeResult;
            }
        }

        // Otherwise, frame segments have been lost
        else {
            decodeResult.warnings.push("Continuity solution in frame segment sequence");
            _segmentedFrames[input.deveui] = undefined;
            _previousSegment[input.deveui] = undefined;
            return decodeResult;
        }
    }

    let nbScalars;
    let vectorInFrame = false;
    let elementCount = input.fPort;

    // Case where there is no vector
    // if (input.bytes.length === (elementCount * SCALAR_VALUE_SIZE) * 2) {  // 2 characters are needed to represent a byte in hex format
    if (input.bytes.length === (elementCount * SCALAR_VALUE_SIZE)) {
        nbScalars = elementCount;
    }

    // Possible error case
    else {
        // if (input.bytes.length < (elementCount * SCALAR_VALUE_SIZE) * 2) {
        if (input.bytes.length < (elementCount * SCALAR_VALUE_SIZE)) {
            decodeResult.errors.push(`Inconsistent number of elements in frame (${elementCount}) and frame length (${input.bytes.length / 2})`);
            return decodeResult;
        }

        // There is a vector and possibly some scalars
        else {
            nbScalars = elementCount - 1;
            vectorInFrame = true;
        }
    }

    /*
    if (vectorInFrame) {
        console.log(`There is a vector in the frame and ${nbScalars} scalars.`);
    }
    else {
        console.log(`There are only scalars in the frame, they are ${nbScalars}.`);
    }
    */

    // Extract scalar values
    if (nbScalars > 0) {
        extractScalarValues(input, nbScalars);
    }

    // Extract vector content
    if (vectorInFrame) {
        /*
        let vector = input.bytes.subarray(input.fPort*SCALAR_VALUE_SIZE + 1);
        let vectorType = input.bytes.readUInt8(input.fPort*SCALAR_VALUE_SIZE);
        */
        let vectorStart = nbScalars * SCALAR_VALUE_SIZE + 1;
        console.log(`Vector length = ${input.bytes.length}, start index = ${vectorStart}, end index = ${input.bytes.length - 1}`);

        let vector = input.bytes.subarray(vectorStart);

        let vectorType = input.bytes.readUInt8(nbScalars*SCALAR_VALUE_SIZE);
        console.log(`Vector type = ${vectorType} (Ox${vectorType.toString(16)})`);

        processVectorContent(vectorType, vector);
    }

    return decodeResult;
}

// LoRaWAN Payload Code API Specification-compatible uplink encoding function
function encodeDownlink(input) {
    let output = {
        fPort: undefined,
        bytes: undefined,
        errors: "Not yet implemented"
    };
    return output;
}

// LoRaWAN Payload Code API Specification-compatible uplink decoding function
function decodeDownlink(input) {
    let output = {
        data: undefined,
        errors: "Not yet implemented"
    };
    return output;
}


// This method extracts scalar values from the frame
function extractScalarValues(input, nbScalars) {
    let unit = "";
    let name = "";
    let valueInFrame;
    let frame = input.bytes;
    let scalarValues = [];

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
                name = "Battery voltage";
                unit = "Volt";
                break;
            case CURRENT_LOOP_IDENTIFIER:
                name = "Current loop";
                min = 0;        
                max = 30;
                break;
            case HUMIDITY_IDENTIFIER:
                name = "Humidity";
                unit = "% rH";
                break;
            case TEMPERATURE_IDENTIFIER:
                name = "Ambient temperature";
                unit = "°C";
                min = -273.15;
                max = 2000;
                break;
            default:
                decodeResult.warnings.push(`Unindentified scalar value indicator (${frame[i]})`);
                valueToCompute = false;
                break;
        }

        if (valueToCompute) {
            physicalValue = valueInFrame * (max - min) / scale + min;
            let valueItem = new PhysicalValue(name, unit, physicalValue);
            scalarValues.push(valueItem);
        }
    }

    decodeResult.data.scalarValues = scalarValues;
}

// Extract physical values from a signature vector
// The input vector argument is a Buffer
function extractSignatureValues(vector) {
    let signatureValues = [];

    let decodeFunction;
    if (! FrameUtilities.isLittleEndian()) {
        decodeFunction = vector.readUint16BE.bind(vector);
    }
    else {
        decodeFunction = vector.readUint16LE.bind(vector);
    }

    let nbElements = vector.length / VECTOR_ELEMENT_VALUE_SIZE;

    for (let frameIndex = 0, measurementIndex = 0; frameIndex < nbElements*VECTOR_ELEMENT_VALUE_SIZE; frameIndex += VECTOR_ELEMENT_VALUE_SIZE, ++measurementIndex) {

        // Check whether architecture is little endian or not
        // let valueInFrame = vector.readUint16LE(frameIndex);
        let valueInFrame = decodeFunction(frameIndex);

        let scale = 65535;
        let physicalValue;

        // Skip values that are not useful anymore
        if (PhysicalValue.signaturePhysicalValues[measurementIndex].name === "") {
            continue;
        }

        physicalValue = valueInFrame * (PhysicalValue.signaturePhysicalValues[measurementIndex].max - PhysicalValue.signaturePhysicalValues[measurementIndex].min) / scale + PhysicalValue.signaturePhysicalValues[measurementIndex].min;

        let valueItem = PhysicalValue.signaturePhysicalValues[measurementIndex];
        valueItem.value = physicalValue;

        signatureValues.push(valueItem);
    }

    decodeResult.data.signatureValues = signatureValues;
}

// Extract physical values from an extension vector (FFT zoom)
// The input vector argument is a Buffer
function extractExtensionValues(vector) {
    // console.log('Extracting FFT zoom values...');

    // Get the last known extension settings
    if (lastExtensionSettings === null) {
        try {
            const extensionSettingsString = fs.readFileSync(EXTENSION_SETTINGS_FILE, 'utf8');

            // Convertir le contenu du fichier en objet JavaScript
            lastExtensionSettings = JSON.parse(extensionSettingsString);

            // Afficher l'objet dans la console
            console.log(`Extension settings handle : ${lastExtensionSettings.handle}`);
        }
        catch (err) {
            let errorMessage = `Could not read extension settings file "${EXTENSION_SETTINGS_FILE}" : ${err}`;
            decodeResult.errors.push(errorMessage);
            console.log(errorMessage);
            return;
        }
    }

    let extensionHandle = vector[vector.length - 1];
    // console.log(`Extension handle = ${extensionHandle}`);

    // Check that the handle as uplinked corresponds to the one known to C8y inventory
    if (extensionHandle !== lastExtensionSettings.handle) {
        let errorMessage = `Unknown extension settings handle "${extensionHandle}, cannot proceed.`;
        decodeResult.errors.push(errorMessage);
        console.log(errorMessage);
        return;
    }

    // Currently, only algorithm #0 (FFT zoom) is supported
    if (lastExtensionSettings.algorithm !== 0) {
        let errorMessage = `Unknown extension algorithm "${lastExtensionSettings.algorithm}, only FFT zoom (#0) is implemented yet. Cannot proceed.`;
        decodeResult.errors.push(errorMessage);
        console.log(errorMessage);
        return;
    }

    console.log('Ready to extract FFT zoom values');

    // The payload consists in values according to a frequency spectrum.
    let payloadLength = vector.length - 1;

    // console.log(`Payload data length = ${payloadLength}`);

    let signatureElementSize; // In bytes
    let nbElements;
    let scale;

    switch(lastExtensionSettings.compressionType) {
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
            decodeResult.errors.push(`Unknown compression type (${lastExtensionSettings.compressionType}), cannot proceed.`);
            console.log(`Unknown compression type (${lastExtensionSettings.compressionType}), cannot proceed.`);
            return;
        }

    /*
    console.log(`Number of elements in the FFT zoom signature = ${nbElements}`);
    console.log(`FFT zoom signature element size = ${signatureElementSize}`);
    */

    let extensionValues = [];

    let decodeFunction;
    if (! FrameUtilities.isLittleEndian()) {
        decodeFunction = vector.readUint16BE.bind(vector);
    }
    else {
        decodeFunction = vector.readUint16LE.bind(vector);
    }

    for (let frameIndex = 0, measurementIndex = 0; frameIndex < nbElements * signatureElementSize; frameIndex += signatureElementSize, ++measurementIndex) {
        // console.log("Frame index = {frameIndex}, current byte = {vector[frameIndex]}, string : {vector[frameIndex].ToString("X2")}");

        let valueInFrame;

        // Values are little endian-organized
        if (signatureElementSize === 1) {
            valueInFrame = vector[frameIndex];
        }
        else {
            // console.log('About to decode a value');
            valueInFrame = decodeFunction(frameIndex);
        }

        /*
        console.log(`valueInFrame = ${valueInFrame}`);
        console.log(`FFT zoom value name : ${PhysicalValue.fftZoomPhysicalValues[measurementIndex].getName()}`);
        */

        if (PhysicalValue.fftZoomPhysicalValues[measurementIndex].getName() === "") {
            continue;
        }

        let valueItem = PhysicalValue.fftZoomPhysicalValues[measurementIndex];

        let physicalValue = valueInFrame * (valueItem.getMax() - valueItem.getMin()) / scale + valueItem.getMin();
        // console.log(`physicalValue = ${physicalValue}`);

        valueItem.value = physicalValue;

        extensionValues.push(valueItem);
    }

    decodeResult.data.fftZoomPhysicalValues = extensionValues;
}

// Display the activation bitmask information in public settings
function extractActivationStatus(bitmask) {
    let activationStatus = [];

    for (let i = 0; i < 4; ++i) {
        let theByte = bitmask[i];

        for (let j = 0; j < 8; ++j) {
            let isOn = (theByte & (0x1 << j)) !== 0;
            if (isOn) {
                switch ((8*i) + j) {
                    case 0:
                        activationStatus.push("Battery level scheduling is active");
                        break;
                    case 2:
                        activationStatus.push("Humidity scheduling is active");
                        break;
                    case 4:
                        activationStatus.push("Mileage scheduling is active");
                        break;
                    case 7:
                        activationStatus.push("Pressure scheduling is active");
                        break;
                    case 8:
                        activationStatus.push("Wake-on event scheduling is active");
                        break;
                    case 9:
                        activationStatus.push("Machine drift scheduling is active");
                        break;
                    case 10:
                        activationStatus.push("Shock detection scheduling is active");
                        break;
                    case 11:
                        activationStatus.push("Signature scheduling is active");
                        break;
                    case 12:
                        activationStatus.push("Signature reference scheduling is active");
                        break;
                    case 13:
                        activationStatus.push("Signature extension scheduling is active");
                        break;
                    case 14:
                        activationStatus.push("Temperature scheduling is active");
                        break;
                    case 16:
                        activationStatus.push("PT100 probe scheduling is active");
                        break;
                    case 17:
                        activationStatus.push("TC probe scheduling is active");
                        break;
                    case 18:
                        activationStatus.push("Ambient aggregator scheduling is active");
                        break;
                    case 19:
                        activationStatus.push("Wave scheduling is active");
                        break;
                    case 20:
                        activationStatus.push("LoRa link scheduling is active");
                        break;
                    case 21:
                        activationStatus.push("Settings reader scheduling is active");
                        break;
                    default:
                        break;
                }
            }
        }
    }

    decodeResult.data.activationStatus = activationStatus;
}

// Extract public settings
function extractSchedulingSettings(schedulingSettingsArray) {
    let schedulingSettings = {
        activationBitmask: schedulingSettingsArray.subarray(0, 4).toString('hex'),
        ambientPeriodicity: schedulingSettingsArray.readUInt16LE(4) * SchedulingPeriodScaleFactor,
        predictionPeriodicity: schedulingSettingsArray.readUInt16LE(6) * SchedulingPeriodScaleFactor,
        introspectionPeriodicity: schedulingSettingsArray.readUInt16LE(8) * SchedulingPeriodScaleFactor
    };

    decodeResult.data.schedulingSettings = schedulingSettings;

    extractActivationStatus(schedulingSettings.activationBitmask);
}

// Store sensor-related information
function setSensorInformation(bitmask) {
    advancedSettings.sensorInformation = {
        enumeration: "",
    };

    let sensorEnumeration = bitmask[0];  // 32-bit status data is stored as little endian on firmware and copied as-is

    if ((sensorEnumeration & 0x3) === 0x3) {
        advancedSettings.sensorInformation.enumeration += "AnyAccelerometer\n";
    }

    if ((sensorEnumeration & 0xc) === 0xc) {
        advancedSettings.sensorInformation.enumeration += "AnyMicrophone";
    }

    // Only supported sensors are accelerometer and microphone
    // If the bitfield contains nothing, then it's an error
    if ((sensorEnumeration & 0xf) === 0) {
        advancedSettings.sensorInformation.enumeration = "NoSensor";
        decodeResult.warnings.push("No sensor information in frame, this is unexpected");
    }

    // To-Do : there is a bug here --> the sensor orientation is expressed on 3 bytes, not 1, and not at this place either
    // This must be tested by specifying the orientation for FFT zoom settings in the Grafana plugin
    // and checking the output hex string in the web browser
    let sensorOrientation = bitmask[2];
    if (sensorOrientation === 0) {
        advancedSettings.sensorInformation.orientation = "NoOrientation";
    }
    else if (sensorOrientation === 1) {
        advancedSettings.sensorInformation.orientation = "XPreferred";
    }
    else if (sensorOrientation === 2) {
        advancedSettings.sensorInformation.orientation = "YPreferred";
    }
    else if (sensorOrientation === 4) {
        advancedSettings.sensorInformation.orientation = "ZPreferred\n";
    }
}


// Set Wake_On-Event information
// See firmware header file utils/datamodel.h
function setWoeInfos(woeBytes, index) {
    let paramsAndFlagAndMode = woeBytes.readUInt16LE(index);
    let thresholdAndProfile = woeBytes.readUInt16LE(index + 2);

    advancedSettings.wakeOnEventInformation = {
        woeMode: paramsAndFlagAndMode & 0xF,
        woeFlag: ((paramsAndFlagAndMode & 0x10) >> 4) === 1,
        woeParam: (paramsAndFlagAndMode & 0xFFE0) >> 5,
        woeProfile: thresholdAndProfile & 0x3,
        woeThreshold: (thresholdAndProfile & 0xFFFC) >> 2,
        woePretrigThreshold: woeBytes.readUInt16LE(index + 4),
        woePostrigThreshold: woeBytes.readUInt16LE(index + 6),
    }

    switch(advancedSettings.wakeOnEventInformation.woeMode) {
        case 0:
            advancedSettings.wakeOnEventInformation.woeModeString = "WoeInactive";
            break;
        case 1:
            advancedSettings.wakeOnEventInformation.woeModeString = "WoeMotionTrig";
            break;
        case 2:
            advancedSettings.wakeOnEventInformation.woeModeString = "WoeMotionTrigAuto";
            break;
        case 3:
            advancedSettings.wakeOnEventInformation.woeModeString = "WoeSchedulerTrig";
            break;
        case 4:
            advancedSettings.wakeOnEventInformation.woeModeString = "WoeAnalogTrig";
            break;
        case 5:
            advancedSettings.wakeOnEventInformation.woeModeString = "WoeContactTrig";
            break;
        default:
            decodeResult.errors.push(`Unknown Wake-On-Event mode "${advancedSettings.wakeOnEventInformation.woeMode}"`);
            break;
    }
}

// Register LoRaWAN configuration in the frame
function setLorawanConfig(bytes, index) {
    advancedSettings.lorawanConfig = {};

    if ((bytes[index] & 0x1) !== 0) {
        advancedSettings.lorawanConfig.adrIsEnabled = true;
    }
    else {
        advancedSettings.lorawanConfig.adrIsEnabled = false;
    }

    if ((bytes[index] & (0x1 << 1)) !== 0) {
        advancedSettings.lorawanConfig.transmissionIsAcked = true;
    }
    else {
        advancedSettings.lorawanConfig.transmissionIsAcked = false;
    }

    if ((bytes[index] & (0x1 << 2)) !== 0) {
        advancedSettings.lorawanConfig.networkIsPrivate = true;
    }
    else {
        advancedSettings.lorawanConfig.networkIsPrivate = false;
    }

    if ((bytes[index] & (0x1 << 3)) !== 0) {
        advancedSettings.lorawanConfig.lorawanCodingRateIsBase = true;
    }
    else {
        advancedSettings.lorawanConfig.lorawanCodingRateIsBase = false;
    }

    if ((bytes[index] & (0x1 << 4)) !== 0) {
        advancedSettings.lorawanConfig.dwellTimeIsOn = true;
    }
    else {
        advancedSettings.lorawanConfig.dwellTimeIsOn = false;
    }

    if ((bytes[index] & (0x1 << 5)) !== 0) {
        advancedSettings.lorawanConfig.retransmitAckTwice = true;
    }
    else {
        advancedSettings.lorawanConfig.retransmitAckTwice = false;
    }

    if ((bytes[index] & (0x1 << 6)) !== 0) {
        advancedSettings.lorawanConfig.packetSplitIsEnabled = true;
    }
    else {
        advancedSettings.lorawanConfig.packetSplitIsEnabled = false;
    }

    advancedSettings.lorawanConfig.specialFrequencySettings = bytes.readUInt16LE(index + 2);
    advancedSettings.lorawanConfig.linkCheckPeriod = bytes.readUInt16LE(index + 4);
}


// Extract private settings
function extractAdvancedSettings(advancedSettingsArray) {
    advancedSettings = {
        sensorInformationBitmask: advancedSettingsArray.subarray(0, 4).toString('hex'),
    };

    setSensorInformation(advancedSettingsArray);

    advancedSettings.frequencies = {
        sonicFrequencyHigh: advancedSettingsArray.readUInt16LE(4) * SonicFrequencyScaleFactor,
        sonicFrequencyLow: advancedSettingsArray.readUInt16LE(6) * SonicFrequencyScaleFactor,
        vibrationFrequencyHigh: advancedSettingsArray.readUInt16LE(8),
        vibrationFrequencyLow: advancedSettingsArray.readUInt16LE(10),
    }

    advancedSettings.rotationSpeedBoundaries = {
        rpmUpperBoundary: advancedSettingsArray.readUInt16LE(12) * RPMScaleFactor,
        rpmLowerBoundary: advancedSettingsArray.readUInt16LE(14) * RPMScaleFactor,
    }

    advancedSettings.mileageThreshold = advancedSettingsArray.readUInt16LE(16);
    advancedSettings.referenceCustomParam = advancedSettingsArray.readUInt16LE(18);
    advancedSettings.customSpectrumType = advancedSettingsArray.readUInt16LE(20);
    advancedSettings.customSpectrumParam = advancedSettingsArray.readUInt16LE(22);
    advancedSettings.woeBitmask = advancedSettingsArray.subarray(24, 4);

    setWoeInfos(advancedSettingsArray, 24);

    setLorawanConfig(advancedSettingsArray, 32);

    decodeResult.data.advancedSettings = advancedSettings;
}


// Extract signature settings
function extractExtensionSettings(extensionSettingsArray) {
    console.log('Extracting extension settings');

    extensionSettings = {};

    // Extension handle
    extensionSettings.handle = extensionSettingsArray[0];
    console.log(`Handle = ${extensionSettings.handle}`);

    // Extension activation state
    extensionSettings.activation = extensionSettingsArray[1];
    console.log(`Activation state = ${extensionSettings.activation}`);

    // Case where the activation type is unknown
    if (EXTENSION_ACTIVATION_TYPES.includes(extensionSettings.activation) === false) {
        let error_message = `Unknown extension activation state (${extensionSettings.activation})`;
        console.log(error_message);
        decodeResult.errors.push(error_message);
    }

    // Activation steps (for periodic activation state)
    extensionSettings.steps = extensionSettingsArray[2];
    console.log(`Steps = ${extensionSettings.steps}`);

    // Extension algorithm
    extensionSettings.algorithm = extensionSettingsArray[3];
    console.log(`Algorithm = ${extensionSettings.algorithm}`);

    // Case where the extension algorithm is unknown
    if (EXTENSION_ALGORITHM_TYPES.includes(extensionSettings.algorithm) === false) {
        let error_message = `Unknown extension algorithm type (${extensionSettings.algorithm})`;
        console.log(error_message);
        decodeResult.errors.push(error_message);
    }

    // Sensor type for extension algorithm
    extensionSettings.sensorType = extensionSettingsArray[4];
    console.log(`Sensor type = ${extensionSettings.sensorType}`);

    // Case where the sensor type is unknown
    if (SENSOR_TYPES.includes(extensionSettings.sensorType) === false) {
        let error_message = `Unknown sensor type (${extensionSettings.sensorType})`;
        console.log(error_message);
        decodeResult.errors.push(error_message);
    }

    // Accelerometer orientation
    extensionSettings.accelerometerOrientation = extensionSettingsArray[5];
    console.log(`Accelerometer orientation = ${extensionSettings.accelerometerOrientation}`);

    // Case where the accelerometer orientation is unknown
    if (ACCELEROMETER_ORIENTATION_TYPES.includes(extensionSettings.accelerometerOrientation) === false) {
        let error_message = `Unknown accelerometer orientation (${extensionSettings.accelerometerOrientation})`;
        console.log(error_message);
        decodeResult.errors.push(error_message);
    }

    // Extract FFT zoom algorithm parameters
    if (extensionSettings.algorithm === EXTENSION_ALGORITHM_FFT_ZOOM) {

        // Upper frequency
        extensionSettings.upperFrequency = extensionSettingsArray.subarray(6, 10).readUInt32LE();
        console.log(`FFT zoom upper frequency = ${extensionSettings.upperFrequency}`);

        // Lower frequency
        extensionSettings.lowerFrequency = extensionSettingsArray.subarray(10, 14).readUInt32LE();
        console.log(`FFT zoom lower frequency = ${extensionSettings.lowerFrequency}`);

        // Compression type
        extensionSettings.compressionType = extensionSettingsArray.subarray(14, 18).readUInt32LE();
        console.log(`FFT zoom compression type = ${extensionSettings.compressionType}`);

        // Case where the compression type is unknown
        if (COMPRESSION_TYPES.includes(extensionSettings.compressionType) === false) {
            let error_message = `Unknown compression type (${extensionSettings.compressionType})`;
            console.log(error_message);
            decodeResult.errors.push(error_message);
        }

        // Spectrum type
        extensionSettings.spectrumType = extensionSettingsArray.subarray(18, 22).readUInt32LE();
        console.log(`FFT zoom spectrum type = ${extensionSettings.spectrumType}`);

        // Case where the spectrum type is unknown
        if (SPECTRUM_TYPES.includes(extensionSettings.spectrumType) === false) {
            let error_message = `Unknown spectrum type (${extensionSettings.spectrumType})`;
            console.log(error_message);
            decodeResult.errors.push(error_message);
        }

        extensionSettings.cutOffFrequency = extensionSettingsArray.subarray(22, 26).readUInt32LE();
        console.log(`Cut-off frequency = ${extensionSettings.cutOffFrequency}`);
    }

    decodeResult.extensionSettings = extensionSettings;

    // Register settings for decoding FFT zoom frames
    lastExtensionSettings = extensionSettings;

    // Store extension settings in a file
    storeExtensionSettings(decodeResult.extensionSettings);
}


// Extract system status data
// The "vector" argument points to the start of the status data, i.e. the first byte following the vector type
// Thus it points to the byte representing the data indicator and is followed by the "last boot cause" 32-bit field
function extractSystemStatusData(vector) {

    // Get last boot causes (software)
    let lastBootCausesSoftware = vector.readInt16BE(0);

    // Get last boot causes (hardware)
    let lastBootCausesHardware1stByte = vector[2];
    let lastBootCausesHardware2ndByte = vector[3];

    firmwareStatus = SentinelFirmwareStatus.extractFirmwareStatus(lastBootCausesSoftware, lastBootCausesHardware1stByte, lastBootCausesHardware2ndByte);

    // Extract the version number
    let indexInVector = 4;    // 4 bytes for the last boot causes
    let firmwareVersionAsBytes = vector.subarray(indexInVector, indexInVector + 5);    // The firmware version is represented by 5 bytes
    decodeResult.data.firmwareVersion = firmwareVersionAsBytes.toString();

    decodeResult.data.firmwareStatus = firmwareStatus;

    // Extract scheduling settings
    indexInVector += 5;
    extractSchedulingSettings(vector.subarray(indexInVector, indexInVector + 10));

    // Extract private settings
    indexInVector += 10;
    extractAdvancedSettings(vector.subarray(indexInVector, indexInVector + 38));

    // Extract signature settings
    indexInVector += 38;
    extractExtensionSettings(vector.subarray(indexInVector));
}


// Process a vector in the data frame
// The "vector" argument points to the first byte following the "vectorType" argument, which represents the type of vector
function processVectorContent(vectorType, vector) {

    // Case where the vector type is unknown
    if (VECTOR_TYPES.includes(vectorType) === false) {
        let error_message = `Unknown vector type (${vectorType})`;
        decodeResult.errors.push(error_message);
        return;
    }

    switch(vectorType) {
        case SHOCK_DETECTION_VECTOR:
            break;

        case SIGNATURE_VECTOR:
            extractSignatureValues(vector);
            break;

        case SIGNATURE_REFEFENCE:
            break;

        case SIGNATURE_EXTENSIONS:
            extractExtensionValues(vector);
            break;

        case SYSTEM_STATUS_REPORT:
            extractSystemStatusData(vector);
            break;

        default:
            // Should not occur (except if modified in another thread - ok, forget it !)
            break;
    }
}


module.exports = {
    decodeUplink
}