
loadList();
const player = new SpcPlayer();

const c = el("output");
c.width = 512;
c.height = 480;
let ctx = c.getContext("2d");
drawVisual();

let loopId = 0;
let loaded = false;
let paused = false;
let pausedInBg = false;

let audioHandler = null;

document.body.ondragover = function(e) {
  e.preventDefault();
}

document.body.ondrop = function (e) {
  e.preventDefault();
  let freader = new FileReader();
  freader.onload = function() {
    let buf = freader.result;
    let arr = new Uint8Array(buf);
    loadSpc(arr);
  }
  freader.readAsArrayBuffer(e.dataTransfer.files[0]);
}

document.addEventListener('click', () => {
  if (audioHandler === null) {
    audioHandler = new AudioHandler();
  }
})

el("rom").onchange = function(e) {
  let freader = new FileReader();
  freader.onload = function() {
    let buf = freader.result;
    let arr = new Uint8Array(buf);
    loadSpc(arr);
  }
  freader.readAsArrayBuffer(e.target.files[0]);
}

el("pause").onclick = function() {
  if(paused && loaded) {
    loopId = requestAnimationFrame(update);
    audioHandler.start();
    paused = false;
    el("pause").textContent = "Pause";
  } else {
    cancelAnimationFrame(loopId);
    audioHandler.stop();
    paused = true;
    el("pause").textContent = "Continue";
  }
}

el('channel-selector').onclick = function (e) {
  if (e.target === this) return;
  if (e.target.dataset.action) {
    const action = e.target.dataset.action;
    if (action === 'mute') {
      clearArray(player.apu.dsp.channelPlaying);
      for (let i = 0; i < 8; i++) {
        this.children[i].classList.add('mute');
      }
      return;
    }
    player.apu.dsp.channelPlaying.fill(1);
    for (let i = 0; i < 8; i++) {
      this.children[i].classList.remove('mute');
    }
    return;
  }

  const ch = Array.from(this.children).indexOf(e.target);
  const isOn = player.apu.dsp.channelPlaying[ch] > 0;
  if (isOn) {
    player.apu.dsp.channelPlaying[ch] = 0;
    e.target.classList.add('mute');
    return;
  }
  player.apu.dsp.channelPlaying[ch] = 1;
  e.target.classList.remove('mute');
}

el("reset").onclick = function() {
  if(loaded) {
    player.reset();
  }
}

document.onvisibilitychange = function(e) {
  if(document.hidden) {
    pausedInBg = false;
    if(!paused && loaded) {
      el("pause").click();
      pausedInBg = true;
    }
  } else {
    if(pausedInBg && loaded) {
      el("pause").click();
      pausedInBg = false;
    }
  }
}

async function loadSpc(spc) {
  if (!audioHandler) {
    audioHandler = new AudioHandler();
  }
  if(player.loadSpc(spc)) {
    if(!loaded && !paused) {
      loopId = requestAnimationFrame(update);
      audioHandler.start();
    }
    loaded = true;
  }
}

function runFrame() {
  player.runFrame();
  player.setSamples(audioHandler.sampleBufferL, audioHandler.sampleBufferR, audioHandler.samplesPerFrame);
  audioHandler.nextBuffer();
  drawVisual();
}

function update() {
  runFrame();
  loopId = requestAnimationFrame(update);
}

function drawVisual() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, c.width, c.height);
  // draw visualisation per channel
  for(let i = 0; i < 8; i++) {
    // Gain Background
    ctx.fillStyle = "#3f3f1f";
    ctx.fillRect(10 + i * 57, 480 - 300, 10, 300);

    // Gain
    ctx.fillStyle = "#ffff7f";
    const scale = player.apu.dsp.gain[i] * 300 / 0x7ff;
    ctx.fillRect(10 + i * 57, 480 - scale, 10, scale);

    // Piano Roll
    // const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const blackKeys = [false, true, false, true, false, false, true, false, true, false, true, false];

    const xOffset = 10 + i * 57 + 30;
    let pitch = player.apu.dsp.pitch[i];
    if(player.apu.dsp.pitchMod[i]) {
      let factor = (this.sampleOut[i - 1] >> 4) + 0x400;
      pitch = (pitch * factor) >> 10;
      pitch = Math.min(pitch, 0x3fff);
    }
    const note = Math.round(12 * Math.log2(pitch / 440) + 9);
    const noteIndex = note % 12;
    if (i === 0 && window.lastNote !== note) {
      window.lastNote = note;
      console.log(note);
    }
    // Played key
    ctx.fillStyle = "#7f7fff";
    // const letter = notes[note % 12];
    const octave = Math.floor(note / 12);
    const playedKeyIndex = ((index) => {
      let key = 0;
      for (let i = 0; i < index; i++) {
        if (!blackKeys[i]) {
          key++;
        }
      }
      return key + octave * 7;
    })(noteIndex);
    const width = blackKeys[noteIndex] ? 10 : 20;
    const yOffset = blackKeys[noteIndex] ? 3 : 10;
    const height = blackKeys[noteIndex] ? 6 : 10;
    ctx.fillRect(xOffset, 480 - (playedKeyIndex * 10) - yOffset, width, height);

    // White keys
    let keyIndex = 0;
    for (let j = 0; j < 82; j++) {
      if (blackKeys[j % 12]) continue;
      if (j === note) {
        keyIndex++;
        continue;
      }
      ctx.fillStyle = "#000000";
      ctx.fillRect(xOffset, 480 - (keyIndex * 10) - 10, 20, 10);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(xOffset + 1, 480 - (keyIndex * 10) - 9, 18, 8);
      keyIndex++;
    }

    // Black keys
    keyIndex = 0;
    for (let j = 0; j < 82; j++) {
      if (blackKeys[j % 12]) {
        if (j === note) {
          continue;
        }
        ctx.fillStyle = "#000000";
        ctx.fillRect(xOffset, 480 - (keyIndex * 10) - 3, 10, 6);
        j++;
      }
      keyIndex++;
    }
    if (blackKeys[noteIndex]) {
      ctx.fillStyle = "#7f7fff";
      ctx.fillRect(xOffset, 480 - (playedKeyIndex * 10) - yOffset, width, height);
    }
  }
}

window.onkeydown = function(e) {
  switch(e.key) {
    case "l":
    case "L": {
      break;
    }
  }
}

function clearArray(arr) {
  for(let i = 0; i < arr.length; i++) {
    arr[i] = 0;
  }
}

function el(id) {
  return document.getElementById(id);
}
