import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Setup DRACO loader for compressed models
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue to see environment better

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 8); // Initial position

// Camera follow settings (Mobile Legends style - 30 degree angle looking down, balanced view)
const cameraOffset = new THREE.Vector3(0, 60, -100); // 30 degree angle - lower camera, further back
const cameraLookAtOffset = new THREE.Vector3(0, 0, 0); // Look at robot's center

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Grid (temporarily removed to see environment better)
// const gridHelper = new THREE.GridHelper(10, 10);
// scene.add(gridHelper);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// Setup GLTFLoader with DRACO support
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Robot variables
let model;
let allParts = [];
let robotParts = {
    leftLeg: null,
    rightLeg: null,
    leftArm: null,
    rightArm: null
};
let walkCycle = 0;
let isWalking = false;
let targetRotation = Math.PI; // 180 degrees - robot initial rotation
let currentRotation = Math.PI; // 180 degrees
let moveDirection = { forward: 0, right: 0 };
let speedMultiplier = 0.3;
let isReversing = false; // Track if robot is in reverse mode
let baseRotation = Math.PI; // Store the base rotation - 180 degrees
let sKeyWasPressed = false; // Track if S key was already pressed to prevent rapid toggling

// Teleportation effect variables
let teleportEffect = null;
let teleportParticles = [];
let isTeleporting = false;
let teleportProgress = 0;

// Origin offset for position display
const originOffset = { x: 681.30, y: -100, z: -50 }; // Robot Y position at -120

// Jump variables
let isJumping = false;
let jumpVelocity = 0;
let gravity = 0.014; // Adjusted gravity for higher jump
let jumpStrength = 2.0; // Higher jump strength

let isBowing = false;
let bowProgress = 0;
let bowSpeed = 0.05;

// Cloud variables
const clouds = [];
const cloudCount = 20;

// Function to create teleportation effect
function createTeleportEffect(position) {
    // Create a group for the teleport effect
    teleportEffect = new THREE.Group();
    teleportEffect.position.copy(position);

    // Create massive spiral energy particles
    for (let i = 0; i < 250; i++) {
        const geometry = new THREE.SphereGeometry(1.8, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 1.0, 0.5 + Math.random() * 0.3), // Bright blue-cyan
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(geometry, material);

        // Create massive spiral from bottom
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 60; // Very large radius
        const height = Math.random() * 120 - 70; // Tall spiral

        particle.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );

        // Store initial data for dramatic spiral animation
        particle.userData = {
            angle: angle,
            radius: radius,
            initialHeight: height,
            height: height,
            speed: Math.random() * 0.1 + 0.05,
            rotationSpeed: (Math.random() + 0.5) * 0.15, // Fast spiral rotation
            brightness: Math.random() * 0.6 + 0.4,
            flashPhase: Math.random() * Math.PI * 2 // For dimensional flashing
        };

        teleportEffect.add(particle);
        teleportParticles.push(particle);
    }

    // Add huge glowing ground portal
    const diskGeometry = new THREE.CircleGeometry(70, 64);
    const diskMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ccff, // Bright blue portal
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const disk = new THREE.Mesh(diskGeometry, diskMaterial);
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = -68;
    teleportEffect.add(disk);

    // Add dimensional rift rings
    for (let i = 0; i < 8; i++) {
        const ringGeometry = new THREE.TorusGeometry(25 + i * 8, 1.5, 16, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.55 + i * 0.02, 1.0, 0.5),
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -68 + i * 3;
        ring.userData.initialY = ring.position.y;
        ring.userData.rotationSpeed = 0.02 + i * 0.005;
        teleportEffect.add(ring);
    }

    // Add massive energy vortex beam
    const beamGeometry = new THREE.CylinderGeometry(3, 25, 140, 32, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0x0099ff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = 0;
    teleportEffect.add(beam);

    scene.add(teleportEffect);
    isTeleporting = true;
    teleportProgress = 0;
}

