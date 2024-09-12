// Get doc elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const infoBubble = document.getElementById('infoBubble');

// Import images
const playerSpriteSheet = new Image();
playerSpriteSheet.src = './player.png';
const grassTexture = new Image();
grassTexture.src = './floor.png';
const stoneTexture = new Image();
stoneTexture.src = './wall.png';

// Canvas / graphics vars
canvas.width = 1200;
canvas.height = 800;
const spriteWidth = 13;
const spriteHeight = 22;
const scaleFactor = 5.8;
let facingLeft = false;
const stars = [];

// Player object
let player = {
  x: 100 + 50 - 25,
  y: 40 - 70,
  width: 50,
  height: 120,
  dx: 0,
  dy: 0,
  maxSpeed: 5,
  acceleration: 0.2,
  friction: 0.1,
  gravity: 0.5,
  jumping: false,
  jumpCount: 0,
  maxJumps: 2
};

// Camera object
let camera = {
  x: 0, // Start at the left of the world
  width: canvas.width, // The width of the camera (same as the canvas)
  height: canvas.height
};

// Expanded game world width (three times the canvas width)
const gameWorldWidth = canvas.width * 3;

// Inputs and animation vars
let currentFrame = 0;
let frameCount = 0;
const frameDelay = 5;
let keys = {};
let walkCycleTime = 0;
let platforms = [];
let kingHoPlatform = null;
let time = 0;

// Change the position of the King platform
function updateKingHoPlatform() {
  const amplitude = 140;
  const speed = 0.02;
  if (kingHoPlatform) {
    kingHoPlatform.y = 280 + Math.sin(time) * amplitude;
  }
  time += speed;
}

async function loadPlatforms() {
  const response = await fetch('platforms.json');
  platforms = await response.json();
}

// Draw the player sprite
function drawPlayer() {
  let frameX = 0;
  if (player.dx !== 0) {
    frameX = currentFrame * spriteWidth;
    frameCount++;
    if (frameCount >= frameDelay) {
      currentFrame = (currentFrame + 1) % 3;
      frameCount = 0;
    }
  } else {
    frameX = 3 * spriteWidth;
  }
  ctx.save();
  const scaledWidth = spriteWidth * scaleFactor;
  const scaledHeight = spriteHeight * scaleFactor;
  if (facingLeft) {
    ctx.scale(-1, 1);
    ctx.drawImage(
      playerSpriteSheet,
      frameX, 0, spriteWidth, spriteHeight,
      -player.x - scaledWidth + camera.x, player.y,
      scaledWidth, scaledHeight
    );
  } else {
    ctx.drawImage(
      playerSpriteSheet,
      frameX, 0, spriteWidth, spriteHeight,
      player.x - camera.x, player.y,
      scaledWidth, scaledHeight
    );
  }
  ctx.restore();
}

// Capture and remove default functionality on inputs
function handleInteraction(event) {
  event.preventDefault();
  let mouseX, mouseY;
  const rect = canvas.getBoundingClientRect();
  if (event.type === 'click') {
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  if (event.type === 'touchstart') {
    const touch = event.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
  }
  platforms.forEach(platform => {
    if (
      mouseX >= platform.x - camera.x &&
      mouseX <= platform.x + platform.width - camera.x &&
      mouseY >= platform.y &&
      mouseY <= platform.y + platform.height
    ) {
      player.x = platform.x + platform.width / 2 - player.width / 2;
      player.y = platform.y - player.height;
      player.dx = 0;
      player.dy = 0;
    }
  });
}

// Platforms drawing
function drawPlatforms() {
  ctx.font = "bold 22px 'Silkscreen', sans-serif";
  platforms.forEach(platform => {
    const tileWidth = 42;
    for (let x = platform.x - camera.x; x < platform.x - camera.x + platform.width; x += tileWidth) {
      ctx.drawImage(grassTexture, x, platform.y, tileWidth, platform.height);
    }
    ctx.fillStyle = 'white';
    const textX = platform.x + 5 - camera.x;
    const textY = platform.y + 54;
    ctx.fillText(platform.label, textX, textY);
  });
}

// Background color transition
function calculateBackgroundColor() {
  const percentage = player.x / gameWorldWidth;
  const skyBlue = { r: 135, g: 206, b: 235 };
  const lighterDarkBlue = { r: 25, g: 25, b: 112 };
  const r = Math.round(skyBlue.r + (lighterDarkBlue.r - skyBlue.r) * percentage);
  const g = Math.round(skyBlue.g + (lighterDarkBlue.g - skyBlue.g) * percentage);
  const b = Math.round(skyBlue.b + (lighterDarkBlue.b - skyBlue.b) * percentage);
  return `rgb(${r}, ${g}, ${b})`;
}

// Render the background and stars
function drawBackground() {
  const backgroundColor = calculateBackgroundColor();
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  document.body.style.backgroundColor = backgroundColor;
  drawStars();
}

// Generate stars in the background
function generateStars() {
  const numStars = 50;
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * gameWorldWidth,
      y: Math.random() * (canvas.height / 2),
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.04 + 0.01
    });
  }
}

// Draw stars that move slightly opposite the player's movement
function drawStars() {
  ctx.fillStyle = 'rgb(135, 206, 235)';
  stars.forEach(star => {
    star.x -= player.dx * star.speed;
    if (star.x > gameWorldWidth) star.x = 0;
    if (star.x < 0) star.x = gameWorldWidth;
    if (star.x - camera.x >= 0 && star.x - camera.x <= canvas.width) {
      ctx.beginPath();
      ctx.arc(star.x - camera.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Prevent the player from moving out of bounds
function checkBoundaries() {
  if (player.y + player.height > canvas.height - 50) {
    player.y = canvas.height - player.height - 50;
    player.jumping = false;
    player.dy = 0;
    player.jumpCount = 0;
  }
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > gameWorldWidth) player.x = gameWorldWidth - player.width;
  if (player.y < 0) {
    player.y = 0;
    player.dy = 0;
  }
}

// Draw the floor and walls
function drawBoundaries() {
  const floorTileWidth = 42;
  const floorY = canvas.height - 50;
  for (let x = 0; x < gameWorldWidth; x += floorTileWidth) {
    if (x - camera.x >= 0 && x - camera.x <= canvas.width) {
      ctx.drawImage(grassTexture, x - camera.x, floorY, floorTileWidth, 50);
    }
  }
  const wallTileWidth = 46;
  const wallTileHeight = 37;
  for (let y = 0; y < canvas.height; y += wallTileHeight) {
    ctx.drawImage(stoneTexture, 0 - camera.x, y, wallTileWidth, wallTileHeight);
    ctx.drawImage(stoneTexture, gameWorldWidth - wallTileWidth - camera.x, y, wallTileWidth, wallTileHeight);
  }
}

// Check for collisions with platforms
function checkPlatformCollision() {
  let onPlatform = false;
  platforms.forEach(platform => {
    const detectionBuffer = 10;
    if (
      player.x < platform.x + platform.width &&
      player.x + player.width > platform.x &&
      player.y + player.height > platform.y - detectionBuffer &&
      player.y + player.height < platform.y + platform.height
    ) {
      player.jumping = false;
      player.dy = 0;
      player.y = platform.y - player.height;
      player.jumpCount = 0;
      onPlatform = true;
      showInfoBubble(platform.info);
    }
  });
  if (!onPlatform) {
    clearInfoBubble();
  }
}

// Show the information bubble under the canvas
function showInfoBubble(text) {
  const canvasRect = canvas.getBoundingClientRect();
  infoBubble.style.left = `${canvasRect.left}px`;
  infoBubble.style.top = `${canvasRect.bottom + 20}px`;
  infoBubble.innerHTML = text;
  infoBubble.style.display = 'block';
}

// Clear the information bubble
function clearInfoBubble() {
  infoBubble.innerHTML = 'Use "A", "D" and "Spacebar" to move around the map. Double jump and explore!';
}

// Update the player's movement and input
function updatePlayerMovement() {
  if (keys['a']) {
    if (player.dx > -player.maxSpeed) {
      player.dx -= player.acceleration;
    }
  } else if (keys['d']) {
    if (player.dx < player.maxSpeed) {
      player.dx += player.acceleration;
    }
  } else {
    if (player.dx > 0) {
      player.dx -= player.friction;
      if (player.dx < 0) player.dx = 0;
    } else if (player.dx < 0) {
      player.dx += player.friction;
      if (player.dx > 0) player.dx = 0;
    }
  }
}

// Update the camera to follow the player
function updateCamera() {
  const centerScreen = canvas.width / 2;

  if (player.x > centerScreen) {
    camera.x = player.x - centerScreen;
  }

  camera.x = Math.max(0, Math.min(camera.x, gameWorldWidth - canvas.width));
}

// Main game update loop
function update() {
  updateKingHoPlatform();
  drawBackground();
  drawBoundaries();
  drawPlayer();
  drawPlatforms();
  player.x += player.dx;
  player.y += player.dy;
  player.dy += player.gravity;
  updatePlayerMovement();
  checkPlatformCollision();
  checkBoundaries();
  updateCamera();
  requestAnimationFrame(update);
  updateInfoBubbleVisibility();
}

// Handle keyboard input
function keyDown(e) {
  keys[e.key] = true;
  if (keys['a']) facingLeft = true;
  if (keys['d']) facingLeft = false;
  if (keys[' '] && player.jumpCount < player.maxJumps) {
    player.dy = -15;
    player.jumping = true;
    player.jumpCount++;
  }
}

function keyUp(e) {
  keys[e.key] = false;
}

// Update the visibility of the info bubble
function updateInfoBubbleVisibility() {
  if (window.innerWidth < 1032) {
    infoBubble.style.display = 'none';
  } else {
    infoBubble.style.display = 'block';
  }
}

// Load platforms and start the game loop
function loadPlatformsAndStart() {
  generateStars();
  loadPlatforms().then(() => {
    kingHoPlatform = platforms.find(platform => platform.label === 'King Ho');
    update();
  });
}

// Add event listeners
canvas.addEventListener('click', handleInteraction);
canvas.addEventListener('touchstart', handleInteraction);
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
window.addEventListener('keydown', function(e) {
  if (e.keyCode == 32 && e.target == document.body) {
    e.preventDefault();
  }
});
window.addEventListener('resize', updateInfoBubbleVisibility);

// Start the game
loadPlatformsAndStart();
