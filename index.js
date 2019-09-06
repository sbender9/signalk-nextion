/*
 * Copyright 2019 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const PLUGIN_ID = 'signalk-nextion'
const SerialPort = require('serialport')
const _ = require("lodash")
const decamelize = require('decamelize')
const titleize = require('titleize')
const suncalc = require('suncalc')
const fs = require('fs')
const path = require('path')

module.exports = function(app) {
  var plugin = {
  };
  let onStop = []
  var statusMessage
  var currentPage
  var currentMode
  var config
  var options

  plugin.id = PLUGIN_ID
  plugin.name = "Nextion"
  plugin.description = "SignalK Node Server Plugin that sends data to a Nextion Display"

  plugin.schema = {
    type: "object",
    properties: {
      devices: {
        type: 'array',
        title: 'Devices',
        items: {
          type: 'object',
          properties: {
            usbDevice: {
              type: "string",
              title: "USB Device Name",
              default: "/dev/ttyUSB0"
            }
          }
        }
      },
      autoNightMode: {
        type: 'boolean',
        title: 'Auto Night Mode',
        default: true
      },
      nightModeDim: {
        type: 'number',
        title: 'Night Mode Dimming Level (1-100)',
        default: 33
      },
      dayModeDim: {
        type: 'number',
        title: 'Day Mode Dimming Level (1-100)',
        default: 100
      },
      advancePages: {
        type: 'number',
        title: 'Flip through all the pages with the given timeout in seconds',
        description: "0 means don't flip",
        default:0
      },
      advancePagePause: {
        type: 'number',
        title: 'Pause flipping when a page is manually selected in seconds',
        default: 5
      }
    }
  }

  const setProviderStatus = app.setProviderStatus
  const setProviderError = app.setProviderError
    
  plugin.start = function(theOptions) {
    options = theOptions
    
    const configPath = app.getDataDirPath()
    const configFile = path.join(configPath, 'config.js')

    if ( !fs.existsSync(configFile) ) {
      setProviderError(`no config: ${configFile}`)
      return
    }

    config = require(configFile)(app, options, {
      radsToDeg,
      KtoF,
      degToGauge,
      toggle
    })

    if ( !options.devices ) {
      setProviderError('Please add a device')
      return
    }
    
    plugin.serialPorts = []
    options.devices.forEach((device, index) => {
      plugin.connect(device.usbDevice, index)
    })

    const command = {
      context: "vessels.self",
      subscribe: [
        {
          path: 'navigation.position',
          period: 1000
        }
      ]
    }

    const subscribed = []
    config.devices.forEach(device => {
      _.values(device.pages).forEach(page => {
        page.values.forEach(item => {
          if ( subscribed.indexOf(item.path) == -1 ) {
            subscribed.push(item.path)
            command.subscribe.push({
              path: item.path,
              period: 1000
            })
          }
        })
      })
    })

    app.debug('subscribe %j', command)
    
    app.subscriptionmanager.subscribe(command, onStop, (e) => app.error(e),
                                      gotDelta)
  }

  plugin.connect = function(usbDevice, index) {
    app.debug(`connecting to ${usbDevice}:${index}`)
    try {
      let serial = new SerialPort(usbDevice, {
        baudRate: 9600
      })
      plugin.serialPorts[index] = serial

      serial.on(
        'open',
        function () {
          const parser = new SerialPort.parsers.Delimiter({delimiter: Buffer.from([0xff, 0xff, 0xff])})
          serial.pipe(parser)

          write(index, 'sendme')
          
          parser.on('data', data => {
            parseData(data, index)
          });
          setProviderStatus('Connected, wating for data...')
        }
      )
      
      
      serial.on('error', function (err) {
        app.error(err.toString())
        setProviderError(err.toString())
        scheduleReconnect(usbDevice, index)
      })
      serial.on('close', function() {
        app.debug("close")
        setProviderError('Closed')
        scheduleReconnect(usbDevice, index)
      })
    } catch ( err ) {
      app.error(err)
      setProviderError(err.message)
    }
  }

  function scheduleReconnect(usbDevice, index) {
    const delay = 1000
    const msg = `Not connected (retry delay ${(
    delay / 1000
  ).toFixed(0)} s)`
    console.log(msg)
    setProviderStatus(msg)
    setTimeout(plugin.connect.bind(plugin, usbDevice, index), delay)
  }


  plugin.statusMessage = () => {
    return statusMessage
  }
  
  plugin.stop = function() {
    onStop.forEach(f => f())
    onStop = []
    if ( plugin.serialPorts ) { 
      plugin.serialPorts.forEach(serial => {
        serial.close()
      })
    }
  }

  function gotDelta(delta) {
    if ( _.isUndefined(currentPage) ) {
      return
    }
    
    if ( delta.updates ) {
      delta.updates.forEach(update => {
        update.values.forEach(vp => {
          config.devices.forEach((device, index) => {
            let items = device.pages[currentPage].values.filter(item => {
              return item.path == vp.path
            })
            items.forEach(item => {
              displayItem(index, item, vp.value)
            })
            if ( vp.path == 'navigation.position' && options.autoNightMode ) {
              setMode(index, calculateMode())
            }
          })
        })
      })
    }
  }

  function displayItem(index, item, value) {
    let command
    if ( _.isUndefined(value) ) {
      if ( item.type === 'gauge' ) {
        app.debug('Hiding %s', item.objname)
        write(index, `vis ${item.objname},0`)
        item.isHidden = true
        return
      } else if ( !_.isUndefined(item.unknown) ) {
        value = item.unknown
      } else {
        return
      }
    } else if ( item.format ) {
      value = item.format(value)
    }
    
    if ( item.isHidden ) {
      app.debug('Showing %s', item.objname)
      write(index, `vis ${item.objname},1`)
      item.isHidden = false
    }

    let type = item.type
    if ( type === 'gauge' ) {
      type = 'val'
    }
    if ( type === 'txt' ) {
      command = `${item.objname}.txt="${value}"`
    } else {
      command = `${item.objname}.${type}=${value}`
    }
    write(index, command)
  }

  function write(index, text) {
    app.debug('Sending %s', text)
    plugin.serialPorts[index].write(hex(text))
  }

  function parseData(data, index) {
    app.debug('Data:', data);

    switch ( data[0] ) {
    case 0x66:
      let firstTime = _.isUndefined(currentPage) 
      if ( data[1] != currentPage ) {
        app.debug(`On Page ${data[1]}`)
        currentPage = data[1]
        blankPage(index)
      }

      /*
      if ( firstTime ) {
        pagingInterval = setInterval(advancePage, 5000)
      } else {
        //clearInterval(pagingInterval)
      }*/
      
      break
    case 0x65:
      const page = data[1]
      const component = data[2]
      const event = data[3]
      buttonPress(page, component, event, index)
      break
    }
  }

  function buttonPress(page, component, event, index) {
    //app.debug(`buttonPress: ${page} ${component} ${event} ${index}`)
    if ( event == 00 ) {
      const pageButtons = config.devices[index].pages[page].buttons
      if ( !_.isUndefined(pageButtons) ) {
        const button = pageButtons[component]
        if ( !_.isUndefined(button) ) {
          let val = button.value
          if ( typeof val === 'function' ) {
            val = val(button.path)
          }
          app.debug('Setting %s to %o', button.path, val)
          if ( button.type !== 'hs' )
          {
            write(index, `${button.objname}.bco=${config.buttonChangedColor}`)
          }
          app.putSelfPath(button.path, val, res => {
            app.debug(JSON.stringify(res))
          })
        }
      }
    }
  }

  function blankPage(index) {
    app.debug('Blank page')
    config.devices[index].pages[currentPage].values.forEach(item => {
      let val = app.getSelfPath(item.path + '.value')
      if ( _.isUndefined(val) ) {
        if ( !_.isUndefined(item.unknown) || item.type == 'gauge' ) {
          displayItem(index, item, undefined)
        }
      } else {
        displayItem(index, item, val)
      }
    })
    app.debug('Done blank page')
  }

  function advancePage(index) {
    let num = _.keys(config[index].pages).length
    app.debug(`keys ${num}`)
    let newPage = currentPage + 1
    if ( newPage == num ) {
      newPage = 0
    }
    write(index, `page ${newPage}`)
  }

  function setMode(index, mode) {
    if ( _.isUndefined(mode) ) {
      return
    }
    if ( mode == currentMode ) {
      return
    }
    currentMode = mode
    let color = mode === 'night' ? config.nightTextColor : config.dayTextColor
    write(index, `sys0=${color}`)
    color = mode === 'night' ? config.nightBarColor : config.dayBarColor
    write(index, `sys1=${color}`)
    write(index, `page ${currentPage}`)
    write(index, `dim=${mode === 'night' ? options.nightModeDim : options.dayModeDim}`)
    write(index, `sys3=${mode === 'night' ? 1 : 0}`)
  }

  function calculateMode() {
    let position = app.getSelfPath('navigation.position.value')

    if ( _.isUndefined(position) ) {
      return
    }

    let now = new Date()
    var times = suncalc.getTimes(now, position.latitude, position.longitude)

    _.keys(times).forEach(key => {
      times[key] = new Date(times[key]).getTime()
    })

    let mode
    if (now >= times.sunrise) {
      if (now < times.sunriseEnd) {
        mode = 'day'
      } else if (now <= times.sunsetStart) {
        mode = 'day'
      } else if (now >= times.sunsetStart && now < times.dusk) {
        mode = 'night'
      } else if (now < times.night) {
        mode = 'night'
      } else {
        mode = 'night'
      }
    } else {
      mode = 'night'
    }
    //return mode
    return 'night'
  }

  function toggle(path) {
    const val = app.getSelfPath(path + '.value')
    return val ? 0 : 1
  }

  function radsToDeg(radians) {
    return radians * 180 / Math.PI
  }

  function KtoF(v) {
    return (v-273.15) * (9/5) + 32
  }

  function degToGauge(v) {
    let res = v + 90
    if ( res > 360 ) {
      res = res - 360
    }
    return res
  }
  
  return plugin
}

function hex(str) {
  var arr = [];
  for (var i = 0, l = str.length; i < l; i ++) {
    var ascii = str.charCodeAt(i);
    arr.push(ascii);
  }
  arr.push(255);
  arr.push(255);
  arr.push(255);
  return new Buffer.from(arr);
}

