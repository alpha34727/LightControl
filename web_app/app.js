/**
 * Light Control Pro - App Logic
 * DMX512 communication via WebHID
 */

// USB Constants
const VENDOR_ID = 0x16C0;
const PRODUCT_ID = 0x27D9;

// DMX Constants
const NUM_CHANNELS = 512;
const CHANNELS_PER_PAGE = 32;
const NUM_PAGES = Math.ceil(NUM_CHANNELS / CHANNELS_PER_PAGE);

// DMX Protocol Specifics
const initData = new Uint8Array([0xFC, 0x26].concat(Array(62).fill(0x00))); // 64 bytes total
const dmxHeaders = [
    [111, 184,   7, 139, 112, 142,   7, 191, 191,   0],
    [  9, 222,   7, 142, 112, 232,   7, 217, 217,  54],
    [220,   4,   8, 134, 128,  50,   8,  12,  12, 108],
    [242,  42,   8, 136, 128,  28,   8,  34,  34, 162],
    [136,  80,   8, 136, 128, 102,   8,  88,  88, 216],
    [174, 118,   8, 135, 144,  64,   8, 126, 126,  14],
    [ 68, 156,   8, 141, 144, 170,   8, 148, 148,  68],
    [ 26, 194,   8, 139, 144, 244,   8, 202, 202, 122],
    [ 48, 232,   8, 133, 144, 222,   8, 224, 224, 176],
    [215,  14,   9, 142, 128,  20,   9,   7,   7, 230]
];

// Application State
let device = null;
let dmxData = new Uint8Array(540); // Matches Python format: 10 packets * 54 bytes
let currentPage = 0;
let isTransmitting = false;

// DOM Elements
const btnConnect = document.getElementById('btn-connect');
const statusPanel = document.getElementById('connection-status');
const statusText = statusPanel.querySelector('.status-text');
const pageButtonsContainer = document.getElementById('page-buttons');
const slidersGrid = document.getElementById('sliders-grid');
const pageLabel = document.getElementById('current-page-label');

// Initialize UI
function initUI() {
    // Generate Page Buttons
    for (let i = 0; i < NUM_PAGES; i++) {
        const startCh = i * CHANNELS_PER_PAGE;
        const endCh = Math.min((i + 1) * CHANNELS_PER_PAGE - 1, NUM_CHANNELS - 1);
        
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = `${startCh}-${endCh}`;
        btn.onclick = () => switchPage(i);
        pageButtonsContainer.appendChild(btn);
    }

    // Generate 32 Sliders
    for (let i = 0; i < CHANNELS_PER_PAGE; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'slider-wrapper';

        const label = document.createElement('div');
        label.className = 'slider-label-top';
        label.id = `label-ch-${i}`;
        label.textContent = `CH ${i}`;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'vertical-slider';
        slider.min = 0;
        slider.max = 255;
        slider.value = 0;
        slider.id = `slider-${i}`;
        
        const valDisplay = document.createElement('div');
        valDisplay.className = 'slider-value';
        valDisplay.id = `val-${i}`;
        valDisplay.textContent = '0';

        // Event listener for value change
        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            valDisplay.textContent = val;
            const globalCh = currentPage * CHANNELS_PER_PAGE + i;
            if (globalCh < NUM_CHANNELS) {
                dmxData[globalCh] = val; // Assuming channel array maps 1:1, up to 512
            }
        });

        wrapper.appendChild(label);
        wrapper.appendChild(slider);
        wrapper.appendChild(valDisplay);
        slidersGrid.appendChild(wrapper);
    }

    updateSlidersForPage();
}

