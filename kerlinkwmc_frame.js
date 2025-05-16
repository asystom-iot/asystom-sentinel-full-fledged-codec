const { UselessDataFrame } = require('./decoding_exceptions');
const { SentinelFrame } = require('./sentinel_frame');
const { FrameUtilities } = require('./frame_utilities');


class KerlinkWMCFrame extends SentinelFrame {

    static logging_on = false;

    static setLogging(value) {
        KerlinkWMCFrame.logging_on = value;
    }

    makeCanonical() {
        if (KerlinkWMCFrame.logging_on) {
            console.log("---> Making a Kerlink WMC data frame canonical");
            console.log(`Type : ${this.constructor.name}`);
        }

        // There are useful data to extract
        if ((this._lorawanMessage.data.payload.fPort !== 0) && (this._lorawanMessage.data.payload.hasOwnProperty("endDevice"))) {
            this._payload = Buffer.from(this._lorawanMessage.data.payload.payload, 'hex');

            // Extract statistical data based on command field
            let stats = this.getLorawanStats();

            // Compute the LoRaWAN data rate
            let data_rate = FrameUtilities.getDataRateFromSpreadingFactorAndBandwidth(
                this._lorawanMessage.data.payload.dataRate,
                this._lorawanMessage.data.payload.gwInfo[0].rfRegion
            );

            let sensor_origin;
            try {
                sensor_origin = FrameUtilities.getValueFromHttpHeaders(this._lorawanMessage.data.req.rawHeaders, "Sensor");
            }
            catch (ex) {
                sensor_origin = "Asystom";
            }

            // Prepare the metadata
            this._metadata = {
                // deveui: this._lorawanMessage.data.payload.endDevice.devEui.match(/.{1,2}/g).join('-').toLowerCase(),
                deveui: this._lorawanMessage.data.payload.endDevice.devEui.replace(/-/g, "").toLowerCase(),
                elementCount: this._lorawanMessage.data.payload.fPort,
                client: FrameUtilities.getValueFromHttpHeaders(this._lorawanMessage.data.req.rawHeaders, "Client"),
                gatewayNumber: FrameUtilities.getValueFromHttpHeaders(this._lorawanMessage.data.req.rawHeaders, "Client"),
                dataRate: data_rate,
                soundToNoiseRatio: stats.snr,
                rssi: stats.rssi,
                frequency: stats.frequency,
                timeStamp: Date.parse(stats.ts),
                sensor: sensor_origin,
                fPort: this._lorawanMessage.data.payload.fPort,
            };

            // Overwrite the number of elements for old versions of the beacon firmware
            if (this._lorawanMessage.data.payload.port == 67) {
                if (this._payload[0] == 0xFF) {
                    this._metadata.element_count = 1;
                }

                // Case of a frame that is practically useless
                else if ((this._payload[0] === 0) && (this._payload.length == 1)) {
                    throw new UselessDataFrame('Frame not to be processed');
                }
            }

            return;
        }

        throw new UselessDataFrame('Frame not to be processed');
    }

    // Extract LoRaWAN statical data from the frame
    getLorawanStats() {
        let stats = {
            rssi: 0,
            snr: 0,
            frequency: 868.0,
            ts: 0,
        }

        if (this._lorawanMessage.data.payload.ulFrequency !== undefined) {
            stats.frequency = this._lorawanMessage.data.payload.ulFrequency;
        }

        stats.rssi = this._lorawanMessage.data.payload.gwInfo[0].rssi;
        stats.snr = this._lorawanMessage.data.payload.gwInfo[0].snr;
        stats.ts = this._lorawanMessage.data.payload.recvTime;

        return stats;
    }
}


module.exports = {
    KerlinkWMCFrame
}