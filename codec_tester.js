const { FrameFactory } = require('./frame_factory');
const fs = require('fs');

let UPLINK_SOURCES;

try {
    let content = fs.readFileSync('./uplink_sources.json', 'utf8');
    UPLINK_SOURCES = JSON.parse(content);
}
catch (error) {
    console.error(`Cannot read the uplink source file or parse its content (${error.message}), aborting.`);
    process.exit(1);
}

// Display numerical values (may be very verbose)
const hideResult = (
    process.argv.indexOf('--hide-result') > -1
);

// Use the LoRaWAN Codec API Specification-compliant codec
const useCodec = (
    process.argv.indexOf('--use-lorawan-codec') > -1
);

// Use the LoRaWAN Codec API Specification-compliant codec
const loggingOn = (
    process.argv.indexOf('--logging-on') > -1
);

const EXAMPLE_TEMPLATE = {
    "type": "<type_placeholder>",
    "description": "<description_placeholder>",
    "input": {
        "bytes": [],
        "fPort": "<fPort_placeholder>",
        "recvTime": "<timestamp_placeholder",
    },
    "output": {
        "data": {},
        "errors": [],
        "warnings": []
    }
};

const EXAMPLE_FILE = "examples.json";


// Utility function to clone an object, i.e. perform a deep copy of it
function clone(anObject) {
    return JSON.parse(JSON.stringify(anObject));
}


// Utility function to display on console an object's fields
function printObjectFieldsRecursively (theObject) {
    for (let key in theObject) {
        if (typeof theObject[key] === 'object' && theObject[key] !== null) {
            if (hideResult) {
                if (key === "data") {
                    continue;
                }
            }

            printObjectFieldsRecursively(theObject[key])
        }

        else if (theObject.hasOwnProperty(key)) {
            console.log(`${key} --> ${theObject[key]}`);
        }
    }
}


// Utility function to open a file and write a string in it
function writeStringInFile(filePath, stringToWrite) {
    fs.writeFileSync(filePath, stringToWrite, { flag: 'a' }, (err) => {
        if (err) {
            console.error(`Could not write in file ${filePath} : ${err}`);
        }
    });
}


// Function that creates an entry in the examples' file
// corresponding to the frame passed as argument
function addExampleEntry(filePath, frame) {
    let entry = clone(EXAMPLE_TEMPLATE);

    // Case of an uplink frame with device configuration
    if (frame.getFirmwareVersion() !== "") {
        entry.type = "uplink";
        entry.description = "uplink frame containing a device configuration";
        entry.input.bytes = frame.getPayload();
        entry.input.fPort = frame.getFport();
        entry.input.recvTime = frame.getTimeStamp();
        entry.output.data = frame.getDecodedResult();
    }
}


// Process the frames
function ProcessAllFrames(frames) {
    for (let frame of frames) {
        processRawFrame(frame);
    }
}


// Process a raw frame
function processRawFrame(lorawanMessage) {

    // Get frame metadata (network id, element count, gateway id, data rate, RF frequency, RSSI, signal SNR, etc.)
    let lnsType;
    try {
        // Create a frame based on the LoRaWAN message
        // then make it canonical
        if (loggingOn) {
            console.log(`================== Frame received ==================`);
        }

        let theFrame = FrameFactory.createFrame(lorawanMessage);
        let frameType = theFrame.getType();
        lnsType = frameType.substring(0, frameType.indexOf('Frame'));

        if (loggingOn) {
            console.log(`---> Frame received from LNS of type ${lnsType}`);
        }

        // Make the frame format standard
        theFrame.makeCanonical();

        if (loggingOn) {
            console.log(`Frame : ${theFrame._payload.toString('hex')}`);
        }

        // Decode the frame using the LoRaWAN Codec API Specification-compliant codec
        if (useCodec === true) {
            theFrame.setDecodedResult(theFrame.decode(true));
            if (hideResult === false) {
                console.log(`Content for frame of device ${theFrame.getDeveui()} with FPort ${theFrame.getFport()} received from gateway ${theFrame.getGatewayNumber()} at ${theFrame.getTimeStamp()}`);
                console.log(JSON.stringify(theFrame.getDecodedResult(), null, 2));
            }
        }

        // Decode the frame using the flull-fledged codec
        else {
            theFrame.decode(false);

            if (hideResult === false) {
                console.log(`Content for frame of device ${theFrame.getDeveui()} with FPort ${theFrame.getFport()} received from gateway ${theFrame.getGatewayNumber()} at ${theFrame.getTimeStamp()}`);
                printObjectFieldsRecursively(theFrame.getDecodedResult());
            }
        }

        // Add an entry in the examples' file
        addExampleEntry(EXAMPLE_FILE, theFrame);

        // Display frame content if required
    }

    catch (ex) {
        console.log(`Could not process LoRaWAN message (${ex})`);
    }
}


// Get uplink frames and process them
async function getUplinkFramesAndProcessThem() {
    for (let uplink_source of UPLINK_SOURCES) {

        if (loggingOn) {
            console.log(`Trying to get a frame from ${uplink_source.host}...`);
        }

        const url = `https://${uplink_source.host}/dev/forward/uplink?flush=yes&type=raw`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Basic ${uplink_source.basic_auth}`,
                }
            });

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}, ${response.statusText}`);
            }

            if (response.status === 204) {
                return;
            }

            const frames = await response.json();

            if (frames.length === 0) {
                if (loggingOn) {
                    console.log("No raw uplink frame to analyze");
                }

                return;
            }

            // Process the frames
            ProcessAllFrames(frames);
        }

        catch (ex) {
            console.error(`Could not process uplink frame (${ex})`);
        }
    }
}

// Process specified arguments
async function processArguments(argumentArray) {

    // Request frequency
    const requestFrequencySpecified = argumentArray.indexOf('--request_frequency');
    let requestFrequencyString;

    if (requestFrequencySpecified > -1) {
        // Retrieve the value after --custom
        requestFrequencyString = argumentArray[requestFrequencySpecified + 1];
    }

    requestFrequencyString = (requestFrequencyString || '10000');

    requestFrequency = parseInt(requestFrequencyString, 10);
    if (isNaN(requestFrequency)) {
        console.error(`Request frequency value (${requestFrequencyString}) is not an integer value !`);
        console.log('Using default value for request frequency (10000 ms)');
    }

    console.log('Hide result:', `${hideResult}`);
    console.log('Request frequency:', `${requestFrequency}`);
    console.log(`Using Codec : ${useCodec}`);
}

// Process possible arguments
let requestFrequency;
processArguments(process.argv);

// Get uplink frames and forward them on a regular basis
setInterval(getUplinkFramesAndProcessThem, requestFrequency);

//Read existing frames
getUplinkFramesAndProcessThem();