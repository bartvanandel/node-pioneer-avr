import { VSX, Inputs } from '../lib/pioneer-avr';
import { createClient } from 'mqtt';
import { randomBytes } from 'node:crypto';

let logLevel = 0;

const defaultOptions = {
  logLevel: 2,
  vsx: {
    host: '192.168.1.123',
    port: 23,
  },
  mqtt: {
    host: '192.168.1.200',
    port: 1883,
  },
};

class AvrMqtt {
  mqttClient;
  receiver;
  state;
  topics;

  constructor(options) {
    options = options || defaultOptions;

    const rootTopic = options.vsx.uuid ? `/meem/${options.vsx.uuid}` : '/house/lounge/avr';

    options.mqttPaths = options.mqttPaths || {
      powerIn: rootTopic + '/power/in',
      powerOut: rootTopic + '/power/out',
      volumeIn: rootTopic + '/volume/in',
      volumeOut: rootTopic + '/volume/out',
      muteIn: rootTopic + '/mute/in',
      muteOut: rootTopic + '/mute/out',
      sourceIn: rootTopic + '/source/in',
      sourceOut: rootTopic + '/source/out',
      sourcesOut: rootTopic + '/sources/out', // to send the available input sources
    };

    this.topics = {
      powerIn: options.mqttPaths.powerIn || '/house/av/avr/power/in', // power control
      powerOut: options.mqttPaths.powerOut || '/house/av/avr/power/out', // power state
      volumeIn: options.mqttPaths.volumeIn || '/house/av/avr/volume/in', // volume control
      volumeOut: options.mqttPaths.volumeOut || '/house/av/avr/volume/out', // volume state
      muteIn: options.mqttPaths.muteIn || '/house/av/avr/mute/in',
      muteOut: options.mqttPaths.muteOut || '/house/av/avr/mute/out',
      sourceIn: options.mqttPaths.sourceIn || '/house/av/avr/source/in',
      sourceOut: options.mqttPaths.sourceOut || '/house/av/avr/source/out',
      sourcesOut: options.mqttPaths.sourcesOut || '/house/av/avr/sources/out',
    };

    this.state = { power: {}, volume: {}, mute: {}, source: {}, sources: {} };

    const receiver = (this.receiver = new VSX({ logLevel, ...options.vsx }));
    receiver.on('connect', () => {
      this._handleAvrConnect(options.mqtt);
    });

    logLevel = options.logLevel;
  }

  subscribe() {
    const { mqttClient: client, topics } = this;

    if (client) {
      // sobscribe to contorl topics
      client.subscribe(topics.powerIn);
      client.subscribe(topics.volumeIn);
      client.subscribe(topics.muteIn);
      client.subscribe(topics.sourceIn);

      // subscribe to topics for requests for initial-content (state).
      client.subscribe(topics.powerOut + '?');
      client.subscribe(topics.volumeOut + '?');
      client.subscribe(topics.muteOut + '?');
      client.subscribe(topics.sourceOut + '?');
      client.subscribe(topics.sourcesOut + '?');
    }
  }

  _handleAvrConnect(options) {
    const { receiver, state, topics } = this;

    if (logLevel > 0) {
      console.log('AV Receiver connected');
    }

    // connect to MQTT service
    const clientId = randomBytes(24).toString('hex');

    const client = (this.mqttClient = createClient(options.port, options.host, {
      keepalive: 300,
      client: clientId,
    }));

    // add handlers to MQTT client
    client.on('connect', function () {
      if (logLevel > 0) {
        console.log('MQTT sessionOpened');
      }
      this.subscribe(); // subscribe to control and request topics
    });
    client.on('close', function () {
      if (logLevel > 0) {
        console.log('MQTT close');
      }
    });
    client.on('error', function (e) {
      if (logLevel > 0) {
        console.log('MQTT error: ' + e);
      }
    });
    client.addListener('message', function (topic, payload) {
      // got data from subscribed topic
      if (logLevel > 0) {
        console.log('received ' + topic + ' : ' + payload);
      }

      // check if message is a request for current value, send response
      if (topic.includes('?')) {
        this._handleContentRequest(topic, payload);
      } else {
        this._handleInput(topic, payload);
      }
    });

    // add AVR state handlers
    receiver.on('power', function (power) {
      state.power = { value: power };
      client.publish(topics.powerOut, JSON.stringify(state.power));
    });
    receiver.on('volume', function (db) {
      state.volume = { value: db, unit: 'dB' };
      client.publish(topics.volumeOut, JSON.stringify(state.volume));
    });
    receiver.on('mute', function (mute) {
      state.mute = { value: mute };
      client.publish(topics.muteOut, JSON.stringify(state.mute));
    });
    receiver.on('input', function (source, name) {
      state.source = { value: source, name };
      client.publish(topics.sourceOut, JSON.stringify(state.source));
    });
    receiver.on('inputName', function (id, name) {
      // update and send available sources
      if (logLevel > 0) {
        console.log('VSX got source: ' + id + ' : ' + name);
      }
      state.sources[id] = name;
      client.publish(topics.sourcesOut, JSON.stringify(state.sources));

      // if the name is for the current selected source, then send input source state
      if (state.source && state.source.value === id) {
        state.source = { value: id, name };
        client.publish(topics.sourceOut, JSON.stringify(state.source));
      }
    });
  }

  _handleContentRequest(topic, payload) {
    const { mqttClient: client, state, topics } = this;
    const requestTopic = topic.slice(0, topic.indexOf('?'));
    const responseTopic = payload;

    if (logLevel > 0) {
      console.log('requestTopic: ' + requestTopic + '  responseTopic: ' + responseTopic);
    }
    if (requestTopic === topics.powerOut) {
      if (logLevel > 0) {
        console.log('sending powerOut content: ' + state.power);
      }
      client.publish(responseTopic, JSON.stringify(state.power));
    } else if (requestTopic === topics.volumeOut) {
      if (logLevel > 0) {
        console.log('sending volumeOut content: ' + state.volume);
      }
      client.publish(responseTopic, JSON.stringify(state.volume));
    } else if (requestTopic === topics.muteOut) {
      if (logLevel > 0) {
        console.log('sending muteOut content: ' + state.mute);
      }
      client.publish(responseTopic, JSON.stringify(state.mute));
    } else if (requestTopic === topics.sourceOut) {
      if (logLevel > 0) {
        console.log('sending sourceOut content: ' + state.source);
      }
      client.publish(responseTopic, JSON.stringify(state.source));
    } else if (requestTopic === topics.sourcesOut) {
      if (logLevel > 0) {
        console.log('sending sourcesOut content: ' + state.sources);
      }
      client.publish(responseTopic, JSON.stringify(state.sources));
    }
  }

  /**
   * Handle an input MQTT message
   * @param {string} topic MQTT topic
   * @param {string} payload JSON-encoded payload
   */
  _handleInput(topic, payload) {
    const { receiver, topics } = this;

    const msg = payload ? JSON.parse(payload) : {};

    if (topic === topics.powerIn) {
      receiver.power(msg.value);
    } else if (topic === topics.volumeIn) {
      receiver.volume(msg.value);
    } else if (topic === topics.muteIn) {
      receiver.mute(msg.value);
    } else if (topic === topics.sourceIn) {
      receiver.changeInput(msg.value);
    }
    // else unhandled topic
  }
}

export { AvrMqtt, Inputs };
