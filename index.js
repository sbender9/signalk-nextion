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
const moment = require('moment')

module.exports = function(app) {
  var plugin = {
  };
  let onStop = []
  var statusMessage
  var config
  var options
  var deviceData = {}
  var currentMode

  /*
  var currentPage
  var changingPaths = []
  var pagingInterval
  var pagingPausedTime = 0
  */

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
            },
            sleep: {
              type: 'number',
              title: 'Sleep in seconds (0 = no sleep)',
              default:0 
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
              title: 'Flip through all the pages with the given interval in seconds',
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
      toggle,
      secondsToHoursMinutes,
      msToKnots,
      date,
      getCurrentMode: () => { return currentMode }
    })

    if ( !options.devices ) {
      setProviderError('Please add a device')
      return
    }
    
    plugin.serialPorts = []
    options.devices.forEach((device, index) => {
      deviceData[index] = { changingPaths: [], pagingPausedTime: 0 }
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
     
          parser.on('data', data => {
            parseData(data, index)
          });

          setTimeout(() => {
            deviceData[index].sentPage = true
            write(index, 'sendme')
            const sleep = !_.isUndefined(options.devices[index].sleep) ? options.devices[index].sleep > 0 && options.devices[index].sleep < 3 ? 3 : options.devices[index].sleep : 0
            setTimeout(() => {
              write(index, `thsp=${sleep}`)
              write(index, `thup=1`)
              setMode(index, 'night')

              if ( options.devices[index].advancePages ) {
                deviceData[index].pagingInterval = setInterval(() => {
                  advancePage(index)
                }, options.devices[index].advancePages * 1000)
              }
            }, 1000)
          }, 1000)
          
          setProviderStatus('Connected')
        }
      )
      
      serial.on('error', function (err) {
        app.error(err.toString())
        setProviderError(err.toString())
        scheduleReconnect(usbDevice, index)
      })
      serial.on('close', onClose)
    } catch ( err ) {
      app.error(err)
      setProviderError(err.message)
    }
  }

  function onClose(usbDevice) {
    app.debug("close")
    setProviderError('Closed')
    scheduleReconnect(usbDevice, index)
  }

  function scheduleReconnect(usbDevice, index) {
    const delay = 1000
    const msg = `Not connected (retry delay ${(
    delay / 1000
  ).toFixed(0)} s)`
    deviceData[index].currentPage = undefined
    deviceData[index].currentMode = undefined
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
    app.debug(`stopping ${plugin.serialPorts}`)
    if ( plugin.serialPorts ) { 
      plugin.serialPorts.forEach((serial, index) => {
        serial.removeListener('close', onClose)
        serial.close()
        if ( deviceData[index].pagingInterval ) {
          clearInterval(deviceData[index].pagingInterval)
        }
      })
      plugin.serialPorts = []
    }
    deviceData = {}
  }

  function gotDelta(delta) {
    if ( delta.updates ) {
      delta.updates.forEach(update => {
        update.values.forEach(vp => {
          config.devices.forEach((device, index) => {
            if ( !_.isUndefined(deviceData[index].currentPage) ) {
              let items = device.pages[deviceData[index].currentPage].values.filter(item => {
                return item.path == vp.path
              })
              items.forEach(item => {
                displayItem(index, item, vp.value)
              })
              let auto = options.devices[index].autoNightMode
              if ( vp.path == 'navigation.position' && (_.isUndefined(auto) ||  auto) ) {
                if ( setMode(index, calculateMode()) ) {
                  blankPage(index)
                }
              }
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
      } else if ( item.type == 'wave' ) {
        write(index, `cle ${item.id},${item.channel}`)
        return
      } else if ( !_.isUndefined(item.unknown) ) {
        value = typeof item.unknown === 'function' ? item.unknown() : item.unknown
      } else {
        return
      }
    } else if ( item.format ) {
      value = item.format(value)
    }

    if ( deviceData[index].changingPaths.indexOf(item.path) != -1 ) {
      //FIXME: show the changingPicture
      return 
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
    if ( type == 'wave' ) {
      if ( value > item.rangeHi )
        value = item.rangeHi
      else if ( value < item.rangeLo ) {
        value = item.rangeLo
      }

      let top = item.rangeHi - item.rangeLo
      value = value - item.rangeLo
      value = ((value / item.rangeHi) * item.height).toFixed(0)
      
      command = `add ${item.id},${item.channel},${value}`
    } else if ( type === 'txt' ) {
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
      let firstTime = _.isUndefined(deviceData[index].currentPage) 
      if ( data[1] != deviceData[index].currentPage ) {
        app.debug(`On Page ${data[1]}`)
        deviceData[index].currentPage = data[1]
        blankPage(index)
      }

      if ( !deviceData[index].sentPage ) {
        if ( options.devices[index].advancePages ) {
          deviceData[index].pagingPausedTime = Date.now();
        }
      } else {
        deviceData[index].sentPage = false
      }
      
      break
    case 0x65:
      const page = data[1]
      const component = data[2]
      const event = data[3]
      buttonPress(page, component, event, index)
      break

    case 0x70:
      const str = Buffer.from(data.slice(1)).toString()
      const parts = str.split(':')
      if ( parts.length == 2 && parts[0] === 'b' ) {
        buttonPress(deviceData[index].currentPage, parts[1], 0, index)
      }
      break
    }
  }

  function buttonPress(page, component, event, index) {
    app.debug(`buttonPress: ${page} ${component} ${event} ${index}`)
    if ( event == 0 ) {
      const pageButtons = config.devices[index].pages[page].buttons
      if ( !_.isUndefined(pageButtons) ) {
        const button = pageButtons[component]
        if ( !_.isUndefined(button)
             && deviceData[index].changingPaths.indexOf(button.path) == -1 ) {
          let val = button.value
          if ( typeof val === 'function' ) {
            val = val(button.path)
          }
          app.debug('Setting %s to %o', button.path, val)

          if ( button.pictureObj
               && !_.isUndefined(button.changingPicture) ) {
            deviceData[index].changingPaths.push(button.path)
            const pic = button.changingPicture(deviceData[index].currentMode, val)
            write(index, `${button.pictureObj}.pic=${pic}`)
          }
          
          app.putSelfPath(button.path, val, res => {
            app.debug(JSON.stringify(res))
            let idx = deviceData[index].changingPaths.indexOf(button.path)
            if ( idx != -1 ) {
              deviceData[index].changingPaths.splice(idx, 1)
            }
          })
        }
      }
    }
  }

  function blankPage(index) {
    app.debug('Blank page')
    config.devices[index].pages[deviceData[index].currentPage].values.forEach(item => {
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
    //console.log(`advancePage: ${index} ${JSON.stringify(deviceData)}`)
    if ( deviceData[index].pagingPausedTime == 0
         || Date.now() - deviceData[index].pagingPausedTime > options.devices[index].advancePagePause*1000)
    {
      deviceData[index].pagingPausedTime = 0
      let num = _.keys(config.devices[index].pages).length
      let newPage = deviceData[index].currentPage + 1
      if ( newPage == num ) {
        newPage = 0
      }
      deviceData[index].sentPage = true
      write(index, `page ${newPage}`)
    }
  }

  function setMode(index, mode) {
    if ( _.isUndefined(mode) ) {
      return
    }
    currentMode = mode
    if ( mode == deviceData[index].currentMode ) {
      return false
    }
    deviceData[index].currentMode = mode

    let colorVars = config.devices[index].colorVars || config.colorVars

    _.keys(colorVars).forEach(varName => {
      let color = colorVars[varName][mode]
      if ( !_.isUndefined(color) ) {
        write(index, `${varName}.val=${color}`)
      }
    })

    let modeCommands = config.devices[index].modeCommands || config.modeCommands
    if ( modeCommands ) {
      modeCommands = modeCommands(mode)
      modeCommands.forEach(command => {
        write(index, command)
      })
    }

    deviceData[index].sentPage = true
    write(index, `page ${deviceData[index].currentPage}`) //cause a refresh
    write(index, `dim=${mode === 'night' ? options.devices[index].nightModeDim : options.devices[index].dayModeDim}`)
    
    //write(index, `sys3=${mode === 'night' ? 1 : 0}`)
    return true
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
    //mode = 'night'
    return mode
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

  function secondsToHoursMinutes(v) {
    const hours = v / 3600;
    const remainder = v - hours * 3600;
    const mins = remainder / 60;
    return `${hours.toFixed(0)}:${mins.toFixed(0)}`
  }

  function msToKnots(v)
  {
    return v * 1.94384
  }

  function date(v, format='MM/DD/YYYY') {
    let dt = moment(v)
    return dt.format(format)
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

