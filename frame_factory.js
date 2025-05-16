const { UnknownLNSException, UnprocessableFrame } = require('./decoding_exceptions');
const { NotFoundInHeaders, FrameUtilities } = require('./frame_utilities');
const { LoriotFrame } = require('./loriot_frame');
const { NiFiFrame } = require('./nifi_frame');
const { KerlinkWMCFrame } = require('./kerlinkwmc_frame');
const { MultitechFrame } = require('./multitech_frame');
const { ChirpstackFrame } = require('./chirpstack_frame');


class FrameFactory {

    static logging_on = false;

    static setLogging(value) {
        FrameFactory.logging_on = value;
    }

    // This static method is the main one of this factory.
    // It is used to create an instance of a specific data frame, based on
    // the LoRaWAN message received.
    static createFrame(lorawanMessage) {
        let network_id;

        // Try first to find the network id in the HTTP headers
        try {
            network_id = FrameUtilities.getValueFromHttpHeaders(lorawanMessage.data.req.rawHeaders, 'network');
            return FrameFactory.createFrameFromHeaders(lorawanMessage, network_id);
        }
        catch (ex) {
            if (ex instanceof NotFoundInHeaders) {
                return FrameFactory.createFrameFromPayload(lorawanMessage, lorawanMessage.data.payload.network);
            }
            else {
                let message = `Unexpected exception ${ex.name} (${ex.message}), aborting frame processing.`;
                console.log(message);
                throw new UnprocessableFrame(message);
            }
        }
    }

    // Create a data frame based on the LoRaWAN message payload
    static createFrameFromPayload(lorawanMessage, network_id) {
        if (network_id === undefined) {
            return FrameFactory.createFrameFromUnusualLNSMessage(lorawanMessage);
        }

        // Case where the network id is in the headers
        else {
            return FrameFactory.createFrameFromPayloadWithNetworkId(lorawanMessage, network_id);
        }
    }

    // This method creates a frame object based on
    // information stored in the HTTP headers
    static createFrameFromHeaders(lorawanMessage, network_id) {
        if (network_id.includes("Loriot")) {
            if (FrameFactory.logging_on) {
                console.log("Frame sent by a Loriot LNS");
            }

            return new LoriotFrame(lorawanMessage, network_id);
        }

        switch (network_id) {
            case "KerlinkWMC_Asystom":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by a Kerlink WMC LNS");
                }
                return new KerlinkWMCFrame(lorawanMessage);

            case "NNN_Asystom":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by an Actility LNS");
                }
                break;

            case "Tektelik_BI":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by a Tektelic BI LNS");
                }
                break;

            case "actility_Senzary":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by an Actility LNS (Senzary version)");
                }
                break;

            case "wilhelmsen":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by a TTN LNS (Wilhemsen version)");
                }
                break;

            case "Actility_Asystom":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by an Actility LNS (Asystom version)");
                }
                break;

            case "Chirpstack_Asystom":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by a Chirpstack LNS (Asystom version)");
                }
                return new ChirpstackFrame(lorawanMessage);

            case "TTI":
                if (FrameFactory.logging_on) {
                    console.log("Frame sent by a TTI LNS (VmexGlobal version)");
                }
                break;

            default:
                console.warn("Unknown network id, aborting.");
                break;
        }

        throw new UnknownLNSException(`Unknown network id "${network_id}"`);
    }

    // This method creates a data frame for an unusual LoRaWAN message,
    // i.e. one where the network id can be found in neither HTTP headers
    // nor message payload.
    static createFrameFromUnusualLNSMessage(lorawanMessage) {

        // It might be a frame sent by a Wika Loriot LNS
        if (lorawanMessage.data.payload.Asystom_Network === undefined) {

            // Looks like a Wika Loriot LNS
            if (lorawanMessage.data.payload.hasOwnProperty('EUI')) {
                return new LoriotFrame(lorawanMessage);
            }

            throw new UnknownLNSException('Frame received from an unknown LNS');
        }

        // Case of a frame sent by Renault Douai
        if (lorawanMessage.data.payload.Asystom_Network === "Objenious_Renault") {
            return new NiFiFrame(lorawanMessage);
        }
    }

    // Case where the network id is defined in the
    // payload instead of in the HTTP headers
    static createFrameFromPayloadWithNetworkId(lorawanMessage, network_id) {
        switch (network_id) {
            case "kerlink":
                if (FrameFactory.logging_on) {
                    console.log("Case of LoRaWAN message sent by a Kerlink SPN LNS");
                }
                break;

            case "asystomv2":
                if (FrameFactory.logging_on) {
                    console.log("Case of LoRaWAN message sent by a Multitech LNS");
                }
                return new MultitechFrame(lorawanMessage);

            case "TPE":
                if (FrameFactory.logging_on) {
                    console.log("Case of LoRaWAN message sent by a kind of Galium/Actility TPE LNS");
                }
                break;

            case "gerflor":
                if (FrameFactory.logging_on) {
                    console.log("Case of LoRaWAN message sent by another kind of Galium/Actility TPE LNS");
                }
                break;

            case "ECBM":
                if (FrameFactory.logging_on) {
                    console.log("Case of LoRaWAN message sent by an Actility TPE LNS");
                }
                break;

            case "requea":
                if (FrameFactory.logging_on) {
                    console.log("Case of LoRaWAN message sent by another kind of Actility LNS");
                }
                break;

            default:
                console.warn("Case of LoRaWAN message sent by an unknown kind of LNS");
                throw new UnknownLNSException();
        }

        return undefined;
    }
}


module.exports = {
    FrameFactory
}