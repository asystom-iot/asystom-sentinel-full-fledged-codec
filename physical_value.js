// Size of a physical value for a scalar measurement
const SCALAR_VALUE_SIZE = 3;

// Size of a physical value for a vector element
const VECTOR_ELEMENT_VALUE_SIZE = 2;

const DB = "dB";
const MmPerSecond = "mm/s";
const G = "g";
const RPM = "rpm";

// Scalar value identifiers
const BATTERY_LEVEL_IDENTIFIER = 0x00;
const CURRENT_LOOP_IDENTIFIER = 0x01;
const TEMPERATURE_IDENTIFIER = 0x0e;
const HUMIDITY_IDENTIFIER = 0x02;

// Vector type identifiers
const SHOCK_DETECTION_VECTOR = 0x0a;
const SIGNATURE_VECTOR = 0x0b;
const SIGNATURE_REFEFENCE = 0x0c;
const SIGNATURE_EXTENSIONS = 0x0d;
const SYSTEM_STATUS_REPORT = 0xff;

const VECTOR_TYPES = [
    SHOCK_DETECTION_VECTOR,
    SIGNATURE_VECTOR,
    SIGNATURE_REFEFENCE,
    SIGNATURE_EXTENSIONS,
    SYSTEM_STATUS_REPORT
];

// Sensor type identifiers
const MICROPHONE_SENSOR = 0xc;
const ACCELEROMETER_SENSOR = 0x3;

const SENSOR_TYPES = [
    MICROPHONE_SENSOR,
    ACCELEROMETER_SENSOR
];

// Accelerometer orientation identifiers
const AVERAGE_AXIS_ORIENTATION = 0x0;
const X_AXIS_ORIENTATION = 0x1;
const Y_AXIS_ORIENTATION = 0x2;
const Z_ORIENTATION = 0x4;

const ACCELEROMETER_ORIENTATION_TYPES = [
    AVERAGE_AXIS_ORIENTATION,
    X_AXIS_ORIENTATION,
    Y_AXIS_ORIENTATION,
    Z_ORIENTATION
];

// Extension frame activation field
const EXTENSION_NOT_ACTIVATED = 0x0;
const EXTENSION_PERIODIC_SCHEDULING = 0x1;
const EXTENSION_BURST_SCHEDULING = 0x2;

const EXTENSION_ACTIVATION_TYPES = [
    EXTENSION_NOT_ACTIVATED,
    EXTENSION_PERIODIC_SCHEDULING,
    EXTENSION_BURST_SCHEDULING
];

const EXTENSION_ALGORITHM_FFT_ZOOM = 0x0;

const EXTENSION_ALGORITHM_TYPES = [
    EXTENSION_ALGORITHM_FFT_ZOOM
];

const COMPRESSION_TYPE_50_BANDS_8_BITS = 0x0;
const COMPRESSION_TYPE_50_BANDS_16_BITS = 0x1;
const COMPRESSION_TYPE_100_BANDS_8_BITS = 0x2;
const COMPRESSION_TYPE_100_BANDS_16_BITS = 0x3;
const COMPRESSION_TYPE_200_BANDS_8_BITS = 0x4;

const COMPRESSION_TYPES = [
    COMPRESSION_TYPE_50_BANDS_8_BITS,
    COMPRESSION_TYPE_50_BANDS_16_BITS,
    COMPRESSION_TYPE_100_BANDS_8_BITS,
    COMPRESSION_TYPE_100_BANDS_16_BITS,
    COMPRESSION_TYPE_200_BANDS_8_BITS
];

const SPECTRUM_TYPE_RMS = 0x1;
const SPECTRUM_TYPE_PEAK = 0x2;
const SPECTRUM_TYPE_VELOCITY_RMS = 0x3;
const SPECTRUM_TYPE_VELOCITY_PEAK = 0x4;
const SPECTRUM_TYPE_ENVELOPE_RMS = 0x5;
const SPECTRUM_TYPE_ENVELOPE_PEAK = 0x6;

const SPECTRUM_TYPES = [
    SPECTRUM_TYPE_RMS,
    SPECTRUM_TYPE_PEAK,
    SPECTRUM_TYPE_VELOCITY_RMS,
    SPECTRUM_TYPE_VELOCITY_PEAK,
    SPECTRUM_TYPE_ENVELOPE_RMS,
    SPECTRUM_TYPE_ENVELOPE_PEAK
];


// A class to represent the physical values extrctaed from Sentinel data frames
class PhysicalValue {

    static MAX_NB_FREQUENCY_BANDS_IN_FFT_ZOOM = 200;
    static fftZoomPhysicalValues = [];

