import {
  connectSpikeDfu,
  isWebUsbAvailable,
  SPIKE_DFU_PRODUCT_ID,
  SPIKE_DFU_VENDOR_ID,
} from "./dfu.js";
import {
  flashSpikeRtFirmware,
  SPIKE_RT_LOAD_ADDRESS,
  SPIKE_RT_MAX_BYTES,
} from "./dfuse.js";

const elements = {
  description: document.querySelector("#app-description"),
  warning: document.querySelector("#app-warning"),
  loadLatest: document.querySelector("#load-latest"),
  localFile: document.querySelector("#local-file"),
  download: document.querySelector("#download"),
  firmwareStatus: document.querySelector("#firmware-status"),
  firmwareProgram: document.querySelector("#firmware-program"),
  firmwareName: document.querySelector("#firmware-name"),
  firmwareSize: document.querySelector("#firmware-size"),
  firmwareSha: document.querySelector("#firmware-sha"),
  sourceCommit: document.querySelector("#source-commit"),
  spikeRtCommit: document.querySelector("#spike-rt-commit"),
  loadAddress: document.querySelector("#load-address"),
  browserStatus: document.querySelector("#browser-status"),
  deviceStatus: document.querySelector("#device-status"),
  transferSize: document.querySelector("#transfer-size"),
  connect: document.querySelector("#connect"),
  disconnect: document.querySelector("#disconnect"),
  flash: document.querySelector("#flash"),
  confirmSafety: document.querySelector("#confirm-safety"),
  progress: document.querySelector("#progress"),
  progressLabel: document.querySelector("#progress-label"),
  log: document.querySelector("#log"),
};

const PHASE_RANGES = Object.freeze({
  prepare: [0, 5, "準備中"],
  erase: [5, 30, "フラッシュ消去中"],
  write: [30, 75, "書き込み中"],
  verify: [75, 95, "読み戻し検証中"],
  manifest: [95, 100, "再起動中"],
});

let loadedFirmware = null;
let dfuDevice = null;
let busy = false;

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function appendLog(message) {
  const timestamp = new Date().toLocaleTimeString("ja-JP");
  elements.log.textContent += `\n[${timestamp}] ${message}`;
  elements.log.scrollTop = elements.log.scrollHeight;
}

function formatBytes(bytes) {
  return `${new Intl.NumberFormat("ja-JP").format(bytes)} bytes`;
}

function hex(value, width = 4) {
  return `0x${value.toString(16).padStart(width, "0")}`;
}

async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function updateControls() {
  const webUsbReady = isWebUsbAvailable();
  elements.loadLatest.disabled = busy;
  elements.localFile.disabled = busy;
  elements.download.disabled = busy || !loadedFirmware;
  elements.connect.disabled = busy || !webUsbReady || Boolean(dfuDevice);
  elements.disconnect.disabled = busy || !dfuDevice;
  elements.confirmSafety.disabled = busy;
  elements.flash.disabled =
    busy ||
    !dfuDevice ||
    !loadedFirmware ||
    !elements.confirmSafety.checked;
}

function setBusy(value) {
  busy = value;
  updateControls();
}

function setProgress(phase, done, total) {
  const [start, end, label] = PHASE_RANGES[phase] ?? [0, 100, phase];
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const percent = start + (end - start) * ratio;
  elements.progress.value = percent;
  elements.progressLabel.textContent = `${label}: ${Math.round(percent)}%`;
}

function clearConnectedDevice(message = "未接続") {
  dfuDevice = null;
  elements.deviceStatus.textContent = message;
  elements.deviceStatus.className = "";
  elements.transferSize.textContent = "—";
  updateControls();
}

function validateFirmware(arrayBuffer, manifest = null) {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength === 0) {
    throw new Error("空のファイルは使用できません。");
  }
  if (arrayBuffer.byteLength > SPIKE_RT_MAX_BYTES) {
    throw new Error(
      `ファイルが大きすぎます。上限は${formatBytes(SPIKE_RT_MAX_BYTES)}です。`,
    );
  }
  if (
    manifest?.loadAddress &&
    Number.parseInt(manifest.loadAddress, 16) !== SPIKE_RT_LOAD_ADDRESS
  ) {
    throw new Error(`manifest.jsonの書き込み先が不正です: ${manifest.loadAddress}`);
  }
  if (manifest?.size && Number(manifest.size) !== arrayBuffer.byteLength) {
    throw new Error("manifest.jsonのサイズとasp.binが一致しません。");
  }
}

async function setFirmware({ name, arrayBuffer, manifest = null }) {
  validateFirmware(arrayBuffer, manifest);
  const sha256 = await sha256Hex(arrayBuffer);
  if (
    manifest?.sha256 &&
    manifest.sha256.toLowerCase() !== sha256.toLowerCase()
  ) {
    throw new Error("manifest.jsonのSHA-256とasp.binが一致しません。");
  }

  const programId = manifest?.appId ?? "local";
  const programName = manifest?.appName ?? "ローカルファイル";
  loadedFirmware = {
    name,
    downloadName: programId === "local" ? name : `${programId}-${name}`,
    arrayBuffer,
    sha256,
    manifest,
    programName,
  };

  elements.firmwareStatus.textContent = "読込済み";
  elements.firmwareStatus.className = "status-good";
  elements.firmwareProgram.textContent = `${programName} (${programId})`;
  elements.firmwareName.textContent = name;
  elements.firmwareSize.textContent = formatBytes(arrayBuffer.byteLength);
  elements.firmwareSha.textContent = sha256;
  elements.sourceCommit.textContent = manifest?.sourceCommit ?? "ローカルファイル";
  elements.spikeRtCommit.textContent = manifest?.spikeRtCommit ?? "—";
  elements.loadAddress.textContent =
    manifest?.loadAddress ?? hex(SPIKE_RT_LOAD_ADDRESS, 8);
  elements.description.textContent = manifest?.description || programName;
  elements.warning.textContent = manifest?.warning || "";
  elements.warning.hidden = !manifest?.warning;
  appendLog(`${programName}の${name}を読み込み、SHA-256を確認しました。`);
  updateControls();
}

async function loadPublishedFirmware() {
  setBusy(true);
  elements.firmwareStatus.textContent = "取得中";
  elements.firmwareStatus.className = "";
  try {
    const manifestResponse = await fetch(
      `./firmware/manifest.json?t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!manifestResponse.ok) {
      throw new Error(
        `manifest.jsonの取得に失敗しました (${manifestResponse.status})。選択ビルドとPages公開を実行してください。`,
      );
    }
    const manifest = await manifestResponse.json();
    const firmwareUrl = new URL(`./firmware/${manifest.file}`, window.location.href);
    firmwareUrl.searchParams.set("commit", manifest.sourceCommit ?? Date.now().toString());
    const firmwareResponse = await fetch(firmwareUrl, { cache: "no-store" });
    if (!firmwareResponse.ok) {
      throw new Error(`asp.binの取得に失敗しました (${firmwareResponse.status})。`);
    }
    await setFirmware({
      name: manifest.file,
      arrayBuffer: await firmwareResponse.arrayBuffer(),
      manifest,
    });
  } catch (error) {
    elements.firmwareStatus.textContent = "失敗";
    elements.firmwareStatus.className = "status-error";
    appendLog(messageOf(error));
  } finally {
    setBusy(false);
  }
}

async function loadLocalFirmware(file) {
  if (!file) return;
  setBusy(true);
  try {
    await setFirmware({ name: file.name, arrayBuffer: await file.arrayBuffer() });
  } catch (error) {
    elements.firmwareStatus.textContent = "失敗";
    elements.firmwareStatus.className = "status-error";
    appendLog(messageOf(error));
  } finally {
    setBusy(false);
  }
}

function downloadFirmware() {
  if (!loadedFirmware) return;
  const blob = new Blob([loadedFirmware.arrayBuffer], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = loadedFirmware.downloadName || "asp.bin";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function connectHub() {
  setBusy(true);
  elements.deviceStatus.textContent = "接続中";
  elements.deviceStatus.className = "";
  try {
    dfuDevice = await connectSpikeDfu({ log: appendLog });
    elements.deviceStatus.textContent = `${dfuDevice.label} 接続済み`;
    elements.deviceStatus.className = "status-good";
    elements.transferSize.textContent = formatBytes(dfuDevice.transferSize);
    appendLog(
      `接続成功: VID=${hex(SPIKE_DFU_VENDOR_ID)}, PID=${hex(SPIKE_DFU_PRODUCT_ID)}, transfer=${dfuDevice.transferSize}`,
    );
  } catch (error) {
    clearConnectedDevice("接続失敗");
    elements.deviceStatus.className = "status-error";
    appendLog(messageOf(error));
  } finally {
    setBusy(false);
  }
}

async function disconnectHub() {
  if (!dfuDevice) return;
  setBusy(true);
  const current = dfuDevice;
  try {
    await current.close();
    appendLog("Hubとの接続を解除しました。");
  } finally {
    clearConnectedDevice();
    setBusy(false);
  }
}

async function flashFirmware() {
  if (!dfuDevice || !loadedFirmware) return;
  if (!elements.confirmSafety.checked) {
    appendLog("安全確認のチェックを入れてください。");
    return;
  }

  const confirmed = window.confirm(
    `${loadedFirmware.programName} / ${loadedFirmware.name} ` +
      `(${formatBytes(loadedFirmware.arrayBuffer.byteLength)})を` +
      ` ${hex(SPIKE_RT_LOAD_ADDRESS, 8)}へ書き込みます。\n\n` +
      "処理中はUSBケーブルを抜かないでください。続行しますか？",
  );
  if (!confirmed) return;

  setBusy(true);
  elements.progress.value = 0;
  elements.progressLabel.textContent = "書き込みを開始します";
  appendLog(`書き込み処理を開始します: ${loadedFirmware.programName}`);

  try {
    await flashSpikeRtFirmware(dfuDevice, loadedFirmware.arrayBuffer, {
      log: appendLog,
      onProgress: setProgress,
    });
    elements.progress.value = 100;
    elements.progressLabel.textContent = "完了: 100%";
    appendLog("書き込み・読み戻し検証・再起動要求が完了しました。");
    clearConnectedDevice("再起動済み（USB切断）");
  } catch (error) {
    elements.progressLabel.textContent = "失敗";
    appendLog(`書き込み失敗: ${messageOf(error)}`);
    try {
      await dfuDevice?.ensureIdle();
    } catch (recoveryError) {
      appendLog(
        `DFU状態の復旧に失敗しました。HubをDFUモードで接続し直してください: ${messageOf(recoveryError)}`,
      );
    }
  } finally {
    setBusy(false);
  }
}

elements.loadLatest.addEventListener("click", loadPublishedFirmware);
elements.localFile.addEventListener("change", (event) =>
  loadLocalFirmware(event.target.files[0]),
);
elements.download.addEventListener("click", downloadFirmware);
elements.connect.addEventListener("click", connectHub);
elements.disconnect.addEventListener("click", disconnectHub);
elements.flash.addEventListener("click", flashFirmware);
elements.confirmSafety.addEventListener("change", updateControls);

if (navigator.usb) {
  navigator.usb.addEventListener("disconnect", (event) => {
    if (dfuDevice?.usbDevice === event.device) {
      appendLog("HubがUSBから切断されました。");
      clearConnectedDevice("切断済み");
    }
  });
}

if (isWebUsbAvailable()) {
  elements.browserStatus.textContent = "利用可能（Chrome / Edge）";
  elements.browserStatus.className = "status-good";
} else {
  elements.browserStatus.textContent = "利用不可";
  elements.browserStatus.className = "status-error";
  appendLog("WebUSBを利用できません。HTTPS上のChromeまたはEdgeで開いてください。");
}

updateControls();
void loadPublishedFirmware();
