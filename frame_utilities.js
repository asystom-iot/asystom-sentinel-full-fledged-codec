class NotFoundInHeaders extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


// Table of data rates per RF region, spreading factor and optionally bandwidth
const LORAWAN_DATA_RATE_TABLES = [
    {
        tables: [ "EU863", "EU433", "CN779", "CN470", "AS923", "KR920", "IN865", "RU864" ],
        spreadingFactors: [
            {
                spreadingFactor: "SF7",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 5
                    },
                    {
                        bandwidth: "BW250",
                        dataRate: 6
                    }
                ],
            },
            {
                spreadingFactor: "SF8",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 4
                    }
                ],
            },
            {
                spreadingFactor: "SF9",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 3
                    },
                ]
            },
            {
                spreadingFactor: "SF10",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 2
                    },
                ]
            },
            {
                spreadingFactor: "SF11",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 1        
                    }
                ]
            },
            {
                spreadingFactor: "SF12",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 0
                    }
                ]
            },
        ]
    },
    {
        tables: [ "AU915", ],
        spreadingFactors: [
            {
                spreadingFactor: "SF7",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 5
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 13
                    }
                ],
            },
            {
                spreadingFactor: "SF8",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 4
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 12
                    },
                ],
            },
            {
                spreadingFactor: "SF9",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 3
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 11
                    },
                ]
            },
            {
                spreadingFactor: "SF10",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 2
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 10
                    },
                ]
            },
            {
                spreadingFactor: "SF11",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 1        
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 9  
                    }
                ]
            },
            {
                spreadingFactor: "SF12",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 0
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 8
                    },
                ]
            },
        ]
    },
    {
        tables: [ "US902", ],
        spreadingFactors: [
            {
                spreadingFactor: "SF7",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 3
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 13
                    }
                ],
            },
            {
                spreadingFactor: "SF8",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 2
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 12
                    },
                ],
            },
            {
                spreadingFactor: "SF9",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 1
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 11
                    },
                ]
            },
            {
                spreadingFactor: "SF10",
                bandwidths: [
                    {
                        bandwidth: "BW125",
                        dataRate: 0
                    },
                    {
                        bandwidth: "BW500",
                        dataRate: 10
                    },
                ]
            },
            {
                spreadingFactor: "SF11",
                bandwidths: [
                    {
                        bandwidth: "BW500",
                        dataRate: 9
                    }
                ]
            },
            {
                spreadingFactor: "SF12",
                bandwidths: [
                    {
                        bandwidth: "BW500",
                        dataRate: 8
                    },
                ]
            },
        ]
    },
];


// Various utility functions to process data frames
class FrameUtilities {

    // Scan the HTTP headers to find the value associated to the input key
    static getValueFromHttpHeaders(headers, key) {
        for (let i = 0; i < headers.length; i += 2) {
            if (headers[i].toLowerCase() === key) {
                return headers[i + 1];
            }
        }

        throw new NotFoundInHeaders(`Key ${key} not found in headers`);
    }

    // Return the data rate table corresponding to the RF region passed as argument
    static findDataRateTable(rfRegion) {
        for (let dataRateTable of LORAWAN_DATA_RATE_TABLES) {
            // console.log(dataRateTable);
            if (dataRateTable.tables.includes(rfRegion)) {
                // console.log(`Found the data rate table for region ${rfRegion}`);
                return dataRateTable;
            }
        }
    
        return undefined;
    }

    // Return the spreading factor entry from the data rate table
    // and spreading factor passed as arguments
    static findSpreadingFactorEntry(dataRateTable, spreadingFactor) {
        for (let spreadingFactorEntry of dataRateTable.spreadingFactors) {
            if (spreadingFactorEntry.spreadingFactor == spreadingFactor) {
                // console.log(`Found the spreading factor entry for spreading factor ${spreadingFactor}`);
                return spreadingFactorEntry;
            }
        }
    
        return undefined;
    }

