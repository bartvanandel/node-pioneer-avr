/**
 * To control a Pioneer receiver via IP protocol.
 * Tested with VSX-2021, SC-1223
 */

import { connect as _connect } from 'node:net';
import { EventEmitter } from 'node:events';

import { ListeningModes, PlayingListeningModes, InputChange } from './constants';
import { Inputs } from './constants/Inputs';

let logLevel = 0;
let debugLog = console.log;

/**
 * VSX client
 *
 * Important options include host and port,
 * e.g.:
 *
 * ```
 * const options = {
 *   port: 23,
 *   host: '192.168.1.123',
 *   logLevel: 1
 * };
 * ```
 */
class VSX extends EventEmitter {
  constructor(options) {
    super();

    this.client = this.connect(options);

    // Initialize input names from `InputChange` defaults
    this.inputNames = { ...InputChange };

    logLevel = options.logLevel;

    if (options.debugLog) {
      debugLog = options.debugLog;
      debugLog('configured custom debug logger');
    }
  }

  connect(options) {
    const client = _connect(options);

    client.on('connect', this.handleConnection.bind(this));
    client.on('data', this.handleData.bind(this));
    client.on('end', this.handleEnd.bind(this));
    client.on('error', this.handleError.bind(this));

    return client;
  }

  query() {
    const commands = [
      // query power state (main zone, zone 2, zone 3, zone 4)
      '?P',
      '?AP',
      '?BP',
      '?ZEP',

      // query selected input (main zone, zone 2, zone 3, zone 4)
      '?F',
      '?ZS',
      '?ZT',
      '?ZEA',

      // query volume state (main zone, zone 2, zone 3)
      '?V',
      '?ZV',
      '?YV',

      // query mute state (main zone, zone 2, zone 3)
      '?M',
      '?Z2M',
      '?Z3M',

      // query listening mode (listening mode, playing listening mode (for display))
      '?S',
      '?L',

      // Input names
      ...Object.keys(InputChange).map((id) => `?RGB${id}`),
    ];

    let timeout = 100;
    const executeCommandFactory = (command) => () => this.client.write(`${command}\r`);
    for (const command of commands) {
      setTimeout(executeCommandFactory(command), timeout);
      timeout += 100;
    }

    return timeout;
  }

  /**
   * Turn unit power on or off
   */
  power(on, zone = 1) {
    const zones = {
      1: { name: 'main', cmd: 'P' },
      2: { name: 'zone 2', cmd: 'AP' },
      3: { name: 'zone 3', cmd: 'BP' },
      4: { name: 'zone 4', cmd: 'ZEP' },
    };

    const { name, cmd } = zones[zone];

    if (logLevel >= 1) {
      console.log(`turning ${name} power ${on ? 'ON' : 'OFF'}`);
    }
    this.client.write(`${cmd}P${on ? 'O' : 'F'}\r`);
  }

  /**
   * Turn mute on or off
   */
  mute(on, zone = 1) {
    const zones = {
      1: { name: 'main', cmd: 'M' },
      2: { name: 'zone 2', cmd: 'Z2M' },
      3: { name: 'zone 3', cmd: 'Z3M' },
      // 4: { name: 'zone 4', cmd: 'Z4M' }
    };

    const { name, cmd } = zones[zone];

    if (logLevel >= 1) {
      console.log(`turning ${name} mute ${on ? 'ON' : 'OFF'}`);
    }
    this.client.write(`${cmd}P${on ? 'O' : 'F'}\r`);
  }

  /**
   *
   * @param {Object} db from -80 to +12
   */
  volume(db) {
    // [0 .. 185] 1 = -80dB , 161 = 0dB, 185 = +12dB
    if (logLevel >= 1) {
      console.log('setting volume db: ' + db);
    }
    let val = 0;
    if (typeof db === 'undefined' || db === null) {
      val = 0;
    } else if (db < -80) {
      val = 0;
    } else if (db > 12) {
      val = 185;
    } else {
      val = Math.round(db * 2 + 161);
    }
    let level = val.toString();
    while (level.length < 3) {
      level = '0' + level;
    }
    if (logLevel >= 1) {
      console.log('setting volume level: ' + level);
    }
    this.client.write(level + 'VL\r');
  }

