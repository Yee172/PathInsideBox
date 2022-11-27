"use strict";
import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

let controls_TBC, controls_FC;

let prevTime = performance.now();

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 100 );
const renderer = new THREE.WebGLRenderer( { antialias: true } );
const stats = new Stats();
const gui = new GUI();

const boxes = [];
const material_box = new THREE.MeshBasicMaterial(
    {
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        // wireframe: true
    }
);
const lines = [];
const material_line = new THREE.LineBasicMaterial( { color: 0xff3333 } );

const params =
{
    camera_mode: 0,
    auto_rotate: false,
    rotate_direction: -1,
    rotate_radius: 5,
    rotate_speed: 0.01,
    rotate_angle: 0
};

const buttons =
{
    change_camera_mode: change_camera_mode,
    camera_reset: camera_reset,
    camera_axis_align: camera_axis_align,
    change_rotate_direction: change_rotate_direction,
    add_boxes: add_boxes,
    add_lines: add_lines,
    delete_last_box: delete_last_box,
    delete_last_line: delete_last_line
};

initialization();
string_to_boxes('0.5|0,0,0;0.5|0,0,0.5;0.5|0,0.5,0;0.5|0,0.5,0.5;0.5|0.5,0,0;0.5|0.5,0,0.5;0.5|0.5,0.5,0;0.5|0.5,0.5,0.5;');
string_to_lines('0.25,0.25,0.25|0.25,0.25,-0.25|0.25,0.75,-0.25|0.25,0.75,0.25;0.75,0.25,0.25|0.75,0.25,-0.25|0.75,0.75,-0.25|0.75,0.75,0.25');
animate();

function initialization( )
{
    // Scene
    scene.background = new THREE.Color( 0xcccccc );
    scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );
    // scene.fog = new THREE.Fog(0xFFFFFF, 0.1, 1000);
    
    // Camera
    camera_reset();

    // Renderer
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    // Stats
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.zIndex = 100;
    stats.domElement.style.bottom = '0px';
    document.body.appendChild( stats.domElement );

    // Objects
    const worldAxis = new THREE.AxesHelper( 3 );
    scene.add(worldAxis);

    const plane = new THREE.GridHelper( 5, 100 );
    scene.add(plane);

    // Lights
    const dirLight1 = new THREE.DirectionalLight( 0xffffff );
    dirLight1.position.set( 1, 1, 1 );
    scene.add( dirLight1 );

    const dirLight2 = new THREE.DirectionalLight( 0x002288 );
    dirLight2.position.set( - 1, - 1, - 1 );
    scene.add( dirLight2 );

    const ambientLight = new THREE.AmbientLight( 0x222222 );
    scene.add( ambientLight );

    // Actions
    window.addEventListener( 'resize', onWindowResize );
    createControls( camera );

    const gui_camera = gui.addFolder('Camera');
    gui_camera.add( buttons, 'change_camera_mode' ).name( 'Change camera mode' );
    gui_camera.add( buttons, 'camera_reset' ).name( 'Reset' );
    gui_camera.add( buttons, 'camera_axis_align' ).name( 'Axis align' );
    gui_camera.add( camera.position, 'x' ).name( 'x' ).listen();
    gui_camera.add( camera.position, 'z' ).name( 'z' ).listen();
    gui_camera.add( camera.position, 'y' ).name( 'y' ).listen();
    const gui_rotate = gui.addFolder('Auto rotation');
    gui_rotate.add( params, 'auto_rotate' ).name( 'Active' );
    gui_rotate.add( buttons, 'change_rotate_direction' ).name( 'Change direction' );
    gui_rotate.add( params, 'rotate_radius', 0.5, 100 ).name( 'Radius' ).listen().onChange(
        function( value )
        {
            var distance = get_distance_to_axisY();
            camera.position.x *= value / distance;
            camera.position.z *= value / distance;
        }
    );
    gui_rotate.add( params, 'rotate_speed', 0.001, 0.01 ).name( 'Speed' );
    const gui_modify = gui.addFolder('Modification');
    gui_modify.add( buttons, 'add_boxes' ).name( 'Add boxes' );
    gui_modify.add( buttons, 'add_lines' ).name( 'Add lines' );
    gui_modify.add( buttons, 'delete_last_box' ).name( 'Delete last box' );
    gui_modify.add( buttons, 'delete_last_line' ).name( 'Delete last line' );

    THREEx.FullScreen.bindKey({ charCode : 'm'.charCodeAt(0) });
}

function string_to_one_box( s )
{
    s = s.trim();
    if ( s.length == 0 ) return;

    const content_list = s.split( '|' );
    const whd = content_list[ 0 ].trim().split( ',' );
    var geometry_box, material, width, height, depth;
    material = material_box;

    if ( whd.length == 1 )
    {
        width  = Math.abs( Number( whd[ 0 ] ) );
        height = width;
        depth  = width;
    }
    else if ( whd.length == 3 )
    {
        width  = Math.abs( Number( whd[ 0 ] ) );
        height = Math.abs( Number( whd[ 1 ] ) );
        depth  = Math.abs( Number( whd[ 2 ] ) );
    }
    else
    {
        throw 'Wrong input for size of the box!';
    }
    geometry_box = new THREE.BoxGeometry( width, height, depth );

    const position = content_list[ 1 ].trim().split( ',' );
    if ( position.length != 3 ) throw 'Wrong input for position of the box!';

    if ( content_list.length > 2 )
    {
        material = new THREE.MeshBasicMaterial(
            {
                color: Number(content_list[ 2 ]),
                transparent: true,
                opacity: 0.5
            }
        );
    }

    const box = new THREE.Mesh( geometry_box, material );
    box.position.set(
        Number( position[ 0 ] ) + width  / 2,
        Number( position[ 1 ] ) + height / 2,
        Number( position[ 2 ] ) + depth  / 2
    );
    boxes.push( box );
    scene.add( box );
}

