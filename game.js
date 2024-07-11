const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

const BLACK = 'black';
const WHITE = 'white';
const RED = 'red';
const BLUE = 'blue';
const PURPLE = 'purple';
const YELLOW = 'yellow';

const angleSpeed = 0.05;
const numRays = 120;
const viewAngle = Math.PI / 3;
const maxDistance = 300;
const cooldownTime = 2000;
const hitTime = 1000;

const players = [
    { pos: [width / 4, height / 2], angle: 0, speed: 2, health: 3, color: RED, cooldown: 0, hitTimer: 0 }
];
const otherPlayer = { pos: [3 * width / 4, height / 2], angle: 0, speed: 2, health: 3, color: BLUE, cooldown: 0, hitTimer: 0 };

const controls = [
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', turnLeft: 'KeyQ', turnRight: 'KeyE', shoot: 'Space' }
];

const obstacles = [
    [0, 0, width, 10],
    [0, height - 10, width, 10],
    [0, 0, 10, height],
    [width - 10, 0, 10, height],
    [100, 100, 50, 50],
    [300, 200, 60, 60],
    [150, 300, 40, 40],
    [500, 150, 70, 70],
    [600, 300, 40, 40]
];

const corners = [];
obstacles.forEach(rect => {
    corners.push([rect[0], rect[1]]);
    corners.push([rect[0] + rect[2], rect[1]]);
    corners.push([rect[0], rect[1] + rect[3]]);
    corners.push([rect[0] + rect[2], rect[1] + rect[3]]);
});

const socket = new WebSocket('wss://ef9a-212-58-119-152.ngrok-free.app/');

socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.type === 'updatePlayer') {
        Object.assign(otherPlayer, data.player);
    }
});

function rayCasting(playerPos, angle, players, playerIndex) {
    let [x, y] = playerPos;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    for (let distance = 0; distance < maxDistance; distance += 5) {
        x += dx * 5;
        y += dy * 5;

        if (corners.some(corner => Math.hypot(corner[0] - x, corner[1] - y) < 5)) {
            return [distance, true, null];
        }

        if (obstacles.some(rect => rect[0] <= x && x <= rect[0] + rect[2] && rect[1] <= y && y <= rect[1] + rect[3])) {
            return [distance, false, null];
        }

        for (let i = 0; i < players.length; i++) {
            if (i !== playerIndex) {
                const [px, py] = players[i].pos;
                if (px - 5 <= x && x <= px + 5 && py - 5 <= y && y <= py + 5) {
                    return [distance, false, players[i].color];
                }
            }
        }
    }

    return [maxDistance, false, null];
}

function draw3DProjection(player, players, playerIndex, currentTime) {
    for (let ray = 0; ray < numRays; ray++) {
        const rayAngle = player.angle - viewAngle / 2 + viewAngle * ray / numRays;
        const [distance, isCorner, playerColor] = rayCasting(player.pos, rayAngle, players, playerIndex);
        const wallHeight = height * (1 - Math.sqrt(distance / maxDistance));
        const shade = 255 - Math.floor(distance * 255 / maxDistance);

        let wallColor = `rgb(${shade}, ${shade}, ${shade})`;
        if (playerColor) {
            for (const p of players) {
                if (p.color === playerColor && currentTime - p.hitTimer < hitTime) {
                    wallColor = PURPLE;
                }
            }
        } else if (isCorner) {
            wallColor = YELLOW;
        }

        ctx.fillStyle = wallColor;
        ctx.fillRect(ray * (width / numRays), height / 2 - wallHeight / 2, (width / numRays), wallHeight);
    }
}

function drawHealth(player) {
    ctx.font = '18px Arial';
    ctx.fillStyle = WHITE;
    ctx.fillText(`Health: ${player.health}`, 10, 20);
}

function gameLoop() {
    ctx.clearRect(0, 0, width, height);
    const keys = {};
    document.onkeydown = (e) => {
        keys[e.code] = true;
    };
    document.onkeyup = (e) => {
        keys[e.code] = false;
    };

    const currentTime = performance.now();
    players.forEach((player, i) => {
        const control = controls[i];
        const direction = [0, 0];
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
            const [distance, _, playerColor] = rayCasting(player.pos, player.angle, players, i);
            if (playerColor) {
                [otherPlayer].forEach(target => {
                    if (target.color === playerColor) {
                        target.health -= 1;
                        target.hitTimer = currentTime;
                        if (target.health <= 0) {
                            alert("You won!");
                            window.location.reload();
                        }
                    }
                });
            }
            player.cooldown = currentTime;
        }

        const playerData = {
            type: 'updatePlayer',
            player: {
                pos: player.pos,
                angle: player.angle,
                health: player.health,
                color: player.color,
                cooldown: player.cooldown,
                hitTimer: player.hitTimer
            }
        };
        socket.send(JSON.stringify(playerData));
    });

    draw3DProjection(players[0], [players[0], otherPlayer], 0, currentTime);
    drawHealth(players[0]);
    drawHealth(otherPlayer);

    requestAnimationFrame(gameLoop);
}

gameLoop();
