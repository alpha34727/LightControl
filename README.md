# 💡 Light Control Pro

[![WebHID](https://img.shields.io/badge/API-WebHID-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)
[![WebAudio](https://img.shields.io/badge/API-Web%20Audio-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Standard](https://img.shields.io/badge/UI-NLE--Style-blueviolet.svg)](#)

**Light Control Pro** 是一款專業的非線性編輯 (NLE) 風格燈光控制軟體，專為 USB-DMX512 設備設計。它將傳統的手動推桿控制與現代影音編輯器（如 Premiere Pro）的時程軸功能完美結合，讓燈效設計變得如同剪輯影片般直觀。

---

## ✨ 核心特色

### 🎚️ 專業手動控制面版
- **512 通道支持**：完整支持標準 DMX512 協議。
- **分頁管理**：每頁 32 通道的直觀布局，快速切換不同分組。
- **即時反饋**：手動推桿數值即時同步至 DMX 核心引擎。

### 🎞️ NLE 時程軸編輯器
- **多軌編排**：支持多條「燈光軌道」與「音訊軌道」並行作業。
- **關鍵幀 (Keyframe) 系統**：
  - 支持手動推桿即時錄製關鍵幀。
  - 雙擊時程軸手動添加關鍵幀。
  - 自動生成平滑的燈光過渡曲線。
- **音訊視覺化**：動態生成音訊波形圖，實現精確的音畫同步。
- **剪輯功能**：支持音訊片段的「移動」、「修剪 (Trimming)」與「分割 (Splitting)」。

### 🎨 現代化視覺設計
- **極致設計**：採用磨砂玻璃 (Glassmorphism) 風格與響應式全屏布局。
- **自由縮放**：獨立控制 X 軸（時間）與 Y 軸（軌道高度）的縮放倍率。
- **流暢體驗**：基於 `requestAnimationFrame` 的高頻率 DMX 發送與介面更新。

---

## 🛠️ 技術堆棧

- **核心語言**：Vanilla JavaScript (ES6+), HTML5, CSS3.
- **關鍵組件**：
  - **WebHID API**：直接與 USB-DMX512 硬體通信。
  - **Web Audio API**：處理音訊解碼、多軌播放與音量增益。
  - **Canvas API**：渲染高精度的時間尺與音訊波形。

---

## 🚀 快速上手

### 1. 系統需求
- **瀏覽器**：Google Chrome 89+ 或 Microsoft Edge (需支持 WebHID)。
- **硬體**：USB-DMX512 控制器 (支持 VID: `0x16C0`, PID: `0x27D9`)。

### 2. 連接設備
1. 點擊導覽列右上角的 **「連接 USB-DMX」**。
2. 在彈出的視窗中選擇您的 DMX 設備並點擊「連線」。
3. 狀態燈變為綠色即表示已成功連接。

### 3. 使用流程
- **添加軌道**：點擊上方控制列的 `+ 燈光軌道` 或 `+ 音訊軌道`。
- **匯入音樂**：在音訊軌道的 Header 處選擇檔案，波形將自動生成。
- **設計燈效**：
  - 手動模式：直接調整上方推桿。
  - 自動模式：在燈光軌道上雙擊添加關鍵幀，或在播放時調整推桿錄製。
- **控制播放**：使用播放/暫停按鈕或點擊時間尺定位播放頭。

---

## 📌 注意事項
- 錄製關鍵幀前，請確保燈光軌道的 `CH` 已設置為對應的 DMX 通道。
- 建議在刪除軌道前先暫停播放，以確保音軌釋放。

---

## 📄 授權
本项目僅供學習與開發參考使用。
