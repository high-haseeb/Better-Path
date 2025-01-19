import { WormHole } from "./wormhole.js";

const wormhole = new WormHole();

// MAIN PARAMETERS
const crossfadeTimeInSeconds = [1, 1, 10, 5, 3];                // crossfade time per escalation level
const timerTriggerInterval = 6500;                          // interval between each VO
const perimeterIncrementMin = 0.15;                         // minimum circle grow rate (at start of experience)
const perimeterIncrementMax = 0.5;                          // maximum circle grow rate (at final escalation stage)
const perimeterThresholds = [0, 60, 200, 450, 1250];      // circle sizes for incrementing escalation levels
const timerInterval = 100;                                  // no need to change this one

let audioContext;
let randomNoiseNode;

let voIdx = 0;
let audioContextStarted = false;

let voPlayers = [];
let ambiencePlayers = [];

let outputNode_vo;
let outputNode_ambience;

// const wormhole = new WormHole();

// helper functions

function dcMap(inValue, inMin, inMax, outMin, outMax) {
    return ((inValue - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

function dcClamp(a, b, c) {
    return Math.max(b, Math.min(c, a));
}

const SamplePlayer = {
    audioBuffer: null,
    sourceNode: null,
    gainNode: null,
    create: function(audioBuffer, sourceNode, gainNode) {
        const newSamplePlayer = Object.create(this);
        newSamplePlayer.audioBuffer = audioBuffer;
        newSamplePlayer.sourceNode = sourceNode;
        newSamplePlayer.gainNode = gainNode;
        return newSamplePlayer;
    }
};

// timer triggers VO based on current escalation level

let timeInMilliseconds = 0;
let timeInMillisecondsGameActive = 0;
let timer = setInterval(function() {
    if (gameActive) {
        timeInMillisecondsGameActive += timerInterval;
        timeInMilliseconds += timerInterval;
        perimeterIncrement = dcMap(timeInMillisecondsGameActive, 0, 30000, perimeterIncrementMin, perimeterIncrementMax);
        if (timeInMilliseconds >= timerTriggerInterval) {
            timeInMilliseconds = 0;
            if (audioContextStarted) {
                triggerVO_escalation();
            }
        }
    } else {
        timeInMilliseconds = 0;
        timeInMillisecondsGameActive = 0;
    }
}, 100)

// CANVAS

const startCanvas = document.getElementById('startCanvas');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

const centreOffsetSmoothFactor = 0.97;
let centreOffsetX = 0;
let centreOffsetY = 0;

let perimeterRadius = 50;
let perimeterRadiusPrev = 50;
let perimeterIncrement = 0.01;
let perimeterDecrement = 1;
let incrementing, decrementing;

let mouseX;
let mouseY;
let anchorX
let anchorY;

let escalationLevel = 0;
let escalationLevelPrev = 0;
let gameActive = false;
let gameActivePrev = false;


// Track the mouse coordinates relative to the canvas boundaries
function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
}

// Draw a circle in the center of the canvas
function drawCircle() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, perimeterRadius, 0, Math.PI * 2);
    // ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.clip();
    ctx.drawImage(wormhole.getCanvas(), 0, 0, canvas.width, canvas.height);

    // ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, perimeterRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.stroke();
}

// Draw loop: escalation logic happens here
function drawLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    anchorX = centerX + centreOffsetX;
    anchorY = centerY + centreOffsetY;
    const distance = Math.hypot(mouseX - anchorX, mouseY - anchorY);
    const isInCircle = distance <= perimeterRadius;

    if (isInCircle) {
        centreOffsetX = centreOffsetX * centreOffsetSmoothFactor + (mouseX - canvas.width * 0.5) * (1 - centreOffsetSmoothFactor);
        centreOffsetY = centreOffsetY * centreOffsetSmoothFactor + (mouseY - canvas.height * 0.5) * (1 - centreOffsetSmoothFactor);
    } else {
        centreOffsetX = centreOffsetX * centreOffsetSmoothFactor;
        centreOffsetY = centreOffsetY * centreOffsetSmoothFactor;
    }

    perimeterRadiusPrev = perimeterRadius;
    if (isInCircle || escalationLevel >= 4) {
        gameActive = true;
        if (!gameActivePrev) {
            // events to trigger when entering circle
            triggerVO_temptation();
            changeEscalationLevel(1);
            wormhole.setSpeed(1);
        }
        if (perimeterRadius < Math.max(canvas.width, canvas.height)) {
            // perimieterIncrement = perimeterRadius
            perimeterRadius += perimeterIncrement;
            incrementing = true;
        }
    } else {
        gameActive = false;
        if (gameActivePrev) {
            // events to trigger when exiting circle
            triggerVO_sensibility();
            changeEscalationLevel(0);

            wormhole.setSpeed(-1.0);
        }
        if (perimeterRadius > 50) {
            perimeterRadius -= perimeterDecrement;
            decrementing = false;
        }
    }

    gameActivePrev = gameActive;

    for (const p in perimeterThresholds) {
        if (perimeterRadiusPrev < perimeterThresholds[p] && perimeterRadius >= perimeterThresholds[p]) {
            changeEscalationLevel(p);
        }
    }

    drawCircle();

    requestAnimationFrame(drawLoop);
}