    // Return the bandwidth entry from the spreading factor
    // and bandwidth passed as arguments
    static findBandwidthEntry(spreadingFactorEntry, bandwidth) {
        for (let bandwidthEntry of spreadingFactorEntry.bandwidths) {
            if (bandwidthEntry.bandwidth == bandwidth) {
                // console.log(`Found the bandwidth entry for bandwidth ${bandwidth}`);
                return bandwidthEntry;
            }
        }
    
        return undefined;
    }

    // Return as a number the data rate for the spreading factor,
    // bandwidth and RF region passed as arguments
    static findDataRate(spreadingFactor, bandwidth="BW125", rfRegion="EU863") {
        let dataRate = 99;
        let dataRateTable;
        let spreadingFactorEntry;
        let bandwidthEntry;
    
        dataRateTable = FrameUtilities.findDataRateTable(rfRegion);
        if (dataRateTable == undefined) {
            return undefined;
        }
    
        spreadingFactorEntry = FrameUtilities.findSpreadingFactorEntry(dataRateTable, spreadingFactor);
        if (spreadingFactorEntry == undefined) {
            return undefined;
        }
    
        bandwidthEntry = FrameUtilities.findBandwidthEntry(spreadingFactorEntry, bandwidth);
        if (bandwidthEntry == undefined) {
            return undefined;
        }
    
        dataRate = bandwidthEntry.dataRate;
    
        return dataRate;
    }

    static getDataRateFromSpreadingFactorString(spreadingFactor, bandwidth="BW125", rfRegion="EU868") {
        let dataRate = FrameUtilities.findDataRate(spreadingFactor, bandwidth, rfRegion) ?? 99;

        return dataRate;
    }

    // Determine the data rate from spreading factor value
    // The spreading factor is expressed as an integer
    static getDataRateFromSpreadingFactor(spreadingFactor) {

        // Turn the integer value into a string so as to use the global table
        let spreadingFactorAsString = `SF${spreadingFactor}`;

        // Compute data rate
        return FrameUtilities.findDataRate(spreadingFactorAsString)?? 99;
    }

    // Determine the data rate from chirp spread spectrum information
    // expressed as a string.
    // The CSS string is formatted like this :
    // "<spreading factor> <bandwidth> <coding rate>"
    static getDataRateFromCssString(lorawanCssInfos) {
        let chirpSpreadSpectrumInfos = lorawanCssInfos.split(' ');

        if (chirpSpreadSpectrumInfos.length == 0) {
            return 99;
        }

        let spreadingFactor = chirpSpreadSpectrumInfos[0];
        let bandwidth = chirpSpreadSpectrumInfos[1];

        let dataRate = FrameUtilities.findDataRate(spreadingFactor, bandwidth)?? 99;

        return dataRate;
    }

    // Determine the data rate from spreading factor and possibly radio-frequency region information
    // Values are based on https://lora-alliance.org/wp-content/uploads/2020/11/lorawan_regional_parameters_v1.0.3reva_0.pdf
    static getDataRateFromSpreadingFactorAndBandwidth(spreadingFactorAndBandwidth, rfRegion) {

        // Split the input string so as to extract the spreading factor and bandwidth
        let spreadingFactor;
        let bandwidth;
        if (spreadingFactorAndBandwidth.length == 8) {
            spreadingFactor = spreadingFactorAndBandwidth.substring(0, 3);
            bandwidth = spreadingFactorAndBandwidth.substring(3);
        }
        else if (spreadingFactorAndBandwidth.length == 9) {
            spreadingFactor = spreadingFactorAndBandwidth.substring(0, 4);
            bandwidth = spreadingFactorAndBandwidth.substring(4);
        }

        let dataRate = FrameUtilities.findDataRate(spreadingFactor, bandwidth, rfRegion)?? 99;

        return dataRate;
    }

    static isLittleEndian() {
        return new TextDecoder().decode(new Uint16Array([0x91c9])) === 'ɑ';
    }
}


module.exports = {
    NotFoundInHeaders,
    FrameUtilities,
}