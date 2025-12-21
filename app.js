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

// Auto-load robot.glb from model folder
window.addEventListener('load', function () {
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
    scene.add(model);

    targetRotation = Math.PI; // 180 degrees
    currentRotation = Math.PI; // 180 degrees

    populatePartLists();
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

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});