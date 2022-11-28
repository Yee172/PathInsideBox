"use strict";
import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

let controls_TBC, controls_FC;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 100 );
const renderer = new THREE.WebGLRenderer( { antialias: true } );
const stats = new Stats();
const gui = new GUI();

const colors =
{
    background_color: '#cccccc',
    box_color: '#ffffff',
    box_edge_color: '#000000', // not used yet
    line_color: '#ff3333',
}

const boxes = [];
const boxes_profile = [];
const material_box = new THREE.MeshBasicMaterial(
    {
        color: new THREE.Color( colors.box_color ),
        transparent: true,
        opacity: 0.3,
        // wireframe: true
    }
);
const lines = [];
const lines_profile = [];
const material_line = new THREE.LineBasicMaterial(
    {
        color: new THREE.Color( colors.line_color ),
        // linewidth: 5,
    }
);

const initial_profile =
{
    boxes_string: '0.5|0,0,0|gray;0.5|0,0.5,0;0.5|0.5,0,0;0.5|0.5,0.5,0|gray; \
                   0.25|0,0,0.5|gray;0.25|0,0.25,0.5;0.25|0.25,0,0.5;0.25|0.25,0.25,0.5|gray; \
                   0.25|0.5,0,0.5|gray;0.25|0.5,0.25,0.5;0.25|0.75,0,0.5;0.25|0.75,0.25,0.5|gray; \
                   0.25|0,0.5,0.5|gray;0.25|0,0.75,0.5;0.25|0.25,0.5,0.5;0.25|0.25,0.75,0.5|gray; \
                   0.25|0.5,0.5,0.5|gray;0.25|0.5,0.75,0.5;0.25|0.75,0.5,0.5;0.25|0.75,0.75,0.5|gray',
    lines_string: '0.25,0.25,0.25|0.25,0.25,-0.25|0.25,0.75,-0.25|0.25,0.75,0.25; \
                   0.75,0.25,0.25|0.75,0.25,-0.25|0.75,0.75,-0.25|0.75,0.75,0.25',
}

const params =
{
    camera_mode: 0,
    auto_rotate: false,
    rotate_direction: -1,
    rotate_radius: 5,
    rotate_speed: 0.01,
    rotate_angle: 0,
};

const buttons =
{
    change_camera_mode: change_camera_mode,
    camera_reset: camera_reset,
    camera_axis_align: camera_axis_align,
    change_rotate_direction: change_rotate_direction,
    add_boxes: add_boxes,
    add_lines: add_lines,
    export_boxes: export_boxes,
    export_lines: export_lines,
    boxes_finer: boxes_finer,
    delete_last_box: delete_last_box,
    delete_last_line: delete_last_line,
    delete_all_boxes: delete_all_boxes,
    delete_all_lines: delete_all_lines,
};

initialization();
string_to_boxes( initial_profile.boxes_string );
string_to_lines( initial_profile.lines_string );
animate();

function initialization( )
{
    // Scene
    scene.background = new THREE.Color( colors.background_color );
    scene.fog = new THREE.FogExp2( colors.background_color, 0.002 );
    
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
    const world_axis = new THREE.AxesHelper( 2.5 );
    scene.add( world_axis );

    const plane = new THREE.GridHelper( 4, 64 );
    scene.add( plane );

    // Actions
    window.addEventListener( 'resize', onWindowResize );
    createControls( camera );

    const gui_camera = gui.addFolder( 'Camera' ).close();
    gui_camera.add( buttons, 'change_camera_mode' ).name( 'Change camera mode' );
    gui_camera.add( buttons, 'camera_reset' ).name( 'Reset' );
    gui_camera.add( buttons, 'camera_axis_align' ).name( 'Axis align' );
    gui_camera.add( camera.position, 'x' ).name( 'x' ).listen();
    gui_camera.add( camera.position, 'z' ).name( 'z' ).listen();
    gui_camera.add( camera.position, 'y' ).name( 'y' ).listen();
    const gui_rotate = gui.addFolder( 'Auto rotation' );
    gui_rotate.add( params, 'auto_rotate' ).name( 'Active' );
    gui_rotate.add( buttons, 'change_rotate_direction' ).name( 'Change direction' );
    gui_rotate.add( params, 'rotate_radius', 1, 3 ).name( 'Radius' ).listen().onChange(
        function( value )
        {
            var distance = get_distance_to_axisY();
            camera.position.x *= value / distance;
            camera.position.z *= value / distance;
        }
    );
    gui_rotate.add( params, 'rotate_speed', 0.001, 0.01 ).name( 'Speed' );
    const gui_modify = gui.addFolder( 'Modification' );
    gui_modify.add( buttons, 'boxes_finer' ).name( 'Make boxes finer' );
    const gui_IO = gui_modify.addFolder( 'IO' );
    gui_IO.add( buttons, 'add_boxes' ).name( 'Add boxes' );
    gui_IO.add( buttons, 'add_lines' ).name( 'Add lines' );
    gui_IO.add( buttons, 'export_boxes' ).name( 'Export boxes' );
    gui_IO.add( buttons, 'export_lines' ).name( 'Export lines' );
    const gui_deletion = gui_modify.addFolder( 'Deletion' ).close();
    gui_deletion.add( buttons, 'delete_last_box' ).name( 'Delete last box' );
    gui_deletion.add( buttons, 'delete_last_line' ).name( 'Delete last line' );
    gui_deletion.add( buttons, 'delete_all_boxes' ).name( 'Delete all boxes' );
    gui_deletion.add( buttons, 'delete_all_lines' ).name( 'Delete all lines' );

    THREEx.FullScreen.bindKey({ charCode : 'm'.charCodeAt(0) });
}

