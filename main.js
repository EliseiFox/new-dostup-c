const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const width = canvas.width;
const height = canvas.height;
const FPS = 60;
const BLACK = '#000000';
const WHITE = '#FFFFFF';
const RED = '#FF0000';
const BLUE = '#0000FF';
const PURPLE = '#800080';
const YELLOW = '#FFFF00';

let players = [
    {pos: [width / 4, height / 2], angle: 0, speed: 2, health: 3, color: RED, cooldown: 0, hit_timer: 0}
];

let otherPlayer = {
    pos: [3 * width / 4, height / 2],
    angle: 0,
    speed: 2,
    health: 3,
    color: BLUE,
    cooldown: 0,
    hit_timer: 0
};

const controls = [
    {left: 'a', right: 'd', up: 'w', down: 's', turn_left: 'q', turn_right: 'e', shoot: ' '}
];

const angle_speed = 0.05;
const num_rays = 120;
const view_angle = Math.PI / 3;
const max_distance = 300;
const cooldown_time = 2000;
const hit_time = 1000;

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
for (let rect of obstacles) {
    corners.push([rect[0], rect[1]]);
    corners.push([rect[0] + rect[2], rect[1]]);
    corners.push([rect[0], rect[1] + rect[3]]);
    corners.push([rect[0] + rect[2], rect[1] + rect[3]]);
}

function rayCasting(playerPos, angle, players, playerIndex) {
    let x = playerPos[0];
    let y = playerPos[1];
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let distance = 0; distance < max_distance; distance += 5) {
        x += dx * 5;
        y += dy * 5;
        if (corners.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 5)) {
            return [distance, true, null];
        }
        if (obstacles.some(([ox, oy, ow, oh]) => ox <= x && x <= ox + ow && oy <= y && y <= oy + oh)) {
            return [distance, false, null];
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
    return [max_distance, false, null];
}

function draw3DProjection(ctx, player, obstacles, players, playerIndex, currentTime) {
    for (let ray = 0; ray < num_rays; ray++) {
        const ray_angle = player.angle - view_angle / 2 + view_angle * ray / num_rays;
        const [distance, is_corner, player_color] = rayCasting(player.pos, ray_angle, players, playerIndex);
        const wall_height = height * (1 - Math.sqrt(distance / max_distance));
        const shade = 255 - Math.floor(distance * 255 / max_distance);
        let wall_color;
        if (player_color) {
            if (currentTime - players.find(p => p.color === player_color).hit_timer < hit_time) {
                wall_color = PURPLE;
            } else {
                wall_color = player_color;
            }
        } else {
            wall_color = is_corner ? YELLOW : `rgb(${shade}, ${shade}, ${shade})`;
        }
        ctx.fillStyle = wall_color;
        ctx.fillRect(ray * (width / num_rays), height / 2 - wall_height / 2, (width / num_rays), wall_height);
    }
}

function drawHealth(ctx, player) {
    ctx.fillStyle = WHITE;
    ctx.font = '24px Arial';
    ctx.fillText(`Health: ${player.health}`, 10, 30);
}

let socket = new WebSocket('wss://8305-212-58-119-152.ngrok-free.app');

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    otherPlayer = {...otherPlayer, ...data};
};

function sendData() {
    const currentTime = Date.now();
    const data = JSON.stringify({
        pos: players[0].pos,
        angle: players[0].angle,
        health: players[0].health,
        color: players[0].color,
        cooldown: players[0].cooldown,
        hit_timer: players[0].hit_timer,
        time: currentTime
    });
    socket.send(data);
}

function gameLoop() {
    const currentTime = Date.now();
    const keys = {};
    document.onkeydown = (e) => keys[e.key] = true;
    document.onkeyup = (e) => keys[e.key] = false;

    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
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
        if (keys[control.turn_left]) {
            player.angle -= angle_speed;
        }
        if (keys[control.turn_right]) {
            player.angle += angle_speed;
        }

        player.pos[0] += direction[0] * player.speed;
        player.pos[1] += direction[1] * player.speed;

        if (keys[control.shoot] && currentTime - player.cooldown > cooldown_time) {
            const ray_angle = player.angle;
            const [distance, , player_color] = rayCasting(player.pos, ray_angle, players, i);
            if (player_color) {
                if (otherPlayer.color === player_color) {
                    otherPlayer.health -= 1;
                    otherPlayer.hit_timer = currentTime;
                    if (otherPlayer.health <= 0) {
                        alert("You won!");
                        return;
                    }
                }
            }
            player.cooldown = currentTime;
        }
    }

    draw3DProjection(ctx, players[0], obstacles, [players[0], otherPlayer], 0, currentTime);
    drawHealth(ctx, players[0]);
    drawHealth(ctx, otherPlayer);

    sendData();
    requestAnimationFrame(gameLoop);
}

gameLoop();