// Switch Page Logic
function switchPage(pageIndex) {
    currentPage = pageIndex;

    // Update buttons
    document.querySelectorAll('.page-btn').forEach((btn, idx) => {
        if (idx === pageIndex) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const startCh = pageIndex * CHANNELS_PER_PAGE;
    const endCh = Math.min((pageIndex + 1) * CHANNELS_PER_PAGE - 1, NUM_CHANNELS - 1);
    pageLabel.textContent = `CH ${startCh} - ${endCh}`;

    updateSlidersForPage();
}

// Update slider values to match current page's dmxData array
function updateSlidersForPage() {
    const startCh = currentPage * CHANNELS_PER_PAGE;
    for (let i = 0; i < CHANNELS_PER_PAGE; i++) {
        const globalCh = startCh + i;
        const wrapper = document.getElementById(`slider-${i}`).parentElement;
        
        if (globalCh < NUM_CHANNELS) {
            wrapper.style.display = 'flex';
            document.getElementById(`label-ch-${i}`).textContent = `CH ${globalCh}`;
            const val = dmxData[globalCh] || 0;
            document.getElementById(`slider-${i}`).value = val;
            document.getElementById(`val-${i}`).textContent = val;
        } else {
            // Hide sliders beyond channel 511
            wrapper.style.display = 'none';
        }
    }
}

// WebHID Connection Request
async function connectHID() {
    if (!navigator.hid) {
        alert('此瀏覽器不支援 WebHID API，請使用 Google Chrome 89+。');
        return;
    }

    try {
        const devices = await navigator.hid.requestDevice({
            filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }]
        });

        if (devices.length === 0) return;
        
        device = devices[0];
        await device.open();
        
        console.log(`已開啟設備: ${device.productName}`);
        
        updateConnectionStatus(true);
        startDmxLoop();

    } catch (error) {
        console.error('設備連接錯誤:', error);
        alert('無法連接設備: ' + error.message);
    }
}

// Update Header Connection Status Element
function updateConnectionStatus(isConnected) {
    if (isConnected) {
        statusPanel.classList.remove('disconnected');
        statusPanel.classList.add('connected');
        statusText.textContent = '已連接 DMX512';
        btnConnect.textContent = '斷開連接';
        
        btnConnect.onclick = async () => {
            if (device && device.opened) {
                isTransmitting = false;
                await device.close();
                device = null;
                updateConnectionStatus(false);
            }
        };
    } else {
        statusPanel.classList.remove('connected');
        statusPanel.classList.add('disconnected');
        statusText.textContent = '未連接設備';
        btnConnect.textContent = '連接 USB-DMX512';
        btnConnect.onclick = connectHID;
    }
}

// Main transmission loop
async function startDmxLoop() {
    if (!device || !device.opened) return;
    
    // Send initialization
    try {
        await device.sendReport(0, initData);
        await device.sendReport(0, initData);
    } catch (e) {
        console.warn("Init send failed, continuing anyway:", e);
    }
    
    isTransmitting = true;
    
    // Transmission interval (~30ms)
    async function transmitLoop() {
        if (!isTransmitting || !device.opened) return;
        
        try {
            for (let i = 0; i < 10; i++) {
                const packetData = new Uint8Array(64);
                
                // Copy header (10 bytes)
                const header = dmxHeaders[i];
                for (let j = 0; j < 10; j++) {
                    packetData[j] = header[j];
                }
                
                // Copy channel data (54 bytes) -> Total 64 bytes
                const chOffset = i * 54;
                for (let c = 0; c < 54; c++) {
                    packetData[10 + c] = dmxData[chOffset + c];
                }
                
                await device.sendReport(0, packetData);
            }
        } catch (error) {
            console.error('發送錯誤:', error);
            if (error.name === 'NetworkError' || !device.opened) {
                isTransmitting = false;
                device = null;
                updateConnectionStatus(false);
                return;
            }
        }
        
        setTimeout(transmitLoop, 30);
    }
    
    transmitLoop();
}

// Event Listeners for existing devices
navigator.hid.addEventListener('disconnect', event => {
    if (device && event.device === device) {
        isTransmitting = false;
        device = null;
        updateConnectionStatus(false);
        console.log("設備已斷開");
    }
});

// Setup Initial UI
btnConnect.onclick = connectHID;
window.addEventListener('DOMContentLoaded', initUI);
