// app.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';

// Variables
let scene, camera, renderer, controls;
let panoramaSphere;
let currentHotspots = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// DOM Elements
const viewer = document.getElementById('viewer');
const canvas = document.getElementById('three-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const locationNameEl = document.getElementById('location-name');
const locationDescEl = document.getElementById('location-description');
const navButtonsContainer = document.getElementById('nav-buttons-container');
const infoPanel = document.querySelector('.info-panel');
const panelHandle = document.querySelector('.panel-handle');

// Mobile panel minimize
let isPanelMinimized = false;
let touchStartY = 0;
let touchCurrentY = 0;

if (panelHandle) {
    panelHandle.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });

    panelHandle.addEventListener('touchmove', (e) => {
        touchCurrentY = e.touches[0].clientY;
        const diff = touchCurrentY - touchStartY;
        
        if (diff > 50 && !isPanelMinimized) {
            infoPanel.classList.add('minimized');
            isPanelMinimized = true;
        } else if (diff < -50 && isPanelMinimized) {
            infoPanel.classList.remove('minimized');
            isPanelMinimized = false;
        }
    });

    panelHandle.addEventListener('click', () => {
        infoPanel.classList.toggle('minimized');
        isPanelMinimized = !isPanelMinimized;
    });
}

// Location Data
const locations = {
    'halaman_depan': {
        name: 'Halaman Depan',
        description: 'Tipe 36/72 – 2 Kamar Tidur, 1 Kamar Mandi, Carport Luas.',
        panorama: '/public/images/panorama/depan_optimize.jpg',
        hotspots: [
            {
                position: new THREE.Vector3(-15, -2, -5),
                target: 'ruang_tamu',
                label: 'Masuk ke Ruang Tamu'
            }
        ]
    },
    'ruang_tamu': {
        name: 'Ruang Tamu',
        description: 'Desain interior modern dengan pencahayaan alami yang optimal.',
        panorama: '/public/images/panorama/ruang_tamu_optimize.jpg',
        hotspots: [
            {
                position: new THREE.Vector3(-10, -2, -15),
                target: 'halaman_depan',
                label: 'Kembali ke Halaman Depan'
            },
            {
                position: new THREE.Vector3(15, -3, 10),
                target: 'dapur',
                label: 'Menuju Dapur'
            }
        ]
    },
    'dapur': {
        name: 'Dapur',
        description: 'Dapur bersih dengan kitchen set minimalis dan fungsional.',
        panorama: '/public/images/panorama/dapur.jpg',
        hotspots: [
            {
                position: new THREE.Vector3(12, -4, 15),
                target: 'ruang_tamu',
                label: 'Kembali ke Ruang Tamu'
            }
        ]
    }
};

// Initialize
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const geometry = new THREE.SphereGeometry(50, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    panoramaSphere = new THREE.Mesh(geometry, material);
    scene.add(panoramaSphere);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = -0.25;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    window.addEventListener('resize', onWindowResize);
    viewer.addEventListener('click', onHotspotClick);
    viewer.addEventListener('wheel', onWheelZoom, { passive: false });

    loadLocation('halaman_depan');
    animate();
}

function loadLocation(locationId) {
    const locationData = locations[locationId];
    if (!locationData) return;
    
    showLoading(true);
    document.body.style.backgroundImage = `url(${locationData.panorama})`;
    updateInfoPanel(locationData);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(locationData.panorama, (texture) => {
        panoramaSphere.material.map = texture;
        panoramaSphere.material.needsUpdate = true;
        
        clearHotspots();
        locationData.hotspots.forEach(hotspotData => {
            const hotspot = createHotspot(hotspotData);
            currentHotspots.push(hotspot);
            scene.add(hotspot);
        });

        showLoading(false);
    });
}

function transitionToLocation(targetId) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:black;opacity:0;z-index:50;';
    viewer.appendChild(overlay);

    new TWEEN.Tween({ opacity: 0 }).to({ opacity: 1 }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(obj => overlay.style.opacity = obj.opacity)
        .onComplete(() => {
            loadLocation(targetId);
            new TWEEN.Tween({ opacity: 1 }).to({ opacity: 0 }, 500)
                .easing(TWEEN.Easing.Quadratic.In)
                .onUpdate(obj => overlay.style.opacity = obj.opacity)
                .onComplete(() => viewer.removeChild(overlay))
                .start();
        })
        .start();
}

function createHotspot(hotspotData) {
    const hotspotTexture = createHotspotTexture();
    const material = new THREE.SpriteMaterial({ map: hotspotTexture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(hotspotData.position);
    sprite.scale.set(2.5, 2.5, 1);
    sprite.userData = { target: hotspotData.target, type: 'hotspot' };
    return sprite;
}

function createHotspotTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#F9A826';
    ctx.stroke();
    ctx.fillStyle = '#F9A826';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', 64, 68);
    return new THREE.CanvasTexture(canvas);
}

function clearHotspots() {
    currentHotspots.forEach(hotspot => scene.remove(hotspot));
    currentHotspots = [];
}

function updateInfoPanel(locationData) {
    locationNameEl.textContent = locationData.name;
    locationDescEl.textContent = locationData.description;
    navButtonsContainer.innerHTML = '';
    locationData.hotspots.forEach(hotspot => {
        const button = document.createElement('button');
        button.className = 'nav-button';
        button.textContent = hotspot.label;
        button.onclick = () => transitionToLocation(hotspot.target);
        navButtonsContainer.appendChild(button);
    });
}

function showLoading(isLoading) {
    loadingOverlay.classList.toggle('visible', isLoading);
}

function onWindowResize() {
    camera.aspect = viewer.clientWidth / viewer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
}

function onWheelZoom(event) {
    event.preventDefault();
    camera.fov += event.deltaY * 0.05;
    camera.fov = Math.max(40, Math.min(100, camera.fov));
    camera.updateProjectionMatrix();
}

function onHotspotClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(currentHotspots);
    if (intersects.length > 0) {
        const clickedHotspot = intersects[0].object;
        if(clickedHotspot.userData.target) {
            transitionToLocation(clickedHotspot.userData.target);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
    renderer.render(scene, camera);
}

init();