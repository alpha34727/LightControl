/**
 * Light Control Pro - NLE Timeline Engine (Phase 6)
 */

let PIXELS_PER_SEC = 100;
let TRACK_HEIGHT = 120;
let audioContext = null;
let activeSources = [];
let isPlaying = false;
let startTime = 0;
let pauseTime = 0;
const MAX_TIME = 600; // 10 minutes workspace

// State
let timelineTracks = []; 
let nextTrackId = 1;
let nextClipId = 1;
let nextKeyframeId = 1;

let draggedElement = null; 

// DOM
const timelineEditorRight = document.getElementById('timeline-editor-right');
const headersList = document.getElementById('headers-list');
const tracksContainer = document.getElementById('tracks-container');
const rulerCanvas = document.getElementById('ruler-canvas');
const playhead = document.getElementById('playhead');

const btnAddAudioTrack = document.getElementById('btn-add-audio-track');
const btnAddLightTrack = document.getElementById('btn-add-light-track');
const btnSplitAudio = document.getElementById('btn-split-audio');
const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const timeDisplay = document.getElementById('time-display');
const zoomXInput = document.getElementById('zoom-x');
const zoomYInput = document.getElementById('zoom-y');

// Init
function initTimelineMap() {
    applyZoomLayouts();
    timelineEditorRight.addEventListener('scroll', (e) => { headersList.scrollTop = e.target.scrollTop; });
    
    // Zoom events
    zoomXInput.addEventListener('input', (e) => { PIXELS_PER_SEC = parseInt(e.target.value); applyZoomLayouts(); });
    zoomYInput.addEventListener('input', (e) => { TRACK_HEIGHT = parseInt(e.target.value); applyZoomLayouts(); });

    rulerCanvas.addEventListener('mousedown', (e) => {
        const rect = rulerCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        pauseTime = Math.max(0, x / PIXELS_PER_SEC);
        if (!isPlaying) { updatePlayheadUI(pauseTime); processDmxEngine(pauseTime); } 
        else { pauseAudioNodes(); startTime = audioContext.currentTime - pauseTime; playAudioNodes(pauseTime); }
    });
}
window.addEventListener('DOMContentLoaded', initTimelineMap);

function applyZoomLayouts() {
    const width = MAX_TIME * PIXELS_PER_SEC;
    rulerCanvas.width = width; rulerCanvas.style.width = width + 'px';
    tracksContainer.style.width = width + 'px';

    const ctx = rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, 30);
    ctx.fillStyle = '#8b949e'; ctx.strokeStyle = '#30363d'; ctx.font = '10px monospace';
    for (let s = 0; s <= MAX_TIME; s++) {
        const x = s * PIXELS_PER_SEC;
        ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x, 30); ctx.stroke();
        ctx.fillText(formatTime(s), x + 3, 12);
        for (let ms = 1; ms < 10; ms++) { ctx.beginPath(); ctx.moveTo(x + ms * (PIXELS_PER_SEC/10), 25); ctx.lineTo(x + ms * (PIXELS_PER_SEC/10), 30); ctx.stroke(); }
    }

    // Refresh Playhead
    updatePlayheadUI(isPlaying ? (audioContext.currentTime - startTime) : pauseTime);

    // Refresh Tracks
    timelineTracks.forEach(track => {
        const wsEl = document.querySelector(`.track-workspace[data-id="${track.id}"]`);
        const headerEl = document.querySelector(`.track-header[data-id="${track.id}"]`);
        if (wsEl) wsEl.style.height = TRACK_HEIGHT + 'px';
        if (headerEl) headerEl.style.height = TRACK_HEIGHT + 'px';

        if (track.type === 'light') {
            track.keyframes.forEach(kf => {
                const point = wsEl.querySelector(`.keyframe-point[data-kfid="${kf.id}"]`);
                if (point) {
                    point.style.left = (kf.time * PIXELS_PER_SEC) + 'px';
                    point.style.top = (TRACK_HEIGHT - (kf.value / 255 * TRACK_HEIGHT)) + 'px';
                }
            });
            renderLightCurve(track);
        } else if (track.type === 'audio') {
            track.clips.forEach(clip => {
                const clipEl = wsEl.querySelector(`.audio-clip[data-id="${clip.id}"]`);
                if (clipEl) {
                    clipEl.style.width = (clip.duration * PIXELS_PER_SEC) + 'px';
                    clipEl.style.left = (clip.timelineStart * PIXELS_PER_SEC) + 'px';
                    clipEl.style.height = (TRACK_HEIGHT - 20) + 'px'; // - padding
                    const canvasEl = clipEl.querySelector('canvas');
                    if(canvasEl) canvasEl.style.transform = `translateX(-${clip.audioOffset * PIXELS_PER_SEC}px)`;
                }
            });
        }
    });
}