function changeEscalationLevel(level) {
    escalationLevel = level;
    console.log("escalation level: " + escalationLevel)
    if (escalationLevel != escalationLevelPrev) {
        // change ambience loop
        if (!ambiencePlayers[escalationLevelPrev].gainNode) return;
        ambiencePlayers[escalationLevelPrev].gainNode.gain.setValueAtTime(ambiencePlayers[escalationLevelPrev].gainNode.gain.value, audioContext.currentTime);
        ambiencePlayers[escalationLevelPrev].gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + crossfadeTimeInSeconds[escalationLevel]);
        for (let i = 0; i < ambiencePlayers.length; i++) {
            if (i != escalationLevel && i != escalationLevelPrev) {
                ambiencePlayers[i].gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + crossfadeTimeInSeconds[escalationLevel]);
            }
        }
        if (ambiencePlayers.length >= level + 1) {
            ambiencePlayers[level].gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            ambiencePlayers[level].gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + crossfadeTimeInSeconds[escalationLevel]);
        } else {
            setupSample(paths_ambienceLoops[level]).then((response) => {
                // console.log("loading and playing: " + paths_ambienceLoops[level]);
                const player = playSample(response, 0, true, 0, outputNode_ambience);
                player.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                player.gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + crossfadeTimeInSeconds[escalationLevel]);
                ambiencePlayers.push(player);
            });
        }
        escalationLevelPrev = escalationLevel;
    }
}

// Add an event listener to track the mouse coordinates
canvas.addEventListener('mousemove', (event) => {
    trackMouse(event);
});

startCanvas.addEventListener('click', (event) => {
    console.log("Starting soon");
    startCanvas.style.visibility = 'hidden';
    startCanvas.style.opacity = 0;
    document.getElementById("quote").style.opacity = 0;
    document.getElementById("quote").style.visibility = 'hidden';
    startAudioContext().then((response) => {
        setupSample("audio/ui/chime.ogg").then((response) => {
            playSample(response, 0, false, 1, audioContext.destination);
        });
        setupSample(paths_ambienceLoops[0]).then((response) => {
            const player = playSample(response, 0, true, 0, outputNode_ambience);
            player.gainNode.gain.linearRampToValueAtTime(1, 5);
            ambiencePlayers.push(player);
        });

    });
});

// Draw the initial circle in the center of the canvas
drawLoop();

// AUDIO

async function setupAudioWorklets() {

    await audioContext.audioWorklet.addModule("random-noise-processor.js");
    randomNoiseNode = new AudioWorkletNode(
        audioContext,
        "random-noise-processor", {
        channelCount: 4,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
        numberOfOutputs: 1,
        outputChannelCount: [4],
        numberOfInputs: 1
    }
    );
    randomNoiseNode.connect(audioContext.destination);
}

var previousRandomInt = -1;
var previousPreviousRandomInt = -1;

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    var val = Math.floor(Math.random() * (max - min + 1)) + min;
    while (val == previousRandomInt || val == previousPreviousRandomInt) {
        val = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    previousPreviousRandomInt = previousRandomInt;
    previousRandomInt = val;
    return val;
}

function triggerVO_sensibility() {
    if (audioContextStarted) {
        let path = vo_sensibility[getRandomInt(0, vo_sensibility.length - 1)];
        console.log("Loading: " + path);
        setupSample(path).then((response) => {
            let sample = response;
            if (voPlayers) {
                voPlayers.forEach(element => {
                    element.sourceNode.stop();
                });
            }
            voPlayers.push(playSample(sample, 0, 0, 1, outputNode_vo));
        });
    }
}