function string_to_boxes( s )
{
    s.split( ';' ).forEach( x => string_to_one_box( x ) );
}

function add_boxes( )
{
    string_to_boxes( prompt( 'Boxes profile [ eg. `3|0,1,2` for box (0,1,2) - (3,4,5) ]:' ) );
}

function delete_last_box( )
{
    if ( boxes.length > 0 )
    {
        const last_box = boxes.pop();
        scene.remove(last_box);
    }
}

function string_to_one_line( s )
{
    s = s.trim();
    if ( s.length == 0 ) return;

    const content_list = s.split( '|' );
    if ( content_list.length < 2 ) throw 'No enough points for forming a line';

    const points = [];
    var material, color_flag;
    material = material_line;
    color_flag = content_list[ content_list.length - 1 ].indexOf( ',' ) == -1;

    for ( let i = 0; i < content_list.length - color_flag; i++ )
    {
        const xyz = content_list[ i ].split( ',' );
        if ( xyz.length != 3 ) throw 'Wrong input for point in line';
        points.push( new THREE.Vector3(
            Number( xyz[ 0 ] ),
            Number( xyz[ 1 ] ),
            Number( xyz[ 2 ] )
        ) );
    }
    const geometry_line = new THREE.BufferGeometry().setFromPoints( points );

    if ( color_flag )
    {
        material = new THREE.LineBasicMaterial(
            { color: Number( content_list[ content_list.length - 1 ] ) }
        );
    }
    const line = new THREE.Line( geometry_line, material );
    lines.push( line );
    scene.add( line );
}

function string_to_lines( s )
{
    s.split( ';' ).forEach( x => string_to_one_line( x ) );
}

function add_lines( )
{
    string_to_lines( prompt( 'Lines profile [ eg. `0,1,2|1,2,3` for line (0,1,2) - (1,2,3) ]:' ) );
}

function delete_last_line( )
{
    if ( lines.length > 0 )
    {
        const last_line = lines.pop();
        scene.remove(last_line);
    }
}

function createControls( camera )
{
    if ( params.camera_mode === 0)
    {
        // TrackballControls
        controls_TBC = new TrackballControls( camera, renderer.domElement );

        controls_TBC.rotateSpeed = 1.0;
        controls_TBC.zoomSpeed = 1.2;
        controls_TBC.panSpeed = 0.8;
        controls_TBC.noZoom = false;
        controls_TBC.noPan = false;
        controls_TBC.staticMoving = true;
        controls_TBC.dynamicDampingFactor = 0.3;

        controls_TBC.keys = [ 'KeyZ', 'KeyX', 'KeyC' ];
    }
    else if ( params.camera_mode === 1 )
    {
        // FlyControls
        controls_FC = new FlyControls( camera, renderer.domElement );

        controls_FC.movementSpeed = 10;
        controls_FC.domElement = renderer.domElement;
        controls_FC.rollSpeed = Math.PI / 8;
        controls_FC.autoForward = false;
        controls_FC.dragToLook = false;
    }
}

function onWindowResize( )
{
    camera.aspect = window.innerWidth / window.innerHeight;;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    controls_TBC.handleResize();
}

function get_distance_to_axisY( )
{
    return Math.sqrt( Math.pow( camera.position.x, 2 ) + Math.pow( camera.position.z, 2 ) );
}

function change_camera_mode( )
{
    if ( params.camera_mode === 0 )
    {
        controls_TBC.dispose();
        params.camera_mode = 1;
        createControls( camera );
    }
    else if ( params.camera_mode === 1 )
    {
        controls_FC.dispose();
        params.camera_mode = 0;
        createControls( camera );
    }
}

function camera_axis_align( )
{
    camera.up.set( 0, 1, 0 );
}

function camera_reset( )
{
    camera.position.set( 0, 0.5, 2 );
    camera.lookAt( 0, 0, 0 );
    camera_axis_align();
}

function camera_auto_rotate( )
{
    camera_axis_align();
    camera.lookAt( 0, camera.position.y, 0 );
    params.rotate_angle += params.rotate_direction * params.rotate_speed;
    camera.position.x = params.rotate_radius * Math.cos( params.rotate_angle );
    camera.position.z = params.rotate_radius * Math.sin( params.rotate_angle );
}

function change_rotate_direction( )
{
    params.rotate_direction *= -1;
}

function animate( )
{
    requestAnimationFrame( animate );

    if ( params.camera_mode === 1 ) controls_FC.update( 0.01 );
    else controls_TBC.update();

    stats.update();

    params.rotate_radius = Math.max( 0.5, Math.min( 100, get_distance_to_axisY() ) );
    if ( params.auto_rotate ) camera_auto_rotate();

    renderer.render( scene, camera );
}