function removeTrack(trackId) {
    if (isPlaying) { alert("請先暫停時間軸再刪除軌道"); return; }
    timelineTracks = timelineTracks.filter(t => t.id !== trackId);
    document.querySelector(`.track-header[data-id="${trackId}"]`)?.remove();
    document.querySelector(`.track-workspace[data-id="${trackId}"]`)?.remove();
}

// Add Light Track
btnAddLightTrack.addEventListener('click', () => {
    let ch = 0;
    while(timelineTracks.some(t => t.type === 'light' && t.channel === ch) && ch < 512) ch++;
    if (ch >= 512) return alert("無可用通道！");
    const id = nextTrackId++;
    const trackData = { id, type: 'light', channel: ch, keyframes: [] };
    timelineTracks.push(trackData);
    createTrackHeader(trackData); createTrackWorkspace(trackData);
});

// Add Audio Track
btnAddAudioTrack.addEventListener('click', () => {
    const id = nextTrackId++;
    const trackData = { id, type: 'audio', volume: 1.0, clips: [] };
    timelineTracks.push(trackData);
    createTrackHeader(trackData); createTrackWorkspace(trackData);
});

function createTrackHeader(trackData) {
    const headerEl = document.createElement('div');
    headerEl.className = 'track-header'; headerEl.dataset.id = trackData.id;
    headerEl.style.height = TRACK_HEIGHT + 'px';

    const titleEl = document.createElement('div');
    titleEl.className = 'track-header-title';
    titleEl.innerHTML = trackData.type === 'light' ? `💡 Light Track` : `🎵 Audio Track`;
    
    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-track'; delBtn.innerHTML = '🗑️';
    delBtn.onclick = () => removeTrack(trackData.id);
    titleEl.appendChild(delBtn);

    const controlsEl = document.createElement('div');
    controlsEl.className = 'track-header-controls';

    if (trackData.type === 'light') {
        controlsEl.innerHTML = `<span style="font-size: 0.8rem; color: #8b949e">CH</span>`;
        const chInput = document.createElement('input');
        chInput.type = 'number'; chInput.min = 0; chInput.max = 511; chInput.value = trackData.channel;
        chInput.className = 'track-channel-input';
        chInput.onchange = (e) => { 
            const val = parseInt(e.target.value) || 0;
            if (timelineTracks.some(t => t.type === 'light' && t.channel === val && t.id !== trackData.id)) {
                alert("此 Channel 已被其他軌道使用！"); e.target.value = trackData.channel; return;
            }
            trackData.channel = val; 
        };
        controlsEl.appendChild(chInput);
    } else {
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'audio/*'; fileInput.className = 'clip-file-input';
        fileInput.onchange = (e) => loadAudioClip(e, trackData);
        controlsEl.appendChild(fileInput);

        // Volume Slider
        const volWrapper = document.createElement('div');
        volWrapper.style.cssText = 'display:flex; align-items:center; gap:5px; margin-top:5px;';
        volWrapper.innerHTML = '<span style="font-size:12px;">🔊</span>';
        const volSlider = document.createElement('input');
        volSlider.type = 'range'; volSlider.min = 0; volSlider.max = 100; volSlider.value = 100;
        volSlider.className = 'audio-vol-slider';
        volSlider.oninput = (e) => {
            trackData.volume = parseInt(e.target.value) / 100;
            if (trackData.gainNode) trackData.gainNode.gain.value = trackData.volume;
        };
        volWrapper.appendChild(volSlider);
        headerEl.appendChild(volWrapper);
    }

    headerEl.prepend(titleEl); headerEl.appendChild(controlsEl); headersList.appendChild(headerEl);
}