function triggerVO_temptation() {
    if (audioContextStarted) {
        let path = vo_temptation[getRandomInt(0, vo_temptation.length - 1)];
        console.log("Loading: " + path);
        setupSample(path).then((response) => {
            let sample = response;
            if (voPlayers) {
                voPlayers.forEach(element => {
                    element.sourceNode.stop();
                });
            }
            voPlayers.push(playSample(sample, 0, 0, 1, outputNode_vo));
        });
    }
}

function triggerVO_escalation() {
    let path;
    if (audioContextStarted) {

        console.log("escalationLevel " + escalationLevel);
        if (escalationLevel == 1)
            path = vo_escalation_mild[getRandomInt(0, vo_escalation_mild.length - 1)];
        if (escalationLevel == 2)
            path = vo_escalation_medium[getRandomInt(0, vo_escalation_medium.length - 1)];
        if (escalationLevel == 3)
            path = vo_escalation_strong[getRandomInt(0, vo_escalation_strong.length - 1)];
        if (escalationLevel == 4)
            path = vo_void[getRandomInt(0, vo_void.length - 1)];

        console.log("Loading: " + path);
        setupSample(path).then((response) => {
            let sample = response;
            if (voPlayers) {
                voPlayers.forEach(element => {
                    element.sourceNode.stop();
                });
            }
            voPlayers.push(playSample(sample, 0, 0, 1, outputNode_vo));
        });
    }
}

const startCtxBtn = document.querySelector(".start");
const setupSamplesBtn = document.querySelector(".setup-samples");
const playSampleBtn = document.querySelector(".play-sample");

const samplePaths = ["audio/ambience/brain_binaural_ambience_bookies_seamless.ogg", "audio/vo/temptation_01.ogg", "audio/vo/temptation_02.ogg"];

const paths_ambienceLoops = ["audio/ambience/brain_ambience_idle.ogg",
    "audio/ambience/brain_ambience_escalation_0.ogg",
    "audio/ambience/brain_ambience_escalation_1.ogg",
    "audio/ambience/brain_ambience_escalation_2.ogg",
    "audio/ambience/brain_ambience_escalation_3.ogg"];

const vo_escalation_mild = ["audio/vo/escalation_mild_01.ogg",
    "audio/vo/escalation_mild_02.ogg",
    "audio/vo/escalation_mild_03.ogg",
    "audio/vo/escalation_mild_04.ogg",
    "audio/vo/escalation_mild_05.ogg",
    "audio/vo/escalation_mild_06.ogg",
    "audio/vo/escalation_mild_07.ogg"];

const vo_escalation_medium = ["audio/vo/escalation_med_01_with_tail.ogg",
    "audio/vo/escalation_med_02_with_tail.ogg",
    "audio/vo/escalation_med_03_with_tail.ogg",
    "audio/vo/escalation_med_04_with_tail.ogg",
    "audio/vo/escalation_med_05_with_tail.ogg",
    "audio/vo/escalation_med_06_with_tail.ogg"];

const vo_escalation_strong = ["audio/vo/escalation_strong_01_with_tail.ogg",
    "audio/vo/escalation_strong_02_with_tail.ogg",
    //"audio/vo/escalation_strong_03_with_tail.ogg",
    "audio/vo/escalation_strong_04_with_tail.ogg",
    "audio/vo/escalation_strong_05_with_tail.ogg",
    "audio/vo/escalation_strong_06_with_tail.ogg"];

const vo_deescalation = ["audio/vo/deescalation_01.ogg",
    "audio/vo/deescalation_02.ogg",
    "audio/vo/deescalation_03.ogg",
    "audio/vo/deescalation_04.ogg",
    "audio/vo/deescalation_05.ogg",
    "audio/vo/deescalation_06.ogg",
    "audio/vo/deescalation_07.ogg",
    "audio/vo/deescalation_08.ogg",
    "audio/vo/deescalation_09.ogg"];

const vo_temptation = ["audio/vo/temptation_01.ogg",
    "audio/vo/temptation_02.ogg",
    "audio/vo/temptation_03.ogg",
    "audio/vo/temptation_04.ogg",
    "audio/vo/temptation_05.ogg",
    "audio/vo/temptation_06.ogg"];

