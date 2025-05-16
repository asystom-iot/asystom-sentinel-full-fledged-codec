# Full-fledged Asystom Sentinel codec

This repository aims at providing source code of a full-fledged codec for Asystom Sentinel devices. A codec testing tool is also available.

NB. As of May 2025, the codec supports only frame decoding.

## Disclaimer

The source code available here is not intended for operational use. It is provided as a way to help understand the structure of Asystom Sentinel frames, and as an example of how to write an Asystom Sentinel codec.

Also, please note that this source code is not intended to build a LoRaWAN Codec API Specification-compatible codec. A specific Github repository (https://github.com/asystom-iot/asystom-sentinel-codec) is dedicated to this goal. Still, this repository contains an example of codec that supports the API, and provides some functionalities that are not available in a LoRaWAN Codec API Specification-compatible codec due to limitations on the standard runtime environment of such a codec – i.e. an LNS runtime environment.


## Functionalities

This codec supports uplink data frames and system status frames (frames that are issued by a Sentinel device at startup time and that contain a description of the device configuration).

All types of frames are supported (simple scalar values, signature frames, FFT zoom frames, system status frames).
Split frames (frames that span over several LoRaWAN transmissions due to a low data rate) are also supported.

Encoding of downlink commands is not supported yet but will be in the future.

## Learn More

The `doc` subdirectory contains two documents that describe the format of Sentinel frames and a document that provides information on the source code files content and how to use them.