function remove_all_spaces( s )
{
    return s.replace( /\s+/g, '' );
}

function string_to_one_box( s )
{
    try
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
                    color: new THREE.Color( content_list[ 2 ] ),
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
        boxes_profile.push( remove_all_spaces(s) );
        scene.add( box );
    }
    catch ( error )
    {
        console.error( error );
    }
}

function string_to_boxes( s )
{
    s.split( ';' ).forEach( x => string_to_one_box( x ) );
}

function add_boxes( )
{
    string_to_boxes( prompt( 'Boxes profile [ eg. `3|0,1,2` for box (0,1,2) - (3,4,5) ]:' ) );
}

function export_boxes( )
{
    alert( boxes_profile.join( ';' ) );
}

function delete_last_box( )
{
    if ( boxes.length > 0 )
    {
        const last_box = boxes.pop();
        boxes_profile.pop();
        scene.remove( last_box );
    }
}

function delete_all_boxes( )
{
    while ( boxes.length > 0 )
    {
        const last_box = boxes.pop();
        boxes_profile.pop();
        scene.remove( last_box );
    }
}

function boxes_finer( )
{
    const new_boxes_profile = [];
    let width, height, depth, x, y, z, nx, ny, nz;
    for ( const each_profile of boxes_profile )
    {
        const content_list = each_profile.split( '|' );
        const whd = content_list[ 0 ].split( ',' );
        const position = content_list[ 1 ].split( ',' );
        let profile_head, profile_tail;
        if ( whd.length == 1 )
        {
            width  = Math.abs( Number( whd[ 0 ] ) ) / 2;
            height = width;
            depth  = width;
            profile_head = width.toString() + '|';
        }
        else if ( whd.length == 3 )
        {
            width  = Math.abs( Number( whd[ 0 ] ) ) / 2;
            height = Math.abs( Number( whd[ 1 ] ) ) / 2;
            depth  = Math.abs( Number( whd[ 2 ] ) ) / 2;
            profile_head = width.toString() + ',' + height.toString() + ',' + depth.toString() + '|';
        }
        else
        {
            throw 'Wrong input for size of the box!';
        }
        x = Number( position[ 0 ] );
        y = Number( position[ 1 ] );
        z = Number( position[ 2 ] );
        for ( let i = 0; i < 2; i++ )
        {
            nx = x + width * i;
            for ( let j = 0; j < 2; j++ )
            {
                ny = y + height * j;
                for ( let k = 0; k < 2; k++ )
                {
                    nz = z + depth * k;
                    profile_tail = nx.toString() + ',' + ny.toString() + ',' + nz.toString();
                    if ( ( i + j + k ) % 2 == 0 ) profile_tail += '|gray';
                    new_boxes_profile.push( profile_head + profile_tail );
                }
            }
        }
    }
    delete_all_boxes();
    string_to_boxes( new_boxes_profile.join( ';' ) );
}

function string_to_one_line( s )
{
    try
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
                { color: new THREE.Color( content_list[ content_list.length - 1 ] ) }
            );
        }
        const line = new THREE.Line( geometry_line, material );
        lines.push( line );
        lines_profile.push( remove_all_spaces( s ) );
        scene.add( line );
    }
    catch ( error )
    {
        console.error( error );
    }
}

function string_to_lines( s )
{
    s.split( ';' ).forEach( x => string_to_one_line( x ) );
}

function add_lines( )
{
    string_to_lines( prompt( 'Lines profile [ eg. `0,1,2|1,2,3` for line (0,1,2) - (1,2,3) ]:' ) );
}

function export_lines( )
{
    alert( lines_profile.join( ';' ) );
}

function delete_last_line( )
{
    if ( lines.length > 0 )
    {
        const last_line = lines.pop();
        lines_profile.pop();
        scene.remove( last_line );
    }
}

function delete_all_lines( )
{
    while ( lines.length > 0 )
    {
        const last_line = lines.pop();
        lines_profile.pop();
        scene.remove( last_line );
    }
}

function createControls( camera )
{
    if ( params.camera_mode === 0 )
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

        controls_FC.movementSpeed = 1;
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
    camera.position.set( 0, 1, 2 );
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