const vo_sensibility = ["audio/vo/sensibility_01.ogg",
    "audio/vo/sensibility_02.ogg",
    "audio/vo/sensibility_03.ogg",
    "audio/vo/sensibility_04.ogg",
    "audio/vo/sensibility_05.ogg",];

const vo_void = ["audio/vo/vo_acceptance_01.ogg",
    "audio/vo/vo_acceptance_02.ogg",
    "audio/vo/vo_acceptance_03.ogg",
    "audio/vo/vo_acceptance_04.ogg",
    "audio/vo/vo_acceptance_05.ogg",
    "audio/vo/vo_acceptance_06.ogg",
    "audio/vo/vo_acceptance_07.ogg",
    "audio/vo/vo_acceptance_08ogg",
    "audio/vo/vo_acceptance_09.ogg",
    "audio/vo/vo_acceptance_10.ogg",
    "audio/vo/vo_acceptance_11.ogg",
    "audio/vo/vo_anger_01.ogg",
    "audio/vo/vo_anger_02.ogg",
    "audio/vo/vo_anger_03.ogg",
    "audio/vo/vo_anger_04.ogg",
    "audio/vo/vo_anger_05.ogg",
    "audio/vo/vo_anger_06.ogg",
    "audio/vo/vo_guilt_01.ogg",
    "audio/vo/vo_guilt_02.ogg",
    "audio/vo/vo_guilt_03.ogg",
    "audio/vo/vo_guilt_04.ogg",
    "audio/vo/vo_loss_01.ogg",
    "audio/vo/vo_loss_02.ogg",
    "audio/vo/vo_loss_03.ogg",
    "audio/vo/vo_loss_04.ogg",
    "audio/vo/vo_loss_05.ogg",
    "audio/vo/vo_loss_06.ogg",
    "audio/vo/vo_panic_01.ogg",
    "audio/vo/vo_panic_02.ogg",
    "audio/vo/vo_panic_03.ogg",
    "audio/vo/vo_panic_04.ogg",
    "audio/vo/vo_sadness_01.ogg",
    "audio/vo/vo_sadness_02.ogg",
    "audio/vo/vo_sadness_03.ogg",
    "audio/vo/vo_sadness_04.ogg"];

async function startAudioContext() {
    audioContext = new AudioContext();
    audioContextStarted = true;
    outputNode_ambience = audioContext.createGain();
    outputNode_vo = audioContext.createGain();
    outputNode_ambience.connect(audioContext.destination);
    outputNode_vo.connect(audioContext.destination);
    outputNode_ambience.gain.value = 1;
    outputNode_vo.gain.value = 1;
    console.log("Audio context started.");
    //setupAudioWorklets();
    //console.log("Setup audio worklets");
}

async function getFile(filepath) {
    const response = await fetch(filepath);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

async function setupSamples(paths) {
    console.log("Setting up samples... " + paths);
    const audioBuffers = [];

    for (const path of paths) {
        const sample = await getFile(path);
        audioBuffers.push(sample);
    }
    console.log("Done setting up samples");
    return audioBuffers;
}

async function setupSample(path) {
    const sample = await getFile(path);
    let audioBuffer = sample;
    return audioBuffer;
}

function playSample(audioBuffer, time, looping, gain, outputNode) {
    if (audioBuffer.numberOfChannels > 2) {
        console.log("multichannel file detected: " + audioBuffer.numberOfChannels);
    }
    const sampleSource = new AudioBufferSourceNode(
        audioContext, {
        loop: looping
    }
    );
    sampleSource.buffer = audioBuffer;
    const gainNode = audioContext.createGain();
    var player = SamplePlayer.create(audioBuffer, sampleSource, gainNode);
    player.sourceNode.start(time);
    player.sourceNode.connect(player.gainNode);
    player.gainNode.gain.value = gain;
    player.gainNode.connect(outputNode);

    return player;
}

function fadeInSample(audioBuffer, time, looping, fadeInTime) {
    if (audioBuffer.numberOfChannels > 2) {
        console.log("multichannel file detected: " + audioBuffer.numberOfChannels);
    }
    const sampleSource = new AudioBufferSourceNode(
        audioContext, {
        loop: looping
    }
    );
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0;
    sampleSource.buffer = audioBuffer;
    sampleSource.connect(gainNode);
    gainNode.gain.exponentialRampToValueAtTime(1, fadeInTime);
    sampleSource.start(time);
    return sampleSource;
}