function createTrackWorkspace(trackData) {
    const wsEl = document.createElement('div');
    wsEl.className = 'track-workspace'; wsEl.dataset.id = trackData.id;
    wsEl.style.height = TRACK_HEIGHT + 'px';

    if (trackData.type === 'light') {
        const svgNs = "http://www.w3.org/2000/svg";
        const svgEl = document.createElementNS(svgNs, "svg");
        svgEl.setAttribute("class", "track-svg");
        const pathEl = document.createElementNS(svgNs, "path");
        svgEl.appendChild(pathEl); wsEl.appendChild(svgEl);

        wsEl.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('keyframe-point')) return;
            const rect = wsEl.getBoundingClientRect();
            let x = e.clientX - rect.left; let y = e.clientY - rect.top;
            const time = Math.max(0, x / PIXELS_PER_SEC);
            const value = Math.max(0, Math.min(255, Math.round((1 - (y / TRACK_HEIGHT)) * 255)));
            addKeyframe(trackData, time, value);
        });
    }

    tracksContainer.appendChild(wsEl);
}

/* --- LIGHT KEYFRAMES --- */
function addKeyframe(trackData, time, value) {
    const kfId = nextKeyframeId++;
    const kf = { id: kfId, time, value };
    trackData.keyframes.push(kf);
    trackData.keyframes.sort((a, b) => a.time - b.time);
    injectKeyframeDOM(trackData, kf);
    renderLightCurve(trackData);
}

function injectKeyframeDOM(trackData, kf) {
    const wsEl = document.querySelector(`.track-workspace[data-id="${trackData.id}"]`);
    const point = document.createElement('div');
    point.className = 'keyframe-point'; point.dataset.kfid = kf.id;
    const x = kf.time * PIXELS_PER_SEC; const y = TRACK_HEIGHT - (kf.value / 255 * TRACK_HEIGHT);
    point.style.left = x + 'px'; point.style.top = y + 'px';

    point.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        draggedElement = { type: 'keyframe', element: point, trackId: trackData.id, keyframeId: kf.id, wsEl };
        point.classList.add('dragging');
    });

    point.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        trackData.keyframes = trackData.keyframes.filter(k => k.id !== kf.id);
        point.remove(); renderLightCurve(trackData);
    });
    wsEl.appendChild(point);
}