// Function to update teleportation effect
function updateTeleportEffect() {
    if (!isTeleporting || !teleportEffect) return;

    teleportProgress += 0.01;

    // Animate particles with dramatic spiral motion
    teleportParticles.forEach((particle, index) => {
        // Fast spiral rotation
        particle.userData.angle += particle.userData.rotationSpeed;
        particle.userData.height += 1.2;

        // Dramatic spiral - particles spiral inward as they rise
        const spiralFactor = 1 - (particle.userData.height + 70) / 190;
        const currentRadius = particle.userData.radius * Math.max(0.2, spiralFactor);

        particle.position.x = Math.cos(particle.userData.angle) * currentRadius;
        particle.position.y = particle.userData.height;
        particle.position.z = Math.sin(particle.userData.angle) * currentRadius;

        // Reset particle if it goes too high
        if (particle.userData.height > 50) {
            particle.userData.height = particle.userData.initialHeight;
        }

        // Dimensional flashing effect - particles flash in and out
        particle.userData.flashPhase += 0.2;
        const flashIntensity = Math.abs(Math.sin(particle.userData.flashPhase));

        // Height-based fade
        const heightFade = Math.max(0, 1 - (particle.position.y + 70) / 120);
        particle.material.opacity = 0.8 * heightFade * (1 - teleportProgress * 0.5) * particle.userData.brightness * flashIntensity;

        // Color shifting for dimensional effect
        const colorShift = Math.sin(particle.userData.flashPhase * 0.5) * 0.1;
        particle.material.color.setHSL(0.55 + colorShift, 1.0, 0.5 + flashIntensity * 0.3);

        // Scale pulsing
        const scale = 1 + Math.sin(particle.userData.flashPhase) * 0.4;
        particle.scale.set(scale, scale, scale);
    });

    // Animate ground portal - intense pulse
    const disk = teleportEffect.children[teleportEffect.children.length - 9];
    if (disk) {
        const pulse = 1 + Math.sin(teleportProgress * Math.PI * 6) * 0.25;
        disk.scale.set(pulse, pulse, pulse);
        disk.material.opacity = 0.4 * Math.sin(teleportProgress * Math.PI);
        disk.rotation.z += 0.04; // Fast rotation
    }

    // Animate dimensional rift rings
    for (let i = teleportEffect.children.length - 8; i < teleportEffect.children.length - 1; i++) {
        const ring = teleportEffect.children[i];
        if (ring && ring.userData.initialY !== undefined) {
            // Rings spin at different speeds
            ring.rotation.z += ring.userData.rotationSpeed;

            // Rings rise and expand
            ring.position.y = ring.userData.initialY + Math.sin(teleportProgress * Math.PI) * 20;

            // Flash in and out
            const flash = Math.abs(Math.sin(teleportProgress * Math.PI * 4 + i));
            ring.material.opacity = 0.5 * flash;

            // Scale pulse
            const ringScale = 1 + Math.sin(teleportProgress * Math.PI * 2) * 0.3;
            ring.scale.set(ringScale, ringScale, ringScale);
        }
    }

    // Animate massive energy vortex
    const beam = teleportEffect.children[teleportEffect.children.length - 1];
    if (beam) {
        // Beam swirls dramatically
        beam.rotation.y += 0.08;

        // Beam intensity flashes
        const beamFlash = Math.abs(Math.sin(teleportProgress * Math.PI * 5));
        beam.material.opacity = 0.2 * beamFlash;

        // Beam expands and contracts
        const beamScale = 1 + Math.sin(teleportProgress * Math.PI * 3) * 0.4;
        beam.scale.set(beamScale, 1, beamScale);
    }

    // After 2 seconds, remove teleport effect and show robot
    if (teleportProgress >= 1) {
        scene.remove(teleportEffect);
        teleportEffect = null;
        teleportParticles = [];
        isTeleporting = false;

        // Make robot visible with fade-in effect
        if (model) {
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = 0;

                    // Fade in animation
                    const fadeIn = setInterval(() => {
                        child.material.opacity += 0.05;
                        if (child.material.opacity >= 1) {
                            child.material.opacity = 1;
                            child.material.transparent = false;
                            clearInterval(fadeIn);
                        }
                    }, 30);
                }
            });
        }
    }
}