    static {
        PhysicalValue.fftZoomPhysicalValues = new Array(PhysicalValue.MAX_NB_FREQUENCY_BANDS_IN_FFT_ZOOM);
        let valueNameHeader = "frequency_zoomFftBand";

        for (let measurementIndex = 0; measurementIndex < PhysicalValue.MAX_NB_FREQUENCY_BANDS_IN_FFT_ZOOM; ++measurementIndex) {
            let valueName = valueNameHeader + measurementIndex.toString();
            PhysicalValue.fftZoomPhysicalValues[measurementIndex] = new PhysicalValue(valueName, DB, 0.0, -150.0, 0.0);
        }
    }

    // Signature physical values are identified by their index in this array
    static signaturePhysicalValues = [
        { name: "vibration_frequencyBandS0", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS1", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS2", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS3", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS4", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS5", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS6", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS7", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS8", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "vibration_frequencyBandS9", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS10", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS11", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS12", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS13", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS14", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS15", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS16", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS17", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS18", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "sound_frequencyBandS19", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "acceleration_x", unit: G, value: 0.0, min: 0.0, max: 16.0 },
        { name: "velocity_x", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "acceleration_x_peak", unit: G, value: 0.0, min: 0.0, max: 16.0 },
        { name: "kurtosis_x", unit: "", value: 0.0, min: 0.0, max: 100.0 },
        { name: "vibration_x_root", unit: RPM, value: 0.0, min: 0.0, max: 30000.0 },
        { name: "velocity_x_f1", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "velocity_x_f2", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "velocity_x_f3", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "acceleration_y", unit: G, value: 0.0, min: 0.0, max: 16.0 },
        { name: "velocity_y", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "acceleration_y_peak", unit: G, value: 0.0, min: 0.0, max: 16.0 },
        { name: "kurtosis_y", unit: "", value: 0.0, min: 0.0, max: 100.0 },
        { name: "vibration_y_root", unit: RPM, value: 0.0, min: 0.0, max: 30000.0 },
        { name: "velocity_y_f1", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "velocity_y_f2", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "velocity_y_f3", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "acceleration_z", unit: G, value: 0.0, min: 0.0, max: 16.0 },
        { name: "velocity_z", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "acceleration_z_peak", unit: G, value: 0.0, min: 0.0, max: 16.0 },
        { name: "kurtosis_z", unit: "", value: 0.0, min: 0.0, max: 100.0 },
        { name: "vibration_z_root", unit: RPM, value: 0.0, min: 0.0, max: 30000.0 },
        { name: "velocity_z_f1", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "velocity_z_f2", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "velocity_z_f3", unit: MmPerSecond, value: 0.0, min: 0.0, max: 100.0 },
        { name: "temperature_machineSurface", unit: "°C", value: 0.0, min: -273.15, max: 2000.0 },
        { name: "", unit: "", value: 0.0, min: 0.0, max: 100.0 },
        { name: "kurtosis_ultrasound", unit: "", value: 0.0, min: 0.0, max: 1.0 },
        { name: "sound_sonicRmslog", unit: DB, value: 0.0, min: -150.0, max: 0.0 },
        { name: "", unit: "", value: 0.0, min: 0.0, max: 65535.0 }
    ];

    constructor(name, unit, value, min, max) {
        this.name = name;
        this.unit = unit;
        this.value = value;
        this.min = min;
        this.max = max;
    }

    getName() {
        return this.name;
    }

    getUnit() {
        return this.unit;
    }

    getValue() {
        return this.value;
    }

    getMin() {
        return this.min;
    }

    getMax() {
        return this.max;
    }
}

module.exports = {
    PhysicalValue,
    BATTERY_LEVEL_IDENTIFIER,
    CURRENT_LOOP_IDENTIFIER,
    TEMPERATURE_IDENTIFIER,
    HUMIDITY_IDENTIFIER,
    SHOCK_DETECTION_VECTOR,
    SIGNATURE_VECTOR,
    SIGNATURE_REFEFENCE,
    SIGNATURE_EXTENSIONS,
    SYSTEM_STATUS_REPORT,
    VECTOR_TYPES,
    MICROPHONE_SENSOR,
    ACCELEROMETER_SENSOR,
    SENSOR_TYPES,
    SCALAR_VALUE_SIZE,
    VECTOR_ELEMENT_VALUE_SIZE,
    AVERAGE_AXIS_ORIENTATION,
    X_AXIS_ORIENTATION,
    Y_AXIS_ORIENTATION,
    Z_ORIENTATION,
    ACCELEROMETER_ORIENTATION_TYPES,
    EXTENSION_ACTIVATION_TYPES,
    EXTENSION_ALGORITHM_FFT_ZOOM,
    EXTENSION_ALGORITHM_TYPES,
    COMPRESSION_TYPES,
    SPECTRUM_TYPES
}