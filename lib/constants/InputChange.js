// Input Change
// Get command: ?F<CR>
// Set command: **FN<CR>
// Change cyclic (up): FU<CR>
// Change cyclic (down): FD<CR>
// Response: FN**<CR+LF>
const InputChange = Object.freeze({
  '00': 'PHONO',
  '01': 'CD',
  '02': 'TUNER',
  '04': 'DVD',
  '05': 'TV',
  '06': 'SAT/CBL',
  15: 'DVR/BDR',
  25: 'BD',

  12: 'MULTI CH IN',

  10: 'VIDEO 1(VIDEO)',

  19: 'HDMI 1',
  20: 'HDMI 2',
  21: 'HDMI 3',
  22: 'HDMI 4',
  23: 'HDMI 5',
  24: 'HDMI 6',
  34: 'HDMI 7',
  31: 'HDMI (cyclic)',

  13: 'USB-DAC',
  17: 'iPod/USB',
  33: 'ADAPTER PORT',
  48: 'MHL',

  38: 'INTERNET RADIO',
  44: 'MEDIA SERVER', // and AirPlay
  45: 'FAVORITES',
  40: 'SiriusXM',
  41: 'PANDORA',
  26: 'NETWORK (cyclic)',
});

export default InputChange;