// Function to create clouds
function createClouds() {
    for (let i = 0; i < cloudCount; i++) {
        const cloudGroup = new THREE.Group();

        // Create multiple spheres to form a cloud with better variation
        const sphereCount = Math.floor(Math.random() * 4) + 4; // 4-7 spheres per cloud
        for (let j = 0; j < sphereCount; j++) {
            const geometry = new THREE.SphereGeometry(
                Math.random() * 12 + 8, // Moderate size: 8-20
                8, 8
            );
            const material = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: Math.random() * 0.3 + 0.6 // Varied opacity: 0.6-0.9
            });
            const sphere = new THREE.Mesh(geometry, material);

            // Better cloud shape with more spread
            sphere.position.x = Math.random() * 35 - 17.5;
            sphere.position.y = Math.random() * 12 - 6;
            sphere.position.z = Math.random() * 25 - 12.5;

            cloudGroup.add(sphere);
        }

        // Position clouds around the environment
        cloudGroup.position.x = Math.random() * 1000 - 500;
        cloudGroup.position.y = Math.random() * 50 + 10; // Lower in the sky
        cloudGroup.position.z = Math.random() * 1000 - 500;

        // More varied scale for better variation
        const scale = Math.random() * 1.8 + 0.8; // 0.8-2.6 for good variety
        cloudGroup.scale.set(scale, scale * 0.8, scale); // Slightly flattened for realistic look

        // Store cloud data for animation
        clouds.push({
            group: cloudGroup,
            speed: Math.random() * 0.3 + 0.1, // Varied speed: 0.1-0.4
            direction: Math.random() * Math.PI * 2 // Random direction
        });

        scene.add(cloudGroup);
    }
    console.log(`✓ Created ${cloudCount} animated clouds`);
}

// Auto-load robot.glb from model folder
window.addEventListener('load', function () {
    // Create clouds
    createClouds();
    loader.load(
        './model/robot.glb',
        function (gltf) {
            loadModelFromGLTF(gltf);
            console.log('✓ Robot loaded successfully!');
        },
        function (xhr) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
            console.log(`Loading robot: ${percent}%`);
        },
        function (error) {
            console.error('Failed to load robot.glb:', error);
        }
    );

    // Load environment.glb
    console.log('🔄 Starting to load environment.glb...');
    loader.load(
        'environment/environment.glb',
        function (gltf) {
            const environment = gltf.scene;

            console.log('✓ Environment loaded! Analyzing...');
            console.log('Environment object:', environment);

            // Get original bounds
            const box = new THREE.Box3().setFromObject(environment);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            console.log('Environment size:', size);
            console.log('Environment center:', center);

            // Scale the environment to make it bigger
            environment.scale.set(20, 20, 20); // 20x bigger

            // Position at origin
            environment.position.set(0, -size.y / 2 * 20, 0); // Put bottom at y=0 (adjusted for scale)

            console.log('Environment position:', environment.position);
            console.log('Environment scale: 20x');

            scene.add(environment);
            console.log('✓ Environment added to scene!');
            console.log('Environment children count:', environment.children.length);

            // List all children to see what's in the environment
            environment.traverse((child) => {
                if (child.isMesh) {
                    console.log('Found mesh:', child.name, 'Material:', child.material);
                }
            });
        },
        function (xhr) {
            console.log('📦 Environment loading progress event:', xhr);
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
                console.log(`Loading environment: ${percent}%`);
            } else {
                console.log('Loading environment... (size unknown)');
            }
        },
        function (error) {
            console.error('❌ Failed to load environment.glb!');
            console.error('Error:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
        }
    );
});

function loadModelFromGLTF(gltf) {
    if (model) scene.remove(model);

    model = gltf.scene;

    // Collect all parts
    allParts = [];
    model.traverse((child) => {
        if (child.isMesh || child.isGroup || child.isObject3D) {
            allParts.push(child);
        }
    });

    console.log(`Found ${allParts.length} parts`);

    // Calculate size and scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (2 / maxDim) * 20; // 20x bigger - more visible
    model.scale.set(scale, scale, scale);

    model.rotation.y = Math.PI; // 180 degrees - robot initial rotation
    // Position robot at initial coordinates
    model.position.set(681.30, -100, -50); // Robot Y position at -130

    // Make robot invisible initially
    model.visible = false;

    scene.add(model);

    targetRotation = Math.PI; // 180 degrees
    currentRotation = Math.PI; // 180 degrees

    populatePartLists();

    // Start teleportation effect
    createTeleportEffect(model.position);

    // Make robot visible after 2 seconds
    setTimeout(() => {
        model.visible = true;
    }, 2000);
}

