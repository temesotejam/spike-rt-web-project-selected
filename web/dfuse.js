import { DFU_STATE, DFU_STATUS_OK } from "./dfu.js";

export const SPIKE_BOOT_ADDRESS = 0x08000000;
export const SPIKE_RT_LOAD_ADDRESS = 0x08008000;
export const SPIKE_RT_MAX_BYTES = 992 * 1024;
export const SPIKE_FLASH_END = 0x08100000;

const DFUSE_SET_ADDRESS = 0x21;
const DFUSE_ERASE_SECTOR = 0x41;

const FLASH_SEGMENTS = Object.freeze([
  { start: 0x08000000, end: 0x08010000, sectorSize: 16 * 1024 },
  { start: 0x08010000, end: 0x08020000, sectorSize: 64 * 1024 },
  { start: 0x08020000, end: 0x08100000, sectorSize: 128 * 1024 },
]);

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedResetError(error) {
  return /disconnected|unavailable|device was disconnected|NotFoundError|NetworkError|transfer error|Unable to reset/i.test(
    messageOf(error),
  );
}

function commandPayload(command, address) {
  const payload = new ArrayBuffer(5);
  const view = new DataView(payload);
  view.setUint8(0, command);
  view.setUint32(1, address, true);
  return payload;
}

function segmentFor(address) {
  return FLASH_SEGMENTS.find(
    (segment) => segment.start <= address && address < segment.end,
  );
}

function sectorsForRange(startAddress, length) {
  if (!Number.isInteger(startAddress) || !Number.isInteger(length) || length <= 0) {
    throw new Error("書き込み範囲が不正です。");
  }
  const endAddress = startAddress + length;
  if (
    startAddress !== SPIKE_RT_LOAD_ADDRESS ||
    endAddress > SPIKE_FLASH_END ||
    length > SPIKE_RT_MAX_BYTES
  ) {
    throw new Error(
      `許可されたアプリ領域外です: 0x${startAddress.toString(16)} - 0x${endAddress.toString(16)}`,
    );
  }

  const sectors = [];
  let address = startAddress;
  while (address < endAddress) {
    const segment = segmentFor(address);
    if (!segment) {
      throw new Error(`フラッシュマップ外のアドレスです: 0x${address.toString(16)}`);
    }
    const index = Math.floor((address - segment.start) / segment.sectorSize);
    const sectorStart = segment.start + index * segment.sectorSize;
    if (!sectors.includes(sectorStart)) sectors.push(sectorStart);
    address = sectorStart + segment.sectorSize;
  }
  return sectors;
}

export class SpikeDfuSeFlasher {
  constructor(device, callbacks = {}) {
    this.device = device;
    this.log = callbacks.log ?? (() => {});
    this.onProgress = callbacks.onProgress ?? (() => {});
  }

  async runCommand(command, address, commandName) {
    await this.device.download(commandPayload(command, address), 0);
    const status = await this.device.pollUntil(
      (current) => current.state === DFU_STATE.DNLOAD_IDLE,
    );
    if (status.status !== DFU_STATUS_OK || status.state !== DFU_STATE.DNLOAD_IDLE) {
      throw new Error(
        `${commandName}に失敗しました (state=${status.state}, status=${status.status})。`,
      );
    }
  }

  setAddress(address) {
    return this.runCommand(DFUSE_SET_ADDRESS, address, "アドレス設定");
  }

  eraseSector(address) {
    return this.runCommand(DFUSE_ERASE_SECTOR, address, "セクタ消去");
  }

  async erase(startAddress, length) {
    const sectors = sectorsForRange(startAddress, length);
    this.log(`消去対象: ${sectors.length}セクタ`);
    this.onProgress("erase", 0, sectors.length);
    for (let index = 0; index < sectors.length; index += 1) {
      const address = sectors[index];
      this.log(`消去中: 0x${address.toString(16).padStart(8, "0")}`);
      await this.eraseSector(address);
      this.onProgress("erase", index + 1, sectors.length);
    }
  }

  async write(startAddress, firmware) {
    const transferSize = this.device.transferSize;
    let offset = 0;
    this.onProgress("write", 0, firmware.byteLength);

    while (offset < firmware.byteLength) {
      const length = Math.min(transferSize, firmware.byteLength - offset);
      const address = startAddress + offset;
      await this.setAddress(address);
      const chunk = firmware.slice(offset, offset + length);
      const written = await this.device.download(chunk, 2);
      const status = await this.device.pollUntil(
        (current) => current.state === DFU_STATE.DNLOAD_IDLE,
      );
      if (status.status !== DFU_STATUS_OK || status.state !== DFU_STATE.DNLOAD_IDLE) {
        throw new Error(
          `書き込みに失敗しました (0x${address.toString(16)}, state=${status.state}, status=${status.status})。`,
        );
      }
      if (written !== length) {
        throw new Error(`USB転送サイズが一致しません (${written}/${length})。`);
      }
      offset += written;
      this.onProgress("write", offset, firmware.byteLength);
    }
  }

  async verifyWriteState() {
    this.onProgress("verify", 0, 1);
    const status = await this.device.getStatus();
    if (status.status !== DFU_STATUS_OK || status.state !== DFU_STATE.DNLOAD_IDLE) {
      throw new Error(
        `書き込み完了状態を確認できません (state=${status.state}, status=${status.status})。`,
      );
    }
    this.onProgress("verify", 1, 1);
  }

  async manifest() {
    // SPIKE-RT v0.2.0が利用するpydfu.pyと同じく、DFU終了時は
    // SPIKE-RTの配置先0x08008000ではなくブート先0x08000000を指定する。
    await this.setAddress(SPIKE_BOOT_ADDRESS);
    try {
      await this.device.download(new ArrayBuffer(0), 0);
      await this.device.pollUntil(
        (status) =>
          status.state === DFU_STATE.MANIFEST ||
          status.state === DFU_STATE.MANIFEST_WAIT_RESET ||
          status.state === DFU_STATE.IDLE,
        15000,
      );
    } catch (error) {
      if (!isExpectedResetError(error)) {
        throw error;
      }
      this.log("HubがDFU終了・再起動のためUSBから切断されました。");
    }

    try {
      await this.device.usbDevice.reset();
    } catch (error) {
      if (!isExpectedResetError(error)) {
        throw error;
      }
    }
  }

  async flash(firmware, startAddress = SPIKE_RT_LOAD_ADDRESS) {
    if (!(firmware instanceof ArrayBuffer)) {
      throw new TypeError("ファームウェアはArrayBufferで指定してください。");
    }
    sectorsForRange(startAddress, firmware.byteLength);

    this.log(`転送サイズ: ${this.device.transferSize} bytes`);
    this.log("DFU状態を初期化しています。");
    this.onProgress("prepare", 0, 1);
    await this.device.ensureIdle();
    this.onProgress("prepare", 1, 1);

    await this.erase(startAddress, firmware.byteLength);
    this.log("ファームウェアを書き込んでいます。");
    await this.write(startAddress, firmware);
    this.log("書き込み後のDFU状態を確認しています。");
    await this.verifyWriteState();
    this.log("書き込みに成功しました。Hubを再起動します。");
    this.onProgress("manifest", 0, 1);
    await this.manifest();
    this.onProgress("manifest", 1, 1);
  }
}

export async function flashSpikeRtFirmware(device, firmware, callbacks = {}) {
  const flasher = new SpikeDfuSeFlasher(device, callbacks);
  return flasher.flash(firmware, SPIKE_RT_LOAD_ADDRESS);
}
