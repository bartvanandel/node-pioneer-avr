import { VSX } from '../lib/pioneer-avr';
// import { NetworkKeys } from '../lib/constants';

const options = {
  port: 8102,
  host: '192.168.1.123',
  logLevel: 2,
};

const receiver = new VSX(options);

receiver.on('connect', () => {
  console.log('receiver connected');

  let timeout = 1000;

  const addTest = (fn, duration) => {
    setTimeout(fn, timeout);
    timeout += duration;
  };

  addTest(() => receiver.power(true), 5000);
  // addTest(() => receiver.volume(-45), 1000);
  addTest(() => receiver.query(), 5000);
  // addTest(() => receiver.changeInput(avr.Inputs.hdmi_2), 2000);
  // addTest(() => receiver.changeInput(avr.Inputs.tv_sat), 2000);

  // // Set input to 'FAVORITES', select an item from the list, activate
  // addTest(() => receiver.changeInput(45 /* favorites */), 7000);
  // addTest(() => receiver.client.write('?GAH\r'), 100);
  // for (let i = 0; i < 3; ++i) {
  //   addTest(() => receiver.sendKey(NetworkKeys.DOWN), 100);
  // }
  // addTest(() => receiver.sendKey(NetworkKeys.ENTER), 100);

  // addTest(() => receiver.power(false), 1000);
  addTest(() => process.exit(), 1000);
});

// receiver.on('input', (id, name, zone) => {
//   console.log(`got ${zone} input: ${id} -> ${name}`);
// });

// receiver.on('inputName', (id, name, zone) => {
//   console.log(`got ${zone} input name: ${id} -> ${name}`);
// });