window.toggleMainPanel = function () {
    const content = document.getElementById('mainPanelContent');
    const arrow = document.getElementById('toggleArrow');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.textContent = '▼';
    } else {
        content.style.display = 'none';
        arrow.textContent = '▶';
    }
}

window.toggleCategory = function (titleElement) {
    const partList = titleElement.nextElementSibling;
    titleElement.classList.toggle('collapsed');
    partList.classList.toggle('collapsed');
}

window.updateSpeed = function (value) {
    speedMultiplier = parseFloat(value);
    document.getElementById('speedValue').textContent = value + 'x';
}

window.testJump = function () {
    if (model && !isJumping) {
        isJumping = true;
        jumpVelocity = jumpStrength;
    }
}

function populatePartLists() {
    const lists = {
        leftLeg: document.getElementById('leftLegList'),
        rightLeg: document.getElementById('rightLegList'),
        leftArm: document.getElementById('leftArmList'),
        rightArm: document.getElementById('rightArmList')
    };

    Object.values(lists).forEach(list => list.innerHTML = '');

    allParts.forEach((part, index) => {
        Object.keys(lists).forEach(type => {
            const item = document.createElement('div');
            item.className = 'part-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${type}_${index}`;
            checkbox.name = type;
            checkbox.value = index;
            checkbox.onchange = function () {
                if (this.checked) {
                    document.querySelectorAll(`input[name="${type}"]`).forEach(cb => {
                        if (cb !== this) cb.checked = false;
                    });
                    assignPart(type, index);
                } else {
                    robotParts[type] = null;
                }
            };

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = part.name || `Part_${index}`;

            item.appendChild(checkbox);
            item.appendChild(label);
            lists[type].appendChild(item);
        });
    });
}

function assignPart(partType, index) {
    robotParts[partType] = allParts[parseInt(index)];
    console.log(`${partType} assigned to: ${allParts[parseInt(index)].name}`);
}

window.testAnimation = function () {
    const testDuration = 3000;
    const startTime = Date.now();

    function testWalk() {
        if (Date.now() - startTime < testDuration) {
            walkCycle += 0.15;
            updateWalkAnimation();
            requestAnimationFrame(testWalk);
        }
    }
    testWalk();
}

window.resetParts = function () {
    robotParts = {
        leftLeg: null,
        rightLeg: null,
        leftArm: null,
        rightArm: null
    };
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
}

window.resetPosition = function () {
    if (model) {
        model.position.set(681.30, -100, -50); // Robot Y position at -130
        model.rotation.y = Math.PI; // 180 degrees - robot initial rotation

        targetRotation = Math.PI; // 180 degrees
        currentRotation = Math.PI; // 180 degrees
        baseRotation = Math.PI; // 180 degrees
        isReversing = false; // Reset reverse mode

        isJumping = false;
        jumpVelocity = 0;

        if (robotParts.leftLeg) robotParts.leftLeg.rotation.x = 0;
        if (robotParts.rightLeg) robotParts.rightLeg.rotation.x = 0;
        if (robotParts.leftArm) robotParts.leftArm.rotation.x = 0;
        if (robotParts.rightArm) robotParts.rightArm.rotation.x = 0;

        walkCycle = 0;
        isWalking = false;

        console.log('Robot position reset to initial position (681.30, -130, -50) at 180 degrees');
    }
}

function updateWalkAnimation() {
    const legSwing = Math.sin(walkCycle) * 0.3;
    const armSwing = Math.sin(walkCycle) * 0.2;

    if (robotParts.leftLeg) {
        robotParts.leftLeg.rotation.x = legSwing;
    }
    if (robotParts.rightLeg) {
        robotParts.rightLeg.rotation.x = -legSwing;
    }
    if (robotParts.leftArm) {
        robotParts.leftArm.rotation.x = -armSwing;
    }
    if (robotParts.rightArm) {
        robotParts.rightArm.rotation.x = armSwing;
    }
}

