const { UselessFrame } = require('./decoding_exceptions');
const { SentinelFrame } = require('./sentinel_frame');
const { FrameUtilities } = require('./frame_utilities');


class LoriotFrame extends SentinelFrame {

    static logging_on = false;

    static setLogging(value) {
        LoriotFrame.logging_on = value;
    }

    constructor(lorawanMessage, networkId) {
        super(lorawanMessage);
        this._network_id = networkId;
    }

    makeCanonical() {
        if (LoriotFrame.logging_on) {
            console.log("---> Making a Loriot frame canonical");
            console.log(`Type : ${this.constructor.name}`);
        }

        // There are useful data to extract
        if ((this._lorawanMessage.data.payload.port !== 0) && (this._lorawanMessage.data.payload.cmd !== "txd")) {
            if (this._lorawanMessage.data.payload.cmd !== undefined) {
                this._payload = Buffer.from(this._lorawanMessage.data.payload.data, 'hex');
            }
            else {
                this._payload = this._lorawanMessage.data.payload;
            }

            // Extract statistical data based on command field
            let stats = this.getLorawanStats();

            // Compute the LoRaWAN data rate
            let data_rate = FrameUtilities.getDataRateFromCssString(this._lorawanMessage.data.payload.dr);

            // Prepare the metadata
            this._metadata = {
                deveui: this._lorawanMessage.data.payload.EUI.replace(/-/g, "").toLowerCase(),
                elementCount: this._lorawanMessage.data.payload.port,
                client: this._network_id?? "Loriot_Asystom",
                gatewayNumber: this._network_id?? "Loriot_Asystom",
                // gatewayNumber: this._lorawanMessage.data.gw_number?? "Loriot_Asystom",
                dataRate: data_rate,
                soundToNoiseRatio: stats.snr,
                rssi: stats.rssi,
                frequency: stats.frequency,
                timeStamp: new Date(stats.ts),
                sensor: this._lorawanMessage.data.payload.sensor ?? "Asystom",
                fPort: this._lorawanMessage.data.payload.port,
            };

            // Overwrite the number of elements for old versions of the beacon firmware
            if (this._lorawanMessage.data.payload.port == 67) {
                if (this._payload[0] == 0xFF) {
                    this._metadata.element_count = 1;
                }

                // Case of a frame that is practically useless
                else if ((this._payload[0] === 0) && (this._payload.length == 1)) {
                    throw new UselessFrame('Frame not to be processed');
                }
            }

            return;
        }

        throw new UselessFrame('Frame not to be processed');
    }

    // Extract LoRaWAN statical data from the frame
    getLorawanStats() {
        let stats = {
            rssi: 0,
            snr: 0,
            frequency: 868.0,
            ts: 0,
        }

        if (this._lorawanMessage.data.payload.freq !== undefined) {
            stats.frequency = this._lorawanMessage.data.payload.freq / 1000000;  // Frequency defined in MHz
        }
        else if (this._lorawanMessage.data.payload.stat_freq !== undefined) {
            stats.frequency = this._lorawanMessage.data.payload.stat_freq / 1000000;  // Frequency defined in MHz
        }

        if ((this._lorawanMessage.data.payload.cmd == undefined) || (this._lorawanMessage.data.payload.cmd == "rx")) {
            if (this._lorawanMessage.data.payload.ts != undefined) {
                stats.rssi = this._lorawanMessage.data.payload.rssi;
                stats.snr = this._lorawanMessage.data.payload.snr;
                stats.ts = this._lorawanMessage.data.payload.ts;
            }
            else {
                stats.rssi = this._lorawanMessage.data.payload.stat_rssi;
                stats.snr = this._lorawanMessage.data.payload.stat_lsnr;
                stats.ts = this._lorawanMessage.data.payload.tstamp;
            }
        }
        else if (this._lorawanMessage.data.payload.cmd == "gw") {
            if (this._lorawanMessage.data.payload.gws.length > 0) {
                stats.rssi = this._lorawanMessage.data.payload.gws[0].rssi;
                stats.snr = this._lorawanMessage.data.payload.gws[0].snr;
                stats.ts = this._lorawanMessage.data.payload.gws[0].ts;
            }
        }

        return stats;
    }
}


module.exports = {
    LoriotFrame
}