function renderLightCurve(trackData) {
    const wsEl = document.querySelector(`.track-workspace[data-id="${trackData.id}"]`);
    if (!wsEl) return;
    const pathEl = wsEl.querySelector('.track-svg path');
    if (trackData.keyframes.length === 0) { pathEl.setAttribute('d', ''); return; }

    let d = '';
    trackData.keyframes.forEach((kf, index) => {
        const x = kf.time * PIXELS_PER_SEC; const y = TRACK_HEIGHT - (kf.value / 255 * TRACK_HEIGHT);
        d += index === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `;
    });
    pathEl.setAttribute('d', d.trim());
}

window.recordKeyframeFromSlider = (channel, value) => {
    if (isPlaying) return;
    const track = timelineTracks.find(t => t.type === 'light' && t.channel === channel);
    if (!track) return;
    let kf = track.keyframes.find(k => Math.abs(k.time - pauseTime) < 0.1);
    if (kf) {
        kf.time = pauseTime; kf.value = value;
        track.keyframes.sort((a, b) => a.time - b.time);
    } else {
        kf = { id: nextKeyframeId++, time: pauseTime, value };
        track.keyframes.push(kf); track.keyframes.sort((a, b) => a.time - b.time);
    }
    const wsEl = document.querySelector(`.track-workspace[data-id="${track.id}"]`);
    wsEl.querySelectorAll('.keyframe-point').forEach(el => el.remove());
    track.keyframes.forEach(k => injectKeyframeDOM(track, k));
    renderLightCurve(track);
}

/* --- AUDIO ENGINE & EDITING --- */
async function loadAudioClip(e, trackData) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const file = e.target.files[0]; if (!file) return;

    btnPlay.disabled = true; timeDisplay.textContent = '載入中...';
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const canvas = document.createElement('canvas');
        canvas.width = buffer.duration * 100; // Base rendering scalar (prevent blur)
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        const isStereo = buffer.numberOfChannels >= 2;
        const dataL = buffer.getChannelData(0);
        const dataR = isStereo ? buffer.getChannelData(1) : null;
        
        if (isStereo) {
            const amp = canvas.height / 4;
            ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
            for (let i = 0; i < canvas.width; i++) {
                let minL = 1.0, maxL = -1.0, minR = 1.0, maxR = -1.0;
                // Perfect index matching prevents visual drift!!
                const startIdx = Math.floor((i / canvas.width) * dataL.length);
                const endIdx = Math.floor(((i + 1) / canvas.width) * dataL.length);
                for (let j = startIdx; j < endIdx; j++) {
                    if (dataL[j] < minL) minL = dataL[j]; if (dataL[j] > maxL) maxL = dataL[j];
                    if (dataR[j] < minR) minR = dataR[j]; if (dataR[j] > maxR) maxR = dataR[j];
                }
                ctx.fillRect(i, amp - maxL * amp, 1, Math.max(1, (maxL - minL) * amp));
                ctx.fillStyle = 'rgba(0, 255, 128, 0.8)';
                ctx.fillRect(i, (3 * amp) - maxR * amp, 1, Math.max(1, (maxR - minR) * amp));
                ctx.fillStyle = 'rgba(0, 240, 255, 0.8)'; // Reset
            }
        } else {
            const amp = canvas.height / 2;
            ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
            for (let i = 0; i < canvas.width; i++) {
                let min = 1.0, max = -1.0;
                const startIdx = Math.floor((i / canvas.width) * dataL.length);
                const endIdx = Math.floor(((i + 1) / canvas.width) * dataL.length);
                for (let j = startIdx; j < endIdx; j++) {
                    if (dataL[j] < min) min = dataL[j]; if (dataL[j] > max) max = dataL[j];
                }
                ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
            }
        }

        const clip = { id: nextClipId++, buffer, timelineStart: 0, audioOffset: 0, duration: buffer.duration, trackId: trackData.id, waveformCanvas: canvas };
        trackData.clips.push(clip);
        renderAudioClipDOM(clip, document.querySelector(`.track-workspace[data-id="${trackData.id}"]`));
    } catch (err) {
        alert("音訊解碼失敗：" + err.message);
    }
    btnPlay.disabled = false; timeDisplay.textContent = '00:00.00'; e.target.value = '';
}

function renderAudioClipDOM(clip, wsEl) {
    const existing = wsEl.querySelector(`.audio-clip[data-id="${clip.id}"]`);
    if (existing) existing.remove();

    const clipEl = document.createElement('div');
    clipEl.className = 'audio-clip'; clipEl.dataset.id = clip.id;
    clipEl.style.width = (clip.duration * PIXELS_PER_SEC) + 'px';
    clipEl.style.left = (clip.timelineStart * PIXELS_PER_SEC) + 'px';
    clipEl.style.height = (TRACK_HEIGHT - 20) + 'px';

    const cCanvas = document.createElement('canvas');
    cCanvas.width = clip.waveformCanvas.width; cCanvas.height = clip.waveformCanvas.height;
    cCanvas.getContext('2d').drawImage(clip.waveformCanvas, 0, 0);
    // Stretch inner canvas dynamically to perfectly fit its full unaltered duration
    cCanvas.style.width = (clip.buffer.duration * PIXELS_PER_SEC) + 'px';
    
    clipEl.appendChild(cCanvas);
    cCanvas.style.transform = `translateX(-${clip.audioOffset * PIXELS_PER_SEC}px)`;
    
    const handleL = document.createElement('div'); handleL.className = 'trim-handle left';
    const handleR = document.createElement('div'); handleR.className = 'trim-handle right';
    clipEl.appendChild(handleL); clipEl.appendChild(handleR);

    clipEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('trim-handle')) return;
        e.stopPropagation();
        const rect = clipEl.getBoundingClientRect(); const offsetX = e.clientX - rect.left;
        draggedElement = { type: 'audio-move', element: clipEl, clip, offsetX };
        clipEl.classList.add('dragging');
    });

    handleL.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        draggedElement = { type: 'audio-trim-left', element: clipEl, clip, startX: e.clientX, initClipStart: clip.timelineStart, initAudioOff: clip.audioOffset, initDur: clip.duration, canvas: cCanvas };
    });

    handleR.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        draggedElement = { type: 'audio-trim-right', element: clipEl, clip, startX: e.clientX, initDur: clip.duration };
    });

    wsEl.appendChild(clipEl);
}

// Global Drag Processor
document.addEventListener('mousemove', (e) => {
    if (!draggedElement) return;

    if (draggedElement.type === 'keyframe') {
        const { element, trackId, keyframeId, wsEl } = draggedElement;
        const rect = wsEl.getBoundingClientRect();
        let x = Math.max(0, e.clientX - rect.left); let y = Math.max(0, Math.min(TRACK_HEIGHT, e.clientY - rect.top));
        const time = x / PIXELS_PER_SEC; const value = Math.round((1 - (y / TRACK_HEIGHT)) * 255);
        element.style.left = x + 'px'; element.style.top = y + 'px';
        const trackData = timelineTracks.find(t => t.id === trackId);
        if (trackData) {
            const kf = trackData.keyframes.find(k => k.id === keyframeId);
            if (kf) {
                kf.time = time; kf.value = value;
                trackData.keyframes.sort((a, b) => a.time - b.time); renderLightCurve(trackData);
            }
        }
    } 
    else if (draggedElement.type === 'audio-move') {
        const { element, clip, offsetX } = draggedElement;
        const wsEl = element.parentElement; const rect = wsEl.getBoundingClientRect();
        let x = (e.clientX - rect.left) - offsetX; x = Math.max(0, x);
        clip.timelineStart = x / PIXELS_PER_SEC; element.style.left = x + 'px';
    }
    else if (draggedElement.type === 'audio-trim-left') {
        const { clip, element, initClipStart, initAudioOff, initDur, canvas, startX } = draggedElement;
        const deltaSecs = (e.clientX - startX) / PIXELS_PER_SEC;
        let newStart = initClipStart + deltaSecs; let newOffset = initAudioOff + deltaSecs; let newDur = initDur - deltaSecs;
        if (newOffset < 0) { const corr = Math.abs(newOffset); newStart += corr; newDur -= corr; newOffset = 0; }
        if (newDur < 0.1) newDur = 0.1;

        clip.timelineStart = newStart; clip.audioOffset = newOffset; clip.duration = newDur;
        element.style.left = (newStart * PIXELS_PER_SEC) + 'px';
        element.style.width = (newDur * PIXELS_PER_SEC) + 'px';
        canvas.style.transform = `translateX(-${newOffset * PIXELS_PER_SEC}px)`;
    }
    else if (draggedElement.type === 'audio-trim-right') {
        const { clip, element, initDur, startX } = draggedElement;
        const deltaSecs = (e.clientX - startX) / PIXELS_PER_SEC;
        let newDur = initDur + deltaSecs;
        if (newDur < 0.1) newDur = 0.1;
        const maxDur = clip.buffer.duration - clip.audioOffset;
        if (newDur > maxDur) newDur = maxDur;
        clip.duration = newDur; element.style.width = (newDur * PIXELS_PER_SEC) + 'px';
    }
});
document.addEventListener('mouseup', () => {
    if (draggedElement) {
        if (draggedElement.element) draggedElement.element.classList.remove('dragging'); draggedElement = null;
    }
});

btnSplitAudio.addEventListener('click', () => {
    timelineTracks.filter(t => t.type === 'audio').forEach(track => {
        const toAdd = [];
        track.clips.forEach(clip => {
            if (pauseTime > clip.timelineStart && pauseTime < clip.timelineStart + clip.duration) {
                const firstDur = pauseTime - clip.timelineStart;
                const secondDur = clip.duration - firstDur;
                clip.duration = firstDur;
                const newClip = {
                    id: nextClipId++, buffer: clip.buffer, timelineStart: pauseTime,
                    audioOffset: clip.audioOffset + firstDur, duration: secondDur, trackId: track.id, waveformCanvas: clip.waveformCanvas
                };
                toAdd.push(newClip);
            }
        });
        toAdd.forEach(newC => {
            track.clips.push(newC);
            renderAudioClipDOM(newC, document.querySelector(`.track-workspace[data-id="${track.id}"]`));
        });
        track.clips.filter(c => !toAdd.includes(c)).forEach(c => {
             renderAudioClipDOM(c, document.querySelector(`.track-workspace[data-id="${track.id}"]`));
        });
    });
});

/* --- PLAYBACK SCHEDULER --- */
btnPlay.addEventListener('click', async () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (isPlaying) {
        pauseAudioNodes(); pauseTime = audioContext.currentTime - startTime; isPlaying = false;
        btnPlay.textContent = '▶ 播放';
    } else {
        btnPlay.textContent = '...';
        if (audioContext.state === 'suspended') await audioContext.resume();
        const latencyComp = audioContext.outputLatency || 0;
        
        isPlaying = true; btnPlay.textContent = '⏸ 暫停';
        startTime = audioContext.currentTime - pauseTime;
        playAudioNodes(pauseTime); // Latency comp visually removed as wait fixes actual hardware pipe. 
        requestAnimationFrame(updatePlayhead);
    }
});

btnStop.addEventListener('click', () => {
    pauseAudioNodes(); isPlaying = false; pauseTime = 0;
    btnPlay.textContent = '▶ 播放'; updatePlayheadUI(0);
});

function playAudioNodes(currentTime) {
    activeSources = [];
    timelineTracks.filter(t => t.type === 'audio').forEach(track => {
        if (!track.gainNode) {
            track.gainNode = audioContext.createGain();
            track.gainNode.connect(audioContext.destination);
            track.gainNode.gain.value = track.volume;
        }

        track.clips.forEach(clip => {
            if (clip.timelineStart + clip.duration > currentTime) {
                const source = audioContext.createBufferSource();
                source.buffer = clip.buffer; source.connect(track.gainNode);
                let pDelay = 0; let bOff = clip.audioOffset; let pDur = clip.duration;
                if (currentTime > clip.timelineStart) {
                    const elapsed = currentTime - clip.timelineStart;
                    bOff += elapsed; pDur -= elapsed; pDelay = 0;
                } else { pDelay = clip.timelineStart - currentTime; }
                source.start(audioContext.currentTime + pDelay, bOff, pDur);
                activeSources.push(source);
            }
        });
    });
}

function pauseAudioNodes() { activeSources.forEach(s => s.stop()); activeSources = []; }

function updatePlayhead() {
    if (!isPlaying) return;
    const ct = audioContext.currentTime - startTime;
    updatePlayheadUI(ct); processDmxEngine(ct);
    requestAnimationFrame(updatePlayhead);
}

function updatePlayheadUI(time) {
    const x = time * PIXELS_PER_SEC; playhead.style.left = x + 'px'; timeDisplay.textContent = formatTime(time);
    const bounds = timelineEditorRight.getBoundingClientRect(); const scrollLeft = timelineEditorRight.scrollLeft;
    if (x > scrollLeft + bounds.width - 100) timelineEditorRight.scrollLeft = x - bounds.width / 2;
}

function processDmxEngine(currentTime) {
    if (!window.dmxData) return;
    let uiNeedsUpdate = false;
    timelineTracks.filter(t => t.type === 'light').forEach(track => {
        if (track.keyframes.length === 0) return;
        let v = 0; const kfs = track.keyframes;
        if (currentTime <= kfs[0].time) v = kfs[0].value;
        else if (currentTime >= kfs[kfs.length - 1].time) v = kfs[kfs.length - 1].value;
        else {
            for (let i = 0; i < kfs.length - 1; i++) {
                if (currentTime >= kfs[i].time && currentTime < kfs[i+1].time) {
                    const t1 = kfs[i].time, v1 = kfs[i].value; const t2 = kfs[i+1].time, v2 = kfs[i+1].value;
                    if (t2 - t1 <= 0.02) v = v2;
                    else v = Math.round(v1 + ((currentTime - t1) / (t2 - t1)) * (v2 - v1)); 
                    break;
                }
            }
        }
        if (window.dmxData[track.channel] !== v) { window.dmxData[track.channel] = v; uiNeedsUpdate = true; }
    });
    if (uiNeedsUpdate && typeof window.updateSlidersForPage === 'function') window.updateSlidersForPage();
}

function formatTime(secs) {
    const m = Math.floor(secs / 60); const s = (secs % 60).toFixed(2);
    return `${m < 10 ? '0' : ''}${m}:${s.padStart(5, '0')}`;
}
