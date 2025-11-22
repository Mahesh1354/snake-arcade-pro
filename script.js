// ----- Configuration -----
const CELL_SIZE =
  parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--cell-size")
  ) || 28;
const COLS =
  parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--cols")
  ) || 20;
const ROWS =
  parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--rows")
  ) || 16;

// ----- Elements -----
const board = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const soundBtn = document.getElementById("soundBtn");
const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("high-score");
const timeDisplay = document.getElementById("time");
const levelDisplay = document.getElementById("level");
const gameOverModal = document.getElementById("gameOverModal");
const finalScore = document.getElementById("finalScore");
const tryAgain = document.getElementById("tryAgain");
const closeModal = document.getElementById("closeModal");

// ----- Game State -----
let blocks = {};
let snake = [];
let direction = "right";
let nextDirection = "right";
let food = null;
let intervalId = null;
let tickMs = 220; // base speed (ms)
let running = false;
let paused = false;
let score = 0;
let highScore = Number(localStorage.getItem("snakeHigh") || 0);
let secondsPlayed = 0;
let timerInterval = null;
let soundOn = true;
let level = 1;

highScoreDisplay.textContent = highScore;

// ----- Audio (WebAudio simple sounds) -----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;

function beep(freq = 440, duration = 0.08, type = "sine", gain = 0.06) {
  if (!audioCtx || !soundOn) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

// ----- Board Creation -----
function createBoard() {
  board.innerHTML = "";
  blocks = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      board.appendChild(cell);
      blocks[`${r}-${c}`] = cell;
    }
  }
}

// ----- Helpers -----
function randCell() {
  return {
    x: Math.floor(Math.random() * ROWS),
    y: Math.floor(Math.random() * COLS),
  };
}

function cellIsOnSnake(pos) {
  return snake.some((s) => s.x === pos.x && s.y === pos.y);
}

function placeFood() {
  let pos;
  let tries = 0;
  do {
    pos = randCell();
    tries++;
  } while (cellIsOnSnake(pos) && tries < 500);
  food = pos;
}

function draw() {
  // clear
  for (let key in blocks) {
    blocks[key].classList.remove("fill", "head", "food");
  }
  // food
  if (food) blocks[`${food.x}-${food.y}`]?.classList.add("food");
  // snake
  snake.forEach((seg, i) => {
    const el = blocks[`${seg.x}-${seg.y}`];
    if (el) el.classList.add("fill");
    if (i === 0 && el) el.classList.add("head");
  });
}

function updateScoreDisplay() {
  const el = scoreDisplay.querySelector(".score-anim");
  el.textContent = score;
  el.classList.add("pop");
  setTimeout(() => el.classList.remove("pop"), 160);
}

function updateTime() {
  secondsPlayed++;
  const m = Math.floor(secondsPlayed / 60)
    .toString()
    .padStart(2, "0");
  const s = (secondsPlayed % 60).toString().padStart(2, "0");
  timeDisplay.textContent = `${m}:${s}`;
}

// ----- Game Mechanics -----
function resetState() {
  clearInterval(intervalId);
  intervalId = null;
  clearInterval(timerInterval);
  timerInterval = null;
  running = false;
  paused = false;
  score = 0;
  secondsPlayed = 0;
  level = 1;
  tickMs = 220;
  direction = "right";
  nextDirection = "right";
  snake = [
    { x: Math.floor(ROWS / 2), y: Math.floor(COLS / 2) },
    { x: Math.floor(ROWS / 2), y: Math.floor(COLS / 2) - 1 },
  ];
  placeFood();
  updateScoreDisplay();
  timeDisplay.textContent = "00:00";
  levelDisplay.textContent = level;
  draw();
}

function startGame() {
  if (!audioCtx || audioCtx.state === "suspended") {
    try {
      audioCtx.resume();
    } catch (e) {}
  }
  if (running) return;
  running = true;
  paused = false;
  clearInterval(intervalId);
  intervalId = setInterval(tick, tickMs);
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTime, 1000);
}

function pauseGame() {
  if (!running) return;
  if (paused) {
    // resume
    intervalId = setInterval(tick, tickMs);
    timerInterval = setInterval(updateTime, 1000);
    paused = false;
    pauseBtn.textContent = "Pause";
  } else {
    // pause
    clearInterval(intervalId);
    intervalId = null;
    clearInterval(timerInterval);
    timerInterval = null;
    paused = true;
    pauseBtn.textContent = "Resume";
  }
}

function changeSpeedForLevel(newLevel) {
  level = newLevel;
  levelDisplay.textContent = level;
  // reduce tickMs by 15ms per level but keep min 60ms
  tickMs = Math.max(60, 220 - (level - 1) * 15);
  if (running && !paused) {
    clearInterval(intervalId);
    intervalId = setInterval(tick, tickMs);
  }
}

function gameOver() {
  running = false;
  paused = false;
  clearInterval(intervalId);
  intervalId = null;
  clearInterval(timerInterval);
  timerInterval = null;
  finalScore.textContent = score;
  gameOverModal.style.display = "flex";
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("snakeHigh", highScore);
    highScoreDisplay.textContent = highScore;
  }
  beep(150, 0.25, "sawtooth", 0.12);
}

function tick() {
  // compute new head
  const head = { ...snake[0] };
  direction = nextDirection; // apply queued direction
  if (direction === "left") head.y--;
  else if (direction === "right") head.y++;
  else if (direction === "up") head.x--;
  else if (direction === "down") head.x++;

  // wall collision
  if (head.x < 0 || head.x >= ROWS || head.y < 0 || head.y >= COLS) {
    gameOver();
    return;
  }
  // self collision
  if (cellIsOnSnake(head)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  // food collision
  if (food && head.x === food.x && head.y === food.y) {
    score += 10;
    updateScoreDisplay();
    beep(900, 0.06, "sine", 0.07);
    placeFood();
    // level up every 50 points
    const newLevel = Math.floor(score / 50) + 1;
    if (newLevel !== level) changeSpeedForLevel(newLevel);
  } else {
    snake.pop();
  }

  draw();
}

// ----- Controls -----
addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "ArrowLeft" && direction !== "right") nextDirection = "left";
  else if (k === "ArrowRight" && direction !== "left") nextDirection = "right";
  else if (k === "ArrowUp" && direction !== "down") nextDirection = "up";
  else if (k === "ArrowDown" && direction !== "up") nextDirection = "down";
  else if (k === " ") {
    // space toggles pause
    pauseGame();
  }
});

startBtn.addEventListener("click", () => {
  gameOverModal.style.display = "none";
  startGame();
});

pauseBtn.addEventListener("click", pauseGame);

resetBtn.addEventListener("click", () => {
  gameOverModal.style.display = "none";
  resetState();
});

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊 Sound: On" : "🔈 Sound: Off";
  if (soundOn) beep(700, 0.04);
});

tryAgain.addEventListener("click", () => {
  gameOverModal.style.display = "none";
  resetState();
  startGame();
});

closeModal.addEventListener("click", () => {
  gameOverModal.style.display = "none";
});

// ----- Init -----
createBoard();
resetState();

// expose some helpers for debugging in console (optional)
window.snakeGame = {
  resetState,
  startGame,
  pauseGame,
  gameOver,
  placeFood,
  snake,
};