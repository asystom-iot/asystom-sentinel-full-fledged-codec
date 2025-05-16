const { UselessFrame, MalformedFrame } = require('./decoding_exceptions');
const { SentinelFrame } = require('./sentinel_frame');


class ChirpstackFrame extends SentinelFrame {

    static logging_on = false;

    static setLogging(value) {
        ChirpstackFrame.logging_on = value;
    }

    makeCanonical() {
        if (ChirpstackFrame.logging_on) {
            console.log("---> Making a Chirpstack frame canonical");
            console.log(`Type : ${this.constructor.name}`);
        }

        if (this._lorawanMessage.data.payload.data === undefined) {
            throw new MalformedFrame('Frame without a Sentinel payload');
        }

        this._payload = Buffer.from(this._lorawanMessage.data.payload.data, 'base64');

        // Extract statistical data based on command field
        let stats = this.getLoraStats();

        // Prepare the metadata
        this._metadata = {
            deveui: this._lorawanMessage.data.payload.deviceInfo.devEui,
            elementCount: this._lorawanMessage.data.payload.fPort,
            client: this._lorawanMessage.data.payload.deviceInfo.tenantName?? "Chirpstack",
            gatewayNumber: this._lorawanMessage.data.payload.deviceInfo.tenantName?? "Chirpstack",
            dataRate: this._lorawanMessage.data.payload.dr,
            soundToNoiseRatio: stats.snr,
            rssi: stats.rssi,
            frequency: stats.frequency,
            timeStamp: new Date(stats.ts),
            sensor: "Asystom",
            fPort: this._lorawanMessage.data.payload.fPort,
        };

        // Overwrite the number of elements for old versions of the beacon firmware
        if (this._lorawanMessage.data.payload.fPort == 67) {
            if (this._payload[0] == 0xFF) {
                this._metadata.element_count = 1;
            }

            // Case of a frame that is practically useless
            else if ((this._payload[0] === 0) && (this._payload.length == 1)) {
                throw new UselessFrame('Frame not to be processed');
            }
        }
    }

    // Extract LoRa statistical data from the frame
    getLoraStats() {
        let stats = {
            rssi: 0,
            snr: 0,
            frequency: 868.0,
            ts: 0,
        }

        if (this._lorawanMessage.data.payload.txInfo.frequency !== undefined) {
            stats.frequency = this._lorawanMessage.data.payload.txInfo.frequency / 1000000;  // Frequency defined in MHz
        }
        else {
            stats.frequency = 0;
        }

        if (this._lorawanMessage.data.payload.rxInfo[0] !== undefined) {
            stats.rssi = this._lorawanMessage.data.payload.rxInfo[0].rssi;
            stats.snr = this._lorawanMessage.data.payload.rxInfo[0].snr;
            stats.ts = (new Date(this._lorawanMessage.data.payload.rxInfo[0].gwTime)).getTime();
        }
        else {
            stats.rssi = 0;
            stats.snr = 0;
            stats.ts = 0;
        }

        return stats;
    }
}


module.exports = {
    ChirpstackFrame
}