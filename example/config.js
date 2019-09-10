const decamelize = require('decamelize')
const titleize = require('titleize')

const nightTextColor  = 55296
const dayTextColor = 65535
const nightBarColor  = 55296
const dayBarColor = 1024

const buttonOnColor = 1024
const buttonOffColor = 50712
const buttonChangedColor = 65504

const buttonOnPic = 5
const buttonOffPic = 4
const buttonCHangingPic = 18

  
module.exports = (app, options, utils) => {
  function buttonPic(v) {
    if ( utils.getCurrentMode() == 'night' ) {
      return (v == 0) ? 8 : 9
    } else {
      return (v == 0) ? buttonOffPic : buttonOnPic
    }
  }

  function buttonUnknownPic() {
    if ( utils.getCurrentMode() == 'night' ) {
      return 7
    } else {
      return 6
    }
  }

  function changingSwitchPic(mode, val) {
    if ( mode == 'night' ) {
      return val == 1 ? 24 : 23
    } else {
      return val == 1 ? 25 : 26
    }
  }

  let config = {
    nightTextColor: 55296,
    dayTextColor: 65535,
    nightBarColor: 55296,
    dayBarColor: 1024,
    buttonChangedColor: 65504,

    colorVars: {
      'Battery.textColor': {
        day: 65535,
        night: 55296
      },
      'Battery.barColor': {
        day: 7748,
        night: 55296
      },
      'Battery.tabTextC': {
        day: 0,
        night: 55296
      },
      'Battery.tabBackC': {
        day: 50712,
        night: 0
      },
      'Battery.sTabTextC': {
        day: 0,
        night: 55296
      },
      'Battery.sTabBackC': {
        day: 7748,
        night: 32768
      },
      'Battery.waveGridC': {
        day: 65535,
        night: 32768
      },
      'Battery.waveChannelC': {
        day: 7748,
        night: 55296
      }
    },

    modeCommands: mode =>
      {
        const wpic = mode === 'night' ? 14 : 0
        const bpic = mode === 'night' ? 16 : 15
        return [
          `Weather.Weather.pic=${wpic}`,
          `Weather.windG.picc=${wpic}`,
          `Battery.Battery.pic=${bpic}`
        ]
      },
    
    devices: [
      {
        pages: {
          0: {
            values: [
              {
                objname: 'bpct',
                type: 'txt',
                path: 'electrical.batteries.260.capacity.stateOfCharge',
                format: v => `${(v*100).toFixed(0)}%`,
                unknown: '---%'
              },
              {
                objname: 'j0',
                type: 'val',
                path: 'electrical.batteries.260.capacity.stateOfCharge',
                format: v => (v*100).toFixed(0),
                unknown: 0
              },
              {
                objname: 'cmode',
                type: 'txt',
                path: 'electrical.chargers.261.chargingMode',
                format: v => titleize(decamelize(v, ' ')),
                unknown: '---'
              },
              {
                objname: 'bvolts',
                type: 'txt',
                path: 'electrical.batteries.260.voltage',
                format: v => `${v.toFixed(2)}V`,
                unknown: '--V'
              },
              {
                objname: 'bamps',
                type: 'txt',
                path: 'electrical.batteries.260.current',
                format: v => `${v.toFixed(1)}A`,
                unknown: '---A'
              },
              {
                objname: 'btime',
                type: 'txt',
                path: 'electrical.batteries.260.capacity.timeRemaining',
                format: v => {
                  if ( !v ) {
                    return '--:--'
                  } else {
                    return utils.secondsToHoursMinutes(v)
                  }
                },
                unknown: '--:--'
              },
              {
                objname: 'smode',
                type: 'txt',
                path: 'electrical.solar.258.controllerMode',
                format: v => titleize(decamelize(v, ' ')),
                unknown: '---'
              },
              {
                objname: 'svolts',
                type: 'txt',
                path: 'electrical.solar.258.panelVoltage',
                format: v => `${v.toFixed(1)}V`,
                unknown: '---V'
              },
              {
                objname: 'samps',
                type: 'txt',
                path: 'electrical.solar.258.current',
                format: v => `${v.toFixed(1)}A`,
                unknown: '---A'
              },
              {
                objname: 'swatts',
                type: 'txt',
                path: 'electrical.solar.258.panelPower',
                format: v => `${v.toFixed(0)}W`,
                unknown: '---W'
              },
              {
                objname: 'p0',
                type: 'pic',
                path: 'electrical.chargers.261.modeNumber',
                format: v => {
                  if ( utils.getCurrentMode() === 'day' ) {
                    switch ( v ) {
                    case 3:
                      return 1
                    case 4:
                      return 2
                    case 1:
                      return 3
                    default:
                      return 27
                    }
                  } else {
                    switch ( v ) {
                    case 3:
                      return 10
                    case 4:
                      return 11
                    case 1:
                      return 12
                    default:
                      return 13
                    }
                  }
                },
                unknown: utils.getCurrentMode() === 'day' ? 27 : 13
              },
              {
                objname: 'p1',
                type: 'pic',
                path: 'electrical.switches.acr.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
            ],
            buttons: {
              chargeOn: {
                //On
                path: 'electrical.chargers.261.modeNumber',
                value: 3,
                pictureObj: 'p0',
                changingPicture: m => m == 'night' ? 21 : 18
              },
              chargeOff: {
                //Off
                path: 'electrical.chargers.261.modeNumber',
                value: 4,
                pictureObj: 'p0',
                changingPicture: m => m == 'night' ? 20 : 14
              },
              chargeOnly: {
                //Charge
                path: 'electrical.chargers.261.modeNumber',
                value: 1,
                pictureObj: 'p0',
                changingPicture: m => m == 'night' ? 22 : 19
              },
              acr: {
                path: 'electrical.switches.acr.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p1'
              },
            }
          },
          1: {
            values: [
              {
                objname: 'p1',
                type: 'pic',
                path: 'electrical.switches.anchorLight.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p0',
                type: 'pic',
                path: 'electrical.switches.bank.yd.runningLights.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p3',
                type: 'pic',
                path: 'electrical.switches.bank.yd.foredeckLight.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p2',
                type: 'pic',
                path: 'electrical.switches.bank.yd.steamingLight.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p4',
                type: 'pic',
                path: 'electrical.switches.hue.groups.cabin.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p5',
                type: 'pic',
                path: 'electrical.switches.hue.groups.vBirth.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
            ],
            buttons: {
              anchor: {
                path: 'electrical.switches.anchorLight.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p1'
              },
              running: {
                path: 'electrical.switches.bank.yd.runningLights.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p0'
              },
              foreDeck: {
                path: 'electrical.switches.bank.yd.foredeckLight.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p3'
              },
              steaming: {
                path: 'electrical.switches.bank.yd.steamingLight.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p2'
              },
              cabin: {
                path: 'electrical.switches.hue.groups.cabin.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p4'
              },
              vBirth: {
                path: 'electrical.switches.hue.groups.vBirth.state',
                value: utils.toggle,
                changingPicture: changingSwitchPic,
                pictureObj: 'p5'
              }
            }
          },
          2: {
            values: [
              {
                objname: 'windG',
                type: 'gauge',
                path: 'environment.wind.angleApparent',
                format: v => (utils.degToGauge(utils.radsToDeg(v)).toFixed(0))
              },
              {
                objname: 't0',
                type: 'txt',
                path: 'environment.wind.speedApparent',
                format: v => `${utils.msToKnots(v).toFixed(0)}kts`,
                unknown: '---kts'
              },
              {
                objname: 't1',
                type: 'txt',
                path: 'environment.inside.temperature',
                format: v => `${utils.KtoF(v).toFixed(0)}°`,
                unknown: '--°'
              },
              {
                objname: 't4',
                type: 'txt',
                path: 'environment.water.temperature',
                format: v => `${utils.KtoF(v).toFixed(0)}°`,
                unknown: '--°'
              },
              {
                objname: 't6',
                type: 'txt',
                path: 'environment.inside.refrigerator.temperature',
                format: v => `${utils.KtoF(v).toFixed(0)}°`,
                unknown: '--°'
              },
              {
                objname: 't8',
                type: 'txt',
                path: 'environment.inside.refrigerator.relativeHumidity',
                format: v => `${(v*100).toFixed(0)}%`,
                unknown: '---%'
              },
              {
                objname: 's0',
                type: 'wave',
                path: 'environment.wind.speedApparent',
                format: v => (utils.msToKnots(v)).toFixed(0),
                channel: 0,
                id: 14,
                rangeHi: 30,
                rangeLo: 0,
                height: 81
              },
              {
                objname: 't10',
                type: 'txt',
                path: 'navigation.datetime',
                format: utils.date,
                unknown: '--/--/--'
              },
              {
                objname: 't11',
                type: 'txt',
                path: 'navigation.datetime',
                format: v => (utils.date(v, 'hh:mm A')),
                unknown: '--:--'
              },
            ]
          },
          3: {
            values: [
              {
                objname: 'j0',
                type: 'val',
                path: 'tanks.fuel.0.currentLevel',
                format: v => ((v*100).toFixed(0)),
                unknown: 0
              },
              {
                objname: 'j1',
                type: 'val',
                path: 'tanks.freshWater.0.currentLevel',
                format: v => ((v*100).toFixed(0)),
                unknown: 0
              },
              {
                objname: 'j2',
                type: 'val',
                path: 'tanks.blackWater.0.currentLevel',
                format: v => ((v*100).toFixed(0)),
                unknown: 0
              },
              {
                objname: 't2',
                type: 'txt',
                path: 'tanks.fuel.0.currentLevel',
                format: v => `${((v*100).toFixed(0))}%`,
                unknown: 0
              },
              {
                objname: 't3',
                type: 'txt',
                path: 'tanks.freshWater.0.currentLevel',
                format: v => `${((v*100).toFixed(0))}%`,
                unknown: 0
              },
              {
                objname: 't5',
                type: 'txt',
                path: 'tanks.blackWater.0.currentLevel',
                format: v => `${((v*100).toFixed(0))}%`,
                unknown: 0
              },
            ]
          }
        }
      }
    ]
  }
  return config
}
