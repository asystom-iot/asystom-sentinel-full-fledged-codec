const { UselessFrame } = require('./decoding_exceptions');
const { FrameUtilities } = require('./frame_utilities');
const { SentinelFrame } = require('./sentinel_frame');


class MultitechFrame extends SentinelFrame {

    static logging_on = false;

    static setLogging(value) {
        MultitechFrame.logging_on = value;
    }

    makeCanonical() {
        if (MultitechFrame.logging_on) {
            console.log("---> Making a Multitech data frame canonical");
            console.log(`Type : ${this.constructor.name}`);
        }

        // There are useful data to extract
        if ((this._lorawanMessage.data.payload.data.port !== 0) && (this._lorawanMessage.data.payload.data.payload !== undefined)) {
            this._payload = Buffer.from(this._lorawanMessage.data.payload.data.payload, 'hex');

            // Compute data rate
            let dataRate = FrameUtilities.getDataRateFromSpreadingFactorAndBandwidth(this._lorawanMessage.data.payload.data.datr);

            // Prepare the metadata; also make devEUI canonical
            if (MultitechFrame.logging_on) {
                console.log(`Trame Multitech : deveui = ${this._lorawanMessage.data.payload.data.deveui}`);
            }

            /*
            let myDate = Date.parse(this._lorawanMessage.data.payload.data.time);
            console.log(`Type of parsed date : ${typeof myDate}`);
            let otherDate = new Date(myDate);
            console.log(`Type of other date : ${typeof otherDate}`);
            console.log(`otherDate : ${otherDate}`);
            */

            this._metadata = {
                deveui: this._lorawanMessage.data.payload.data.deveui.replace(/-/g, "").toLowerCase(),
                elementCount: this._lorawanMessage.data.payload.data.port,
                client: this._lorawanMessage.data.payload.client,
                gatewayNumber: this._lorawanMessage.data.payload.sn,
                dataRate: dataRate,
                soundToNoiseRatio: this._lorawanMessage.data.payload.data.lsnr,
                rssi: this._lorawanMessage.data.payload.data.rssi,
                frequency: this._lorawanMessage.data.payload.data.freq,
                // timeStamp: new Date(Date.parse(this._lorawanMessage.data.payload.data.time)),
                sensor: this._lorawanMessage.data.payload.sensor ?? "Asystom",
                fPort: this._lorawanMessage.data.payload.data.port,
            };

            /*
            console.log(`Direct : ${this._metadata.timeStamp}`);
            console.log(`Via accessor : ${this.getTimeStamp()}`);
            console.log(`Other date : ${otherDate}`);
            */

            // Overwrite the number of elements for old versions of the beacon firmware
            if (this._lorawanMessage.data.payload.data.port === 67) {
                if (this._payload[0] === 0xFF) {
                    this._metadata.element_count = 1;
                }

                // Case of a frame that is practically useless
                else if ((this._payload[0] === 0) && (this._payload.length === 1)) {
                    throw new UselessFrame('Frame not to be processed');
                }
            }

            // Set the time stamp from Multitech timestamp (seems reliable)
            let current_date = new Date(this._lorawanMessage.data.payload.data.time);
            // let offset = current_date.getTimezoneOffset(); // Offset expressed in hours
            let utc_time_in_ms_since_epoch = current_date.getTime();
            // this._metadata.timeStamp = utc_time_in_ms_since_epoch + (offset * 60 * 1000);
            this._metadata.timeStamp = new Date(utc_time_in_ms_since_epoch);
            // console.log(new Date(this._metadata.timeStamp).toISOString());

            return;
        }

        throw new UselessFrame('Frame not to be processed');
    }
}


module.exports = {
    MultitechFrame
}