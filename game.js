// Инициализация переменных
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;
const FPS = 60;
const players = [
    {pos: [width / 4, height / 2], angle: 0, speed: 2, health: 3, color: 'red', cooldown: 0, hitTimer: 0}
];
const otherPlayer = {
    pos: [3 * width / 4, height / 2],
    angle: 0,
    speed: 2,
    health: 3,
    color: 'blue',
    cooldown: 0,
    hitTimer: 0
};
const controls = [
    {left: 'a', right: 'd', up: 'w', down: 's', turnLeft: 'q', turnRight: 'e', shoot: ' '}
];
const angleSpeed = 0.05;
const numRays = 120;
const viewAngle = Math.PI / 3;
const maxDistance = 300;
const cooldownTime = 2000;
const hitTime = 1000;
const obstacles = [
    {x: 0, y: 0, w: width, h: 10},
    {x: 0, y: height - 10, w: width, h: 10},
    {x: 0, y: 0, w: 10, h: height},
    {x: width - 10, y: 0, w: 10, h: height},
    {x: 100, y: 100, w: 50, h: 50},
    {x: 300, y: 200, w: 60, h: 60},
    {x: 150, y: 300, w: 40, h: 40},
    {x: 500, y: 150, w: 70, h: 70},
    {x: 600, y: 300, w: 40, h: 40}
];

// Соединение с сервером
const socket = new WebSocket('ws://eliseifox.github.io/new-dostup-s');

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    otherPlayer.pos = data.pos;
    otherPlayer.angle = data.angle;
    otherPlayer.health = data.health;
    otherPlayer.cooldown = data.cooldown;
    otherPlayer.hitTimer = data.hitTimer;
};

function sendData() {
    const data = JSON.stringify({
        pos: players[0].pos,
        angle: players[0].angle,
        health: players[0].health,
        cooldown: players[0].cooldown,
        hitTimer: players[0].hitTimer,
    });
    socket.send(data);
}

function rayCasting(playerPos, angle, players, playerIndex) {
    let x = playerPos[0];
    let y = playerPos[1];
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    for (let distance = 0; distance < maxDistance; distance += 5) {
        x += dx * 5;
        y += dy * 5;
        for (let rect of obstacles) {
            if (rect.x <= x && x <= rect.x + rect.w && rect.y <= y && y <= rect.y + rect.h) {
                return [distance, false, null];
            }
        }
        for (let i = 0; i < players.length; i++) {
            if (i !== playerIndex) {
                const px = players[i].pos[0];
                const py = players[i].pos[1];
                if (px - 5 <= x && x <= px + 5 && py - 5 <= y && y <= py + 5) {
                    return [distance, false, players[i].color];
                }
            }
        }
    }
    return [maxDistance, false, null];
}

function draw3DProjection(ctx, player, obstacles, players, playerIndex) {
    const currentTime = Date.now();
    for (let ray = 0; ray < numRays; ray++) {
        const rayAngle = player.angle - viewAngle / 2 + viewAngle * ray / numRays;
        const [distance, isCorner, playerColor] = rayCasting(player.pos, rayAngle, players, playerIndex);
        const wallHeight = height * (1 - Math.sqrt(distance / maxDistance));
        let shade = 255 - Math.floor(distance * 255 / maxDistance);
        let wallColor = isCorner ? 'yellow' : `rgb(${shade},${shade},${shade})`;
        if (playerColor) {
            wallColor = playerColor;
        }
        ctx.fillStyle = wallColor;
        ctx.fillRect(ray * (width / numRays), height / 2 - wallHeight / 2, width / numRays, wallHeight);
    }
}

function drawHealth(ctx, player) {
    ctx.fillStyle = 'white';
    ctx.font = '36px Arial';
    ctx.fillText(`Health: ${player.health}`, 10, 40);
}

function update() {
    const currentTime = Date.now();
    players.forEach((player, i) => {
        const control = controls[i];
        const keys = {};
        document.onkeydown = (e) => keys[e.key] = true;
        document.onkeyup = (e) => keys[e.key] = false;

        let direction = [0, 0];
        if (keys[control.up]) {
            direction[0] += Math.cos(player.angle);
            direction[1] += Math.sin(player.angle);
        }
        if (keys[control.down]) {
            direction[0] -= Math.cos(player.angle);
            direction[1] -= Math.sin(player.angle);
        }
        if (keys[control.left]) {
            direction[0] += Math.sin(player.angle);
            direction[1] -= Math.cos(player.angle);
        }
        if (keys[control.right]) {
            direction[0] -= Math.sin(player.angle);
            direction[1] += Math.cos(player.angle);
        }
        if (keys[control.turnLeft]) {
            player.angle -= angleSpeed;
        }
        if (keys[control.turnRight]) {
            player.angle += angleSpeed;
        }

        player.pos[0] += direction[0] * player.speed;
        player.pos[1] += direction[1] * player.speed;

        if (keys[control.shoot] && currentTime - player.cooldown > cooldownTime) {
            const rayAngle = player.angle;
            const [distance, _, playerColor] = rayCasting(player.pos, rayAngle, players, i);
            if (playerColor) {
                for (let j = 0; j < players.length; j++) {
                    if (players[j].color === playerColor) {
                        players[j].health -= 1;
                        players[j].hitTimer = currentTime;
                        if (players[j].health <= 0) {
                            alert('You won!');
                            return;
                        }
                    }
                }
            }
            player.cooldown = currentTime;
        }
    });

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    draw3DProjection(ctx, players[0], obstacles, [players[0], otherPlayer], 0);
    drawHealth(ctx, players[0]);
    drawHealth(ctx, otherPlayer);

    sendData();

    requestAnimationFrame(update);
}

update();
