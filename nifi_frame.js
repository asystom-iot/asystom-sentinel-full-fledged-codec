const { UselessFrame } = require('./decoding_exceptions');
const { FrameUtilities } = require('./frame_utilities');
const { SentinelFrame } = require('./sentinel_frame');


class NiFiFrame extends SentinelFrame {

    static logging_on = false;

    static setLogging(value) {
        NiFiFrame.logging_on = value;
    }

    makeCanonical() {
        if (NiFiFrame.logging_on) {
            console.log(`Type : ${this.constructor.name}`);
        }

        // There are useful data to extract
        if (this._lorawanMessage.data.payload.protocol_data.port !== 0) {
            this._payload = Buffer.from(this._lorawanMessage.data.payload.payload_cleartext, 'hex');

            // Compute data rate
            let dataRate = FrameUtilities.getDataRateFromSpreadingFactor(this._lorawanMessage.data.payload.lora_sf);

            // Prepare the metadata
            this._metadata = {
                // deveui: this._lorawanMessage.data.payload.device_properties.deveui.match(/.{1,2}/g).join('-').toLowerCase(),
                deveui: this._lorawanMessage.data.payload.device_properties.deveui.replace(/-/g, "").toLowerCase(),
                elementCount: this._lorawanMessage.data.payload.protocol_data.port,
                client: this._lorawanMessage.data.payload.site,
                gatewayNumber: this._lorawanMessage.data.payload.site,
                dataRate: dataRate,
                soundToNoiseRatio: this._lorawanMessage.data.payload.lora_snr,
                rssi: this._lorawanMessage.data.payload.lora_rssi,
                frequency: 868.0,
                timeStamp: new Date(Date.parse(this._lorawanMessage.data.payload.Timestamp)),
                sensor: this._lorawanMessage.data.payload.sensor ?? "Asystom",
                fPort: this._lorawanMessage.data.payload.protocol_data.port,
            };

            // Overwrite the number of elements for old versions of the beacon firmware
            if (this._lorawanMessage.data.payload.protocol_data.port == 67) {
                if (this._payload[0] == 0xFF) {
                    this._metadata.element_count = 1;
                }

                // Case of a frame that is practically useless
                else if ((this._payload[0] === 0) && (this._payload.length == 1)) {
                    throw new UselessFrame('Frame not to be processed');
                }
            }

            /*
            // Set the time stamp, as Loriot timestamp is considered unreliable
            let current_date = new Date();
            let offset = current_date.getTimezoneOffset(); // Offset in expressed in hours
            let utc_time_in_ms_since_epoch = current_date.getTime();
            this._metadata.timeStamp = utc_time_in_ms_since_epoch - (offset * 60 * 1000);
            */

            return;
        }

        throw new UselessFrame('Frame not to be processed');
    }
}


module.exports = {
    NiFiFrame
}