  zvolume(db) {
    // [0 .. 81] 0 = ---dB, 1 = -80dB , 81 = 0dB
    if (logLevel >= 1) {
      console.log('setting zvolume db: ' + db);
    }
    let val = 0;
    if (typeof db === 'undefined' || db === null) {
      val = 0;
    } else if (db < -80) {
      val = 0;
    } else if (db > 0) {
      val = 81;
    } else {
      val = Math.round(db + 81);
    }
    let level = val.toString();
    while (level.length < 2) {
      level = '0' + level;
    }
    if (logLevel >= 1) {
      console.log('setting zvolume level: ' + level);
    }
    this.client.write(level + 'ZV\r');
  }

  volumeUp() {
    this.client.write('VU\r');
  }

  volumeDown() {
    this.client.write('VD\r');
  }

  zvolumeUp() {
    this.client.write('ZU\r');
  }

  zvolumeDown() {
    this.client.write('ZD\r');
  }

  /**
   * Change the input
   */
  changeInput(input) {
    if (typeof input === 'number') {
      input = input.toString().padStart(2, '0');
    }
    const inputStr = InputChange[input];
    const cmd = `${input}FN\r`;
    debugLog(`(pioneer-avr::VSX.prototype.selectInput) set input to: ${input} (${inputStr ?? '???'}), cmd: ${cmd}`);
    this.client.write(cmd);
    this.client.write('?F\r');
  }

  changeZInput(input) {
    this.client.write(`${input}ZS\r`);
  }

  /**
   * Query the input name
   */
  queryInputName(inputId) {
    this.client.write('?RGB' + inputId + '\r');
  }

  /**
   * Set the listening mode
   */
  listeningMode(mode) {
    debugLog('(pioneer-avr::VSX.prototype.listeningMode) set listening mode to: ' + mode);
    this.client.write(mode.toString().padStart(4, '0') + 'SR\r');
  }

  /**
   * Send key.
   * @param key {string} Key code, {@see NetworkKeys}
   */
  sendKey(key) {
    this.client.write(`${key}NW\r`);
  }

  handleConnection(socket) {
    if (logLevel >= 1) {
      console.log('got connection.');
    }

    this.socket = socket;

    this.client.write('\r'); // wake
    setTimeout(() => {
      this.query();
      this.emit('connect');
    }, 100);
  }

  handleData(data) {
    // make sure it's a string
    data = data.toString();

    const dataLines = data.split('\r\n').filter(Boolean);
    if (logLevel >= 3) {
      console.log(`got ${dataLines.length} lines of data`);
    }

    for (const line of dataLines) {
      this.handleDataLine(line);
    }
  }

  handleDataLine(data) {
    // TODO implement a message to handler mapping instead of this big if-then statement

    let match;
    if (data.length === 0) {
      console.log('got empty data!');
    } else if ((match = /^(?<key>PWR|APR|BPR|ZEP)(?<on>\d)/.exec(data)) !== null) {
      // power status
      const zones = {
        PWR: 'main',
        APR: 'zone 2',
        BPR: 'zone 3',
        ZEP: 'zone 4',
      };

      const key = match.groups.key;
      const zoneName = zones[key];
      const on = match.groups.on === '0';

      if (logLevel >= 1) {
        console.log(`got ${zoneName} power: ${on ? 'ON' : 'OFF'}`);
      }

      this.emit('power', on, zoneName);
    } else if ((match = /^(?<key>VOL|ZV|YV)(?<vol>\d{2})/.exec(data)) !== null) {
      // volume status
      const zones = {
        VOL: 'main',
        ZV: 'zone 2',
        YV: 'zone 3',
      };

      const key = match.groups.key;
      const zoneName = zones[key];
      const vol = match.groups.vol;
      const db = zoneName === 'main' ? (parseInt(vol) - 161) / 2 : parseInt(vol) - 81;

      if (logLevel >= 1) {
        console.log(`got ${zoneName} volume: ${db} dB`);
      }

      this.emit('volume', db, zoneName);
    } else if ((match = /^(?<key>MUT|Z2MUT|Z3MUT)(?<on>\d)/.exec(data)) !== null) {
      // mute status
      const zones = {
        MUT: 'main',
        Z2MUT: 'zone 2',
        Z3MUT: 'zone 3',
      };

      const key = match.groups.key;
      const zoneName = zones[key];
      const on = match.groups.on === '0';

      if (logLevel >= 1) {
        console.log(`got ${zoneName} mute: ${on ? 'ON' : 'OFF'}`);
      }

      this.emit('mute', on, zoneName);
    } else if ((match = /^(?<key>FN|Z2F|Z3F|ZEA)(?<id>\d{2})/.exec(data)) !== null) {
      // input status
      const zones = {
        FN: 'main',
        Z2F: 'zone 2',
        Z3F: 'zone 3',
        ZEA: 'zone 4',
      };

      const key = match.groups.key;
      const zoneName = zones[key];
      const inputId = match.groups.id;
      const inputName = this.inputNames[inputId];

      if (logLevel >= 1) {
        console.log(`got ${zoneName} input: ${inputId} (${inputName ?? '???'})`);
      }

      this.emit('input', inputId, inputName, zoneName);
    } else if (data.startsWith('SSA')) {
      if (logLevel >= 2) {
        console.log('got SSA: ' + data);
      }
    } else if (data.startsWith('APR')) {
      if (logLevel >= 2) {
        console.log('got APR: ' + data);
      }
    } else if (data.startsWith('BPR')) {
      if (logLevel >= 2) {
        console.log('got BPR: ' + data);
      }
    } else if (data.startsWith('SR')) {
      // listening mode
      // DO NOT REACT ON SR - IT REFLECTS THE REMOTE KEY PRESSED TO CYCLIC SHIFT THROUGH MODES
      const modeKey = data.substring(2);
      const modeStr = ListeningModes[modeKey];
      debugLog(`(pioneer-avr::handleData) received listening mode: ${data} -> ${modeKey} (${modeStr ?? '???'})`);
      if (logLevel >= 2) {
        console.error(`got listening mode: ${modeKey} (${modeStr})"`);
      }
      debugLog('(pioneer-avr::handleData) requesting playback display listening mode ...');
      this.client.write('?L\r'); // query display listening mode
      this.emit('listening_mode_set', modeKey);
    } else if (data.startsWith('LM')) {
      // playback listening mode for display
      const modeKey = data.substring(2);
      const modeStr = PlayingListeningModes[modeKey];
      debugLog(
        `(pioneer-avr::handleData) received playback display listening mode: ${data} -> ${modeKey} (${modeStr ?? '???'})`,
      );
      this.emit('listening_mode_display', modeKey);
    } else if (data.startsWith('FL')) {
      // FL display information
      if (logLevel >= 2) {
        console.log('got FL: ' + data);
      }
    } else if (data.startsWith('RGB')) {
      // input name information. informs on input names
      // handle input info
      const inputId = data.substr(3, 2);
      const inputName = data.substr(6).trim();
      const oldName = this.inputNames[inputId];
      if (inputName !== oldName) {
        if (logLevel >= 2) {
          console.log(`got new name for input ${inputId} -> "${inputName}" (was: "${oldName}")`);
        }
        this.inputNames[inputId] = inputName;
      }
      this.emit('inputName', inputId, inputName);
    } else if (data.startsWith('RGC')) {
      if (logLevel >= 2) {
        console.log('got RGC: ' + data);
      }
    } else if (data.startsWith('RGF')) {
      if (logLevel >= 2) {
        console.log('got RGF: ' + data);
      }
    } else if (data.length > 0) {
      if (logLevel >= 1) {
        console.log('got data: ' + data);
      }
    }
  }

  handleEnd() {
    if (logLevel >= 1) {
      console.log('connection ended');
    }

    this.emit('end');
  }

  handleError(err) {
    if (logLevel >= 1) {
      console.log('connection error: ' + err.message);
    }

    this.emit('error', err);
  }
}

export default {
  VSX,
  Inputs,
  InputChange,
  ListeningModes,
  ListeningModesForDisplay: PlayingListeningModes,
};
