// Get doc elements
const damageCounter = document.getElementById('damageCounter');
const killCounter = document.getElementById('killCounter');
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
let damageTaken = 0;
let enemiesKilled = 0;
let damageCooldown = false; // Indicates if the player is in a cooldown period
let cooldownDuration = 1000; // 1 second cooldown

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
const maxEnemies = 3;
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

function drawCounters() {
  ctx.save(); // Save the current canvas state

  ctx.font = "20px 'Silkscreen', sans-serif";
  ctx.fillStyle = 'white'; // Text color
  
  ctx.fillText(`Damage Taken: ${damageTaken}`, 60, 40); // Positioned at the top-left
  ctx.fillText(`Enemies Killed: ${enemiesKilled}`, 60, 70); // Positioned below the damage counter

  ctx.restore(); // Restore the canvas state
}

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

    this.isDying = false;  // Is the enemy in the process of dying
    this.rotationAngle = 0;  // Tracks the current rotation
    this.jumpHeight = -10;  // Jump upwards by 10px when dying
    this.rotationSpeed = 720 / 100;  // Rotate 720 degrees over the animation (adjust this for speed)
  }

  // Update enemy position, apply gravity, and animate
  update() {
    if (this.isDying) {
      this.handleDeathAnimation();  // Handle death animation if the enemy is dying
      console.log(this.isDying)
    } else {
      // Regular update when the enemy is not dying
      this.dy += this.gravity;
      if (this.dy > this.maxFallSpeed) {
        this.dy = this.maxFallSpeed; // Cap the fall speed
      }
      this.y += this.dy;
      this.x += this.dx;
      this.checkWallCollision();
      this.checkPlatformCollision();
      this.checkFloorCollision();
      this.animate();
    }
  }

  // Death animation logic
  handleDeathAnimation() {
    // Rotate the enemy by increasing the angle
    this.rotationAngle += this.rotationSpeed;
  
    // Make the enemy jump up slightly and then fall down
    if (this.jumpHeight < 0) {
      this.y += this.jumpHeight;
      this.jumpHeight++;  // Reduce jump height each frame until it reaches 0
    } else {
      this.dy += this.gravity;  // Apply gravity after jumping
      this.y += this.dy;
    }
  
    // Remove the enemy once it falls off the screen
    if (this.y > canvas.height+400) {
      enemies = enemies.filter(e => e !== this);  // Remove enemy from the list
    }
  }

  // Check if the enemy hits the left or right boundary of the game world and change direction
  checkWallCollision() {
    const leftWallBoundary = 46; // Example wall at 46px from the left
    const rightWallBoundary = gameWorldWidth - 46; // Game world's right boundary
  
    // Prevent enemy from going off the left side of the game world
    if (this.x < leftWallBoundary) {
      this.x = leftWallBoundary; // Enemy stops exactly at the left wall
      this.dx = Math.abs(this.dx); // Change direction to the right
      this.facingLeft = false; // Now facing right
    }
  
    // Prevent enemy from going off the right side of the game world
    if (this.x + this.width > rightWallBoundary) {
      this.x = rightWallBoundary - this.width; // Stop at the right wall
      this.dx = -Math.abs(this.dx); // Change direction to the left
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

  // Draw the enemy, apply rotation if dying
  draw() {
    const scaledWidth = enemyWidth * enemyScaleFactor;
    const scaledHeight = enemyHeight * enemyScaleFactor;
  
    ctx.save(); // Save the current canvas state
  
    if (this.isDying) {
      // Apply rotation during death animation
      ctx.translate(this.x + scaledWidth / 2 - camera.x, this.y + scaledHeight / 2);
      ctx.rotate((this.rotationAngle * Math.PI) / 180);  // Rotate by the calculated angle
      ctx.translate(-(this.x + scaledWidth / 2 - camera.x), -(this.y + scaledHeight / 2));
      this.handleDeathAnimation()
      ctx.drawImage(
        enemySpriteSheet,
        this.currentFrame * enemyWidth, 0,
        enemyWidth, enemyHeight,
        this.x - camera.x, this.y,
        scaledWidth, scaledHeight
      );
    } else if (!this.facingLeft) {
      // Flip horizontally by scaling the context to -1 when moving right
      ctx.scale(-1, 1);
      ctx.drawImage(
        enemySpriteSheet,
        this.currentFrame * enemyWidth, 0,
        enemyWidth, enemyHeight,
        -(this.x + scaledWidth - camera.x), this.y,
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
  
    ctx.restore(); // Restore the canvas state (undo the flip and rotation)
  }
}

// Axis-Aligned Bounding Box (AABB) Collision Detection
function checkCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
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
    if (!enemy.isDying) {
      enemy.update();
    }
    enemy.draw();

    const playerRect = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height
    };

    const enemyRect = {
      x: enemy.x,
      y: enemy.y,
      width: enemy.width,
      height: enemy.height
    };

    // Check for collision between player and enemy
    if (checkCollision(playerRect, enemyRect)) {
      // Check if the player hits the enemy from above (kill the enemy)
      if (player.y + player.height <= enemy.y + enemy.height / 2 && !enemy.isDying) {
        enemy.isDying = true;  // Trigger death animation
        enemiesKilled++; // Increment the kill counter
        player.dy = -10; // Bounce the player upwards after killing the enemy
      } else if (!damageCooldown && !enemy.isDying) {
        // Take damage and push both player and enemy away from each other
        damageTaken--;
        activateCooldown();
        player.dy = -12;
        if (player.x < enemy.x) {
          player.dx = -4; // Push player left
          if(enemy.facingLeft){
            enemy.dx += 4;  // Push enemy slightly right
            enemy.facingLeft = false; // Enemy is now moving right
          }
          
        } else {
          player.dx = 4;  // Push player right
          if (!enemy.facingLeft){
            enemy.dx -= 4;  // Push enemy slightly left
            enemy.facingLeft = true; // Enemy is now moving left
          }
        }
      }
    }

    // Remove enemies if they fall off the screen
    if (enemy.isDying && enemy.y > canvas.height) {
      enemies.splice(index, 1);
    }

  });
}


function checkEnemyCollisions() {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const enemy1 = enemies[i];
      const enemy2 = enemies[j];

      // Check if enemy1 and enemy2 are colliding
      if (checkCollision(enemy1, enemy2)) {
        // Reverse direction for both enemies upon collision
        enemy1.dx = -enemy1.dx;
        enemy2.dx = -enemy2.dx;

        // Update facing direction based on the new dx
        enemy1.facingLeft = enemy1.dx < 0;
        enemy2.facingLeft = enemy2.dx < 0;
      }
    }
  }
}
function activateCooldown() {
  damageCooldown = true;
  setTimeout(() => {
    damageCooldown = false;
  }, cooldownDuration); // Cooldown for 1 second
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
  if (player.x < 46) player.x = 46;
  if (player.x + player.width > gameWorldWidth-66) player.x = gameWorldWidth - player.width-66;
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
  checkEnemyCollisions();
  checkBoundaries();
  updateCamera();
  requestAnimationFrame(update);
  updateInfoBubbleVisibility();

  spawnEnemy();
  updateEnemies();
  drawCounters();
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