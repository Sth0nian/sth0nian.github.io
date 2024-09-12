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
const enemySpriteSheet = new Image();
enemySpriteSheet.src = './enemy.png';

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

// List to store enemies
let enemies = [];

// Enemy properties
const enemyWidth = 13;
const enemyHeight = 24;
const enemyScaleFactor = 5.5; // Adjust scale of the enemy
const maxEnemies = 5;
let enemySpawnInterval = 10000; // Spawn an enemy every 10 seconds
let lastEnemySpawnTime = 0;

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

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = enemyWidth * enemyScaleFactor;
    this.height = enemyHeight * enemyScaleFactor;
    this.dx = -2; // Start moving left
    this.dy = 0; // Vertical speed
    this.gravity = 0.5; // Gravity
    this.maxFallSpeed = 10; // Limit the fall speed
    this.currentFrame = 0; // For animation
    this.frameCount = 0;
    this.frameDelay = 10; // Animation speed
    this.jumping = false; // Detect if the enemy is in the air
    this.facingLeft = true; // Initially, the enemy is moving left
  }

  // Update enemy position, apply gravity, and animate
  update() {
    // Apply gravity
    this.dy += this.gravity;
    if (this.dy > this.maxFallSpeed) {
      this.dy = this.maxFallSpeed; // Cap the fall speed
    }
    this.y += this.dy;

    // Update position horizontally
    this.x += this.dx;

    // Check if enemy hits walls and change direction
    this.checkWallCollision();

    // Check for platform or floor collisions
    this.checkPlatformCollision();
    this.checkFloorCollision(); // Check for the floor

    // Animate the enemy
    this.animate();
  }

  // Check if the enemy hits the left or right boundary and change direction
  checkWallCollision() {
    if (this.x <= 0) {
      this.x = 0;
      this.dx = 2; // Change direction to right
      this.facingLeft = false; // Now moving right, so not facing left
    } else if (this.x + this.width >= gameWorldWidth) {
      this.x = gameWorldWidth - this.width;
      this.dx = -2; // Change direction to left
      this.facingLeft = true; // Now facing left
    }
  }

  // Check if the enemy is standing on a platform
  checkPlatformCollision() {
    let onPlatform = false;
    platforms.forEach(platform => {
      const detectionBuffer = 10;
      if (
        this.x < platform.x + platform.width &&
        this.x + this.width > platform.x &&
        this.y + this.height > platform.y - detectionBuffer &&
        this.y + this.height < platform.y + platform.height
      ) {
        this.jumping = false;
        this.dy = 0; // Stop falling
        this.y = platform.y - this.height; // Place enemy on platform
        onPlatform = true;
      }
    });

    // If not on a platform, the enemy is falling
    if (!onPlatform) {
      this.jumping = true;
    }
  }

  // Check if the enemy has hit the floor
  checkFloorCollision() {
    const floorY = canvas.height - 50; // Assuming this is the floor's y position
    if (this.y + this.height > floorY) {
      this.y = floorY - this.height; // Place enemy on the floor
      this.dy = 0; // Stop vertical movement (falling)
      this.jumping = false; // Enemy is on the ground
    }
  }

  // Animate the enemy with two frames
  animate() {
    this.frameCount++;
    if (this.frameCount >= this.frameDelay) {
      this.currentFrame = (this.currentFrame + 1) % 2; // Toggle between frame 0 and frame 1
      this.frameCount = 0;
    }
  }

  // Draw the enemy, and flip it if moving right
  draw() {
    const scaledWidth = enemyWidth * enemyScaleFactor;
    const scaledHeight = enemyHeight * enemyScaleFactor;

    ctx.save(); // Save the current canvas state

    if (!this.facingLeft) {
      // Flip horizontally by scaling the context to -1 when moving right
      ctx.scale(-1, 1);
      // Draw the enemy flipped horizontally (adjust the x position accordingly)
      ctx.drawImage(
        enemySpriteSheet, 
        this.currentFrame * enemyWidth, 0, 
        enemyWidth, enemyHeight, 
        -(this.x + scaledWidth - camera.x), this.y, // Negate x position for flip
        scaledWidth, scaledHeight
      );
    } else {
      // Draw normally if facing left
      ctx.drawImage(
        enemySpriteSheet, 
        this.currentFrame * enemyWidth, 0, 
        enemyWidth, enemyHeight, 
        this.x - camera.x, this.y, 
        scaledWidth, scaledHeight
      );
    }

    ctx.restore(); // Restore the canvas state (undo the flip)
  }
}

function spawnEnemy() {
  const currentTime = Date.now();
  
  if (enemies.length < maxEnemies && currentTime - lastEnemySpawnTime > enemySpawnInterval) {
    // Spawn an enemy closer to the visible canvas and lower on the map
    enemies.push(new Enemy(player.x + 400, 350)); // Adjust y = 350 and x relative to player
    lastEnemySpawnTime = currentTime;
  }
}


function updateEnemies() {
  enemies.forEach((enemy, index) => {
    enemy.update();
    enemy.draw();

    // Remove enemies if they fall out of the world or move off the screen to the left
    if (enemy.y > canvas.height || enemy.x + enemy.width < 0) {
      enemies.splice(index, 1);
    }
  });
}


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

  spawnEnemy();
  updateEnemies();
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