// Keyboard
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    console.log('Key pressed:', e.code); // Debug log

    if (e.code === 'Space' && !isJumping && model) {
        isJumping = true;
        jumpVelocity = jumpStrength;
        e.preventDefault();
    }

    if (e.ctrlKey && e.code === 'KeyB' && !isBowing && model) {
        isBowing = true;
        bowProgress = 0;
        e.preventDefault();
    }
});
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    console.log('Key released:', e.code); // Debug log
});

// Mobile joystick controls
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

const joystickContainer = document.getElementById('joystickContainer');
const joystickStick = document.getElementById('joystickStick');
const jumpButton = document.getElementById('jumpButton');

function handleJoystickMove(touch) {
    const rect = document.getElementById('joystickBase').getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

    const maxDistance = 35;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxDistance) {
        deltaX = (deltaX / distance) * maxDistance;
        deltaY = (deltaY / distance) * maxDistance;
    }

    joystickStick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

    joystickVector.x = deltaX / maxDistance;
    joystickVector.y = deltaY / maxDistance;
}

function resetJoystick() {
    joystickStick.style.transform = 'translate(-50%, -50%)';
    joystickVector = { x: 0, y: 0 };
    joystickActive = false;
}

joystickContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    handleJoystickMove(e.touches[0]);
});

joystickContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (joystickActive) {
        handleJoystickMove(e.touches[0]);
    }
});

joystickContainer.addEventListener('touchend', (e) => {
    e.preventDefault();
    resetJoystick();
});

jumpButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (model && !isJumping) {
        isJumping = true;
        jumpVelocity = jumpStrength;
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (model) {
        const baseSpeed = 1.0; // Increased to 1.0 for much faster movement
        const speed = baseSpeed * speedMultiplier;
        const rotationSpeed = 0.015 * speedMultiplier; // Further reduced for smoother, slower rotation
        let moving = false;

        moveDirection = { forward: 0, right: 0 };

        let moveX = 0;
        let moveZ = 0;

        if (keys['ArrowUp'] || keys['KeyW']) {
            // Move forward in the direction robot is currently facing - 3x faster
            const forwardSpeed = speed * 3;
            moveX += Math.sin(currentRotation) * forwardSpeed;
            moveZ += Math.cos(currentRotation) * forwardSpeed;
            // Don't change isReversing - keep the current facing direction
            moving = true;
        }
        if (keys['ArrowDown'] || keys['KeyS']) {
            // Toggle reverse mode - turn robot around 180 degrees (no movement)
            // Only toggle once per key press, not continuously while held
            if (!sKeyWasPressed) {
                if (!isReversing) {
                    isReversing = true;
                } else {
                    // If already reversed, turn back to forward
                    isReversing = false;
                }
                sKeyWasPressed = true;
            }
        } else {
            // Reset the flag when S key is released
            sKeyWasPressed = false;
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
            // Rotate left - turn camera/view to the left
            baseRotation += rotationSpeed;
            if (!isReversing) {
                targetRotation = baseRotation;
            }
            moving = true;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            // Rotate right - turn camera/view to the right
            baseRotation -= rotationSpeed;
            if (!isReversing) {
                targetRotation = baseRotation;
            }
            moving = true;
        }

        // Update target rotation based on reverse mode
        if (isReversing) {
            targetRotation = baseRotation + Math.PI; // Face backward
        } else {
            targetRotation = baseRotation; // Face forward
        }


        // Mobile joystick input
        if (joystickActive && (Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1)) {
            // Forward/backward movement
            const forwardAmount = -joystickVector.y;
            moveX += Math.sin(currentRotation) * speed * forwardAmount;
            moveZ += Math.cos(currentRotation) * speed * forwardAmount;

            // Left/right rotation and strafe
            const rightAmount = -joystickVector.x;
            targetRotation -= rotationSpeed * rightAmount;
            moveX += Math.sin(currentRotation + Math.PI / 2) * speed * rightAmount;
            moveZ += Math.cos(currentRotation + Math.PI / 2) * speed * rightAmount;

            moving = true;
        }

        // Smooth rotation - very slow interpolation for smooth, realistic body turning
        const rotationDiff = targetRotation - currentRotation;
        currentRotation += rotationDiff * 0.08; // Increased to 0.08 for smoother follow (not too slow, not too fast)
        model.rotation.y = currentRotation;

        // Apply movement
        if (moveX !== 0 || moveZ !== 0) {
            model.position.x += moveX;
            model.position.z += moveZ;
        }

        // Update position display in UI (relative to origin)
        const posXElement = document.getElementById('posX');
        const posYElement = document.getElementById('posY');
        const posZElement = document.getElementById('posZ');

        if (posXElement) posXElement.textContent = (model.position.x - originOffset.x).toFixed(2);
        if (posYElement) posYElement.textContent = (model.position.y - originOffset.y).toFixed(2);
        if (posZElement) posZElement.textContent = (model.position.z - originOffset.z).toFixed(2);

        if (moving) {
            isWalking = true;
            walkCycle += 0.15 * speedMultiplier;
            updateWalkAnimation();
        } else {
            if (isWalking) {
                isWalking = false;
                if (robotParts.leftLeg) robotParts.leftLeg.rotation.x *= 0.85;
                if (robotParts.rightLeg) robotParts.rightLeg.rotation.x *= 0.85;
                if (robotParts.leftArm) robotParts.leftArm.rotation.x *= 0.85;
                if (robotParts.rightArm) robotParts.rightArm.rotation.x *= 0.85;
            }
        }

        // Bow animation
        if (isBowing) {
            bowProgress += bowSpeed;

            if (bowProgress < 1.0) {
                const bowAngle = Math.sin(bowProgress * Math.PI) * 0.8;
                model.rotation.x = bowAngle;
            } else {
                model.rotation.x = 0;
                isBowing = false;
                bowProgress = 0;
            }
        }
    }

    // Jump physics
    if (model && isJumping) {
        model.position.y += jumpVelocity;
        jumpVelocity -= gravity;

        const groundLevel = -100; // Ground level at Y = -130
        if (model.position.y <= groundLevel) {
            model.position.y = groundLevel;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    // Mobile Legends style camera follow - camera stays behind robot
    if (model) {
        // Calculate camera position behind the robot based on its rotation
        const offset = cameraOffset.clone();
        // Rotate camera offset based on robot's current rotation
        // This makes camera follow from behind as robot rotates
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation);

        const targetCameraPosition = new THREE.Vector3(
            model.position.x + offset.x,
            model.position.y + offset.y,
            model.position.z + offset.z
        );

        // Smooth camera movement (lerp)
        camera.position.lerp(targetCameraPosition, 0.1);

        // Calculate look-at point in front of the robot based on its rotation
        // This makes the robot face its movement direction
        const lookAheadDistance = 10; // How far ahead to look
        const lookAtTarget = new THREE.Vector3(
            model.position.x - Math.sin(currentRotation) * lookAheadDistance,
            model.position.y + cameraLookAtOffset.y,
            model.position.z - Math.cos(currentRotation) * lookAheadDistance
        );
        camera.lookAt(lookAtTarget);
    }

    // Animate clouds
    clouds.forEach(cloud => {
        // Move clouds in their direction
        cloud.group.position.x += Math.cos(cloud.direction) * cloud.speed;
        cloud.group.position.z += Math.sin(cloud.direction) * cloud.speed;

        // Wrap clouds around when they go too far
        if (cloud.group.position.x > 600) cloud.group.position.x = -600;
        if (cloud.group.position.x < -600) cloud.group.position.x = 600;
        if (cloud.group.position.z > 600) cloud.group.position.z = -600;
        if (cloud.group.position.z < -600) cloud.group.position.z = 600;

        // Gentle floating motion
        cloud.group.position.y += Math.sin(Date.now() * 0.0005 + cloud.direction) * 0.05;
    });

    // Update teleportation effect
    updateTeleportEffect();

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});