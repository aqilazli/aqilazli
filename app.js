import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Setup DRACO loader for compressed models
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Grid
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

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
let targetRotation = (30 * Math.PI) / 180; // 30 degrees
let currentRotation = (30 * Math.PI) / 180;
let moveDirection = { forward: 0, right: 0 };
let speedMultiplier = 0.3;

// Jump variables
let isJumping = false;
let jumpVelocity = 0;
let gravity = 0.003;
let jumpStrength = 0.11;

let isBowing = false;
let bowProgress = 0;
let bowSpeed = 0.05;

// Auto-load robot.glb from model folder
window.addEventListener('load', function() {
    loader.load(
        './model/robot.glb',
        function(gltf) {
            loadModelFromGLTF(gltf);
            console.log('✓ Robot loaded successfully!');
        },
        function(xhr) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
            console.log(`Loading: ${percent}%`);
        },
        function(error) {
            console.error('Failed to load robot.glb:', error);
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
    const scale = 2 / maxDim;
    model.scale.set(scale, scale, scale);

    model.rotation.y = (30 * Math.PI) / 180; // 30 degrees
    model.position.set(0, 0, 0);
    scene.add(model);

    targetRotation = (30 * Math.PI) / 180;
    currentRotation = (30 * Math.PI) / 180;

    populatePartLists();
}

window.toggleMainPanel = function() {
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

window.toggleCategory = function(titleElement) {
    const partList = titleElement.nextElementSibling;
    titleElement.classList.toggle('collapsed');
    partList.classList.toggle('collapsed');
}

window.updateSpeed = function(value) {
    speedMultiplier = parseFloat(value);
    document.getElementById('speedValue').textContent = value + 'x';
}

window.testJump = function() {
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

window.testAnimation = function() {
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

window.resetParts = function() {
    robotParts = {
        leftLeg: null,
        rightLeg: null,
        leftArm: null,
        rightArm: null
    };
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
}

window.resetPosition = function() {
    if (model) {
        model.position.set(0, 0, 0);
        model.rotation.y = (30 * Math.PI) / 180;

        targetRotation = (30 * Math.PI) / 180;
        currentRotation = (30 * Math.PI) / 180;

        isJumping = false;
        jumpVelocity = 0;

        if (robotParts.leftLeg) robotParts.leftLeg.rotation.x = 0;
        if (robotParts.rightLeg) robotParts.rightLeg.rotation.x = 0;
        if (robotParts.leftArm) robotParts.leftArm.rotation.x = 0;
        if (robotParts.rightArm) robotParts.rightArm.rotation.x = 0;

        walkCycle = 0;
        isWalking = false;

        console.log('Robot position reset to center');
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
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

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
        const baseSpeed = 0.05;
        const speed = baseSpeed * speedMultiplier;
        const rotationSpeed = 0.08 * speedMultiplier;
        let moving = false;

        moveDirection = { forward: 0, right: 0 };

        if (keys['ArrowUp'] || keys['KeyW']) {
            moveDirection.forward = 1;
            moving = true;
        }
        if (keys['ArrowDown'] || keys['KeyS']) {
            moveDirection.forward = -1;
            moving = true;
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
            moveDirection.right = 1;
            moving = true;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            moveDirection.right = -1;
            moving = true;
        }

        // Mobile joystick input
        if (joystickActive && (Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1)) {
            // Forward/backward movement
            moveDirection.forward = -joystickVector.y;
            // Left/right rotation
            moveDirection.right = -joystickVector.x;
            moving = true;
        }

        if (moveDirection.right !== 0) {
            targetRotation += rotationSpeed * moveDirection.right;
        }

        const rotationDiff = targetRotation - currentRotation;
        currentRotation += rotationDiff * 0.15;
        model.rotation.y = currentRotation;

        if (moveDirection.forward !== 0) {
            const moveX = Math.sin(currentRotation) * speed * moveDirection.forward;
            const moveZ = Math.cos(currentRotation) * speed * moveDirection.forward;

            model.position.x += moveX;
            model.position.z += moveZ;
        }

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

        if (model.position.y <= 0) {
            model.position.y = 0;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});