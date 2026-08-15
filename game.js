const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const healthElement = document.getElementById("health");
const messageElement = document.getElementById("message");

let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;

let mouseX = 0;
let mouseY = 0;

let score = 0;
let health = 5;
let enemies = [];
let powerUps = [];

let running = false;
let gameOver = false;
let lastTime = 0;
let spawnTimer = 0;
let spawnDelay = 900;
let shieldBoostEndTime = 0;

const coreRadius = 25;

const shieldRadius = 105;
const shieldArcSize = Math.PI / 2.8;
const shieldThickness = 12;

const maxEnemies = 10;

const powerUpRadius = 14;
const powerUpDuration = 10000;
const shieldBoostMultiplier = 1.2;
const powerUpChance = 0.04;
const powerUpColor = "#B6FF00";

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;

  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  centerX = width / 2;
  centerY = height / 2;

  if (mouseX === 0 && mouseY === 0) {
    mouseX = centerX;
    mouseY = centerY - shieldRadius;
  }
}

function normalizeAngle(angle) {
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }

  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }

  return angle;
}

function isAngleInsideArc(angle, startAngle, endAngle) {
  const relativeAngle = normalizeAngle(angle - startAngle);
  const arcLength = normalizeAngle(endAngle - startAngle);

  return relativeAngle >= 0 && relativeAngle <= arcLength;
}

function getShield() {
  const angle = Math.atan2(mouseY - centerY, mouseX - centerX);

  const isShieldBoosted = performance.now() < shieldBoostEndTime;

  const currentArcSize = isShieldBoosted
    ? shieldArcSize * shieldBoostMultiplier
    : shieldArcSize;

  return {
    angle,
    startAngle: angle - currentArcSize / 2,
    endAngle: angle + currentArcSize / 2,
    arcSize: currentArcSize
  };
}

function spawnPowerUp() {
  if (powerUps.length > 0) {
    return;
  }

  // It appears on the same circular orbit as the shield.
  const angle = Math.random() * Math.PI * 2;

  powerUps.push({
    x: centerX + Math.cos(angle) * shieldRadius,
    y: centerY + Math.sin(angle) * shieldRadius,
    radius: powerUpRadius
  });
}

function spawnEnemy() {
  // Test setting: make this 0.04 once you confirm power-ups work.
  if (Math.random() < 0.25) {
    spawnPowerUp();
    return;
  }

  const sides = [0, 1, 2, 3];

  const safeSides = sides.filter((side) => {
    return !enemies.some((enemy) => {
      const enemyDistanceFromCore = Math.hypot(
        enemy.x - centerX,
        enemy.y - centerY
      );

      if (enemyDistanceFromCore > 280) {
        return false;
      }

      const oppositeSide =
        enemy.spawnSide === 0 ? 2 :
        enemy.spawnSide === 1 ? 3 :
        enemy.spawnSide === 2 ? 0 : 1;

      return side === oppositeSide;
    });
  });

  const availableSides = safeSides.length > 0 ? safeSides : sides;
  const side = availableSides[Math.floor(Math.random() * availableSides.length)];

  let x;
  let y;

  if (side === 0) {
    x = Math.random() * width;
    y = -30;
  } else if (side === 1) {
    x = width + 30;
    y = Math.random() * height;
  } else if (side === 2) {
    x = Math.random() * width;
    y = height + 30;
  } else {
    x = -30;
    y = Math.random() * height;
  }

  const baseSpeed = 72 + Math.min(score * 1.7, 153);
  const speedVariation = Math.random() * 20 - 10;
  const speed = baseSpeed + speedVariation;

  const direction = Math.atan2(centerY - y, centerX - x);

  enemies.push({
    x,
    y,
    radius: 10,
    velocityX: Math.cos(direction) * speed,
    velocityY: Math.sin(direction) * speed,
    spawnSide: side
  });
}

function update(deltaTime) {
  spawnTimer += deltaTime;

  if (spawnTimer >= spawnDelay) {
    if (enemies.length < maxEnemies) {
      spawnEnemy();
    }

    spawnTimer = 0;
    spawnDelay = Math.max(260, 900 - score * 12);
  }

  const shield = getShield();

  // Collect a power-up when it is covered by any part of the curved shield.
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];

    const powerUpAngle = Math.atan2(
      powerUp.y - centerY,
      powerUp.x - centerX
    );

    const powerUpDistance = Math.hypot(
      powerUp.x - centerX,
      powerUp.y - centerY
    );

    const isOnShieldArc = isAngleInsideArc(
      powerUpAngle,
      shield.startAngle,
      shield.endAngle
    );

    const isAtShieldDistance =
      Math.abs(powerUpDistance - shieldRadius) <
      powerUp.radius + shieldThickness / 2;

    if (isOnShieldArc && isAtShieldDistance) {
      powerUps.splice(i, 1);
      shieldBoostEndTime = performance.now() + powerUpDuration;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    enemy.x += enemy.velocityX * deltaTime / 1000;
    enemy.y += enemy.velocityY * deltaTime / 1000;

    const enemyAngle = Math.atan2(
      enemy.y - centerY,
      enemy.x - centerX
    );

    const enemyDistanceFromCore = Math.hypot(
      enemy.x - centerX,
      enemy.y - centerY
    );

    const isOnShieldArc = isAngleInsideArc(
      enemyAngle,
      shield.startAngle,
      shield.endAngle
    );

    const isAtShieldDistance =
      Math.abs(enemyDistanceFromCore - shieldRadius) <
      enemy.radius + shieldThickness / 2;

    if (isOnShieldArc && isAtShieldDistance) {
      enemies.splice(i, 1);
      score++;
      scoreElement.textContent = score;
      continue;
    }

    if (enemyDistanceFromCore < coreRadius + enemy.radius) {
      enemies.splice(i, 1);
      health--;
      healthElement.textContent = health;

      if (health <= 0) {
        endGame();
      }
    }
  }
}

function drawCore() {
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius + 10, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawShield() {
  const shield = getShield();

  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    shieldRadius,
    shield.startAngle,
    shield.endAngle
  );

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = shieldThickness;
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawPowerUps() {
  for (const powerUp of powerUps) {
    ctx.beginPath();
    ctx.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2);
    ctx.strokeStyle = powerUpColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(powerUp.x - 7, powerUp.y);
    ctx.lineTo(powerUp.x + 7, powerUp.y);
    ctx.moveTo(powerUp.x, powerUp.y - 7);
    ctx.lineTo(powerUp.x, powerUp.y + 7);
    ctx.strokeStyle = powerUpColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
}

function drawMouseMarker() {
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  if (running) {
    drawCore();
    drawShield();
    drawPowerUps();
    drawEnemies();
    drawMouseMarker();
  }
}

function gameLoop(timestamp) {
  if (!running) {
    return;
  }

  const deltaTime = Math.min(timestamp - lastTime, 50);
  lastTime = timestamp;

  update(deltaTime);
  draw();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  score = 0;
  health = 5;
  enemies = [];
  powerUps = [];
  spawnTimer = 0;
  spawnDelay = 900;
  shieldBoostEndTime = 0;
  running = true;
  gameOver = false;

  scoreElement.textContent = score;
  healthElement.textContent = health;
  messageElement.style.display = "none";

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  gameOver = true;

  messageElement.innerHTML = `
    Game Over<br>
    Final score: ${score}<br><br>
    Click to play again.
  `;

  messageElement.style.display = "block";
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("mousemove", (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

window.addEventListener("click", () => {
  if (!running || gameOver) {
    startGame();
  }
});

resizeCanvas();
draw();

//What does the player do? Protect a "core" in the center of the screen from projectiles, with a shield they control with the mouse. 
//What is trying to stop them? "Balls" spawn from the edge of the screen, which the player must block with the shield.
//What does it feel like when they lose? It may feel unfair since they come from all areas of the screen.