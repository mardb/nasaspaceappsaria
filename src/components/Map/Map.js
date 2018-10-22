import React, {Component} from 'react';
import * as Vibrant from 'node-vibrant';
// Open Layers Imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import {fromLonLat} from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import {DEVICE_PIXEL_RATIO} from 'ol/has.js';

import OSM from 'ol/source/OSM';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import {get as getProjection} from 'ol/proj';
import {defaults as defaultControls} from 'ol/control';
import {getWidth, getTopLeft} from 'ol/extent';

// App
import {createDataLayerXYZUrl} from './utils';
import Play from '../Audio';
import {gibs} from '../LayerDropdownButton';
// Styles
import {MapContainer, Swatch} from './Map.styles';
import LayerDropdown from '../LayerDropdownButton';

// Map Component
class AppMap extends Component {
    constructor(props) {
        super(props);

        // initial state\\
        this.state = {
            radius: 10,
            color: null,
            centerPx: null,
            centerColor: 'transparent',
            viewportPalette: null,
            version: 0,
            provider: 'modisReflectance'
        };

        this.mousePosition = null;
    }

    // Things that happen when the component first mounts
    componentDidMount() {
        // Initialize the Map
        this.createMap();

        // Window.resize event listener
        window.addEventListener('resize', this.handleResize, {
            passive: true
        });

        Play('hello test');
    }

    componentWillUnmount() {
        // Remove window resize event listener
        window.removeEventListener('resize', this.handleResize);
    }

    componentDidUpdate(prevProps, prevState) {
        console.warn('componentDidUpdate');

        /*  console.log(
            'prev',
            prevState.viewportPalette,
            'curr',
            this.state.viewportPalette
        ); */
        if (
            prevState.viewportPalette &&
            prevState.viewportPalette.DarkMuted !==
                this.state.viewportPalette.DarkMuted
        ) {
            console.log('yay');
            Play(this.state.viewportPalette.DarkMuted);
        }
        // if (prevState.viewportPalette !== this.state.viewportPalette) {
        //     // user moved mouse
        //     // state changed
        //     console.log('something changed');
        // }

        if (this.state.provider !== prevState.provider) {
            console.log('');
            console.warn('provider changed');

            console.log(
                'gibs[this.state.provider].format',
                gibs[this.state.provider].format
            );

            if (this.source) {
                const url = createDataLayerXYZUrl(
                    gibs[this.state.provider].productName,
                    gibs[this.state.provider].date,
                    null,
                    gibs[this.state.provider].matrix,
                    gibs[this.state.provider].format
                );

                console.log('url', url);

                this.source.setUrl(url);
            }
        }
    }

    // Handle resizing of window, with debouncer for performance
    handleResize = () => {
        // Debounce resize:

        // Initial Timeout
        let timeout = false;

        // clear the timeout
        clearTimeout(timeout);
        // start timing for event "completion"
        timeout = setTimeout(() => {
            // Update the map size
            this.map.updateSize();

            // Reset the map center state
            this.setMapCenterXY();
        }, 200);
    };

    createMap = () => {
        // The basemap layer
        this.basemapLayer = new TileLayer({
            source: new OSM(),
            zIndex: 0,
            visible: false
        });

        // The Map View
        this.view = new View({
            center: fromLonLat([0, 0]),
            zoom: 4,
            minZoom: 0,
            maxZoom: 20
        });

        // The OpenLayers Map Object
        this.map = new Map({
            layers: [
                /* this.basemapLayer, */ this.createDataLayerXYZ(
                    gibs[this.state.provider].productName,
                    gibs[this.state.provider].date,
                    null,
                    null,
                    gibs[this.state.provider].format
                )
            ],
            target: 'map-container',
            view: this.view
        });

        // Set initial map center
        this.setMapCenterXY();

        // extracts color after moving map
        this.map.on('moveend', event => {
            this.extractColorsfromImage(event);
        });
        // Add mouse listener

        // this.map.on('pointermove', event => {
        //     //console.log('');
        //     //console.log('pointermove event', event);
        //     this.mousePosition = event.pixel;
        //     //console.log('this.mousePosition', this.mousePosition);
        //     this.map.render();
        //     //var xy = event.pixel;
        //     //console.log('this.map', this.map);
        //     //var pixelAtClick = canvasContext.getImageData(xy[0], xy[1], 1, 1).data;
        //     //var red = pixeAtClick[0]; // green is [1] , blue is [2] , alpha is [4]
        // });
    };

    setMapVersion = () => {
        this.setState({version: +!this.state.version});
    };
    // Get the center of the map in screen pixel coordinates ([x,y])
    setMapCenterXY = () => {
        // Get the x,y coordinates
        const x = (window.innerWidth / 2) * DEVICE_PIXEL_RATIO;
        const y = (window.innerHeight / 2) * DEVICE_PIXEL_RATIO;

        // Update State
        this.setState({centerPx: {x, y}});
    };

    // Layer spy compose
    spyCompose = (type, event) => {
        const ctx = event.context;

        if (type === 'postcompose') {
            ctx.restore();
        } else {
            const pixelRatio = event.frameState.pixelRatio;
            ctx.save();
            ctx.beginPath();
            if (this.mousePosition) {
                // only show a circle around the mouse
                ctx.arc(
                    this.mousePosition[0] * pixelRatio,
                    this.mousePosition[1] * pixelRatio,
                    this.state.radius * pixelRatio,
                    0,
                    2 * Math.PI
                );
                ctx.lineWidth = 5 * pixelRatio;
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.stroke();
            }
            ctx.clip();
        }
    };

    // Calculate pixel color values at mouse position
    getMousePixelValues = event => {
        //console.log('');
        //console.warn('getPixelValues');
        //console.log('event', event);

        const {
            context: ctx,
            frameState: {pixelRatio}
        } = event;

        if (this.mousePosition) {
            const x = this.mousePosition[0] * pixelRatio;
            const y = this.mousePosition[1] * pixelRatio;

            const imageData = ctx.getImageData(x, y, 1, 1).data;

            const color =
                'rgb(' +
                imageData[0] +
                ',' +
                imageData[1] +
                ',' +
                imageData[2] +
                ')';

            console.log('color', color);

            this.setState({color: color});
        }
    };

    setCenterColorValues = context => {
        // Read the pixel value at center
        const imageData = context.getImageData(
            this.state.centerPx.x,
            this.state.centerPx.y,
            1,
            1
        ).data;

        // Construct color variable
        const color = {r: imageData[0], g: imageData[1], b: imageData[2]};

        // Update state
        this.setState({centerColor: color});
    };

    //Extracts color palette
    extractColorsfromImage = event => {
        console.log('');
        //console.log('extractColorsfromImage');
        //console.log(event);
        // console.log('ctx', ctx);
        // const imageData = ctx.getImageData
        // const image = new Image();
        // image.src =canvas.toDataURL("image/png");
        // Vibrant.from('path/to/image').getPalette((err, palette) => console.log(palette))

        const ctx = document.querySelector('canvas');
        //console.log(ctx);
        const imageData = ctx.toDataURL('image/png');
        //console.log(imageData);
        Vibrant.from(imageData).getPalette((err, palette) => {
            if (err) {
                console.error(err);
            } else {
                this.setState({viewportPalette: palette});
                this.setMapVersion();

                console.log('PALETTE', palette);
            }

            // example usage:
            //palette.DarkMuted.getRgb();
        });
    };

    onDataLayerPrecompose = ({
        context: ctx,
        frameState: {pixelRatio},
        ...event
    }) => {};

    onDataLayerPostcompose = ({
        context: ctx,
        frameState: {pixelRatio},
        ...event
    }) => {
        //ctx.restore();
        //ctx.save();
        // Update center color value
        this.setCenterColorValues(ctx);

        // If center is ready
        if (this.state.centerPx) {
            // Begin drawing the "circle crosshair"
            ctx.beginPath();

            // Draw a circle in center of map
            ctx.arc(
                this.state.centerPx.x,
                this.state.centerPx.y,
                this.state.radius * pixelRatio,
                0,
                2 * Math.PI
            );
            ctx.lineWidth = 1 * pixelRatio;
            ctx.strokeStyle = 'red';
            ctx.stroke();
        }
    };

    // Creates the data layer
    createDataLayerXYZ = () => {
        // TODO: remove these temporary layer configs and use dynamic url creation function instead
        const product = 'MODIS_Terra_CorrectedReflectance_TrueColor';
        const testUrl =
            'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3857/best/' +
            'MODIS_Terra_CorrectedReflectance_TrueColor/default/2013-06-15/' +
            'GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg';

        // Create Layer Source
        this.source = new XYZ({
            crossOrigin: 'anonymous',
            //url: testUrl
            url: createDataLayerXYZUrl(
                gibs[this.state.provider].productName,
                gibs[this.state.provider].date,
                null,
                null,
                gibs[this.state.provider].format
            )
        });

        // Create Layer
        this.dataLayer = new TileLayer({
            source: this.source,
            zIndex: 1
        });

        /* Attach "compose" listeners */

        // Pre compose
        this.dataLayer.on('precompose', this.onDataLayerPrecompose);
        // Post compose
        this.dataLayer.on('postcompose', this.onDataLayerPostcompose);

        // Mouse position pixels
        // this.dataLayer.on('postcompose', this.getMousePixelValues);

        // Layer Spy
        //this.dataLayer.on('precompose', event => this.spyCompose('precompose', event));
        //this.dataLayer.on('postcompose', event =>  this.spyCompose('postcompose', event));

        return this.dataLayer;
    };

    onProviderChange = provider => {
        //console.log('onProviderChange');
        //console.log('provider', provider);

        this.setState({
            ...this.state,
            provider: provider,
            version: +!this.state.version
        });
    };

    render() {
        // Construct color code
        const colorCode = `rgb(${this.state.centerColor.r}, ${
            this.state.centerColor.g
        }, ${this.state.centerColor.b})`;
        return (
            <MapContainer id="map-container">
                <LayerDropdown
                    visible={this.state.provider}
                    handleClick={this.onProviderChange}
                />
                <Swatch color={colorCode} />
            </MapContainer>
        );
    }
}

AppMap.propTypes = {};

export default AppMap;

/*  */
