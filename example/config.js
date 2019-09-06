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
const buttonUnknownPic = 6

function buttonPic(v) {
  return (v == 0) ? buttonOffPic : buttonOnPic
}
  
module.exports = (app, options, utils) => {
  let config = {
    nightTextColor: 55296,
    dayTextColor: 65535,
    nightBarColor: 55296,
    dayBarColor: 1024,
    buttonChangedColor: 65504,

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
                    const hours = v / 3600;
                    const remainder = v - hours * 3600;
                    const mins = remainder / 60;
                    
                    return `${hours.toFixed(0)}:${mins.toFixed(0)}`
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
                  switch ( v ) {
                  case 3:
                    return 1
                  case 4:
                    return 2
                  case 1:
                    return 3
                  default:
                    return 2
                  }
                },
                unknown: 2
              },
              /*
                {
                objname: 'b0',
                type: 'bco',
                path: 'electrical.chargers.261.modeNumber',
                format: v => (v == 3) ? buttonOnColor : buttonOffColor,
                unknown: buttonOffColor
                },
                {
                objname: 'b5',
                type: 'bco',
                path: 'electrical.chargers.261.modeNumber',
                format: v => (v == 4) ? buttonOnColor : buttonOffColor,
                unknown: buttonOffColor
                },
                {
                objname: 'b6',
                type: 'bco',
                path: 'electrical.chargers.261.modeNumber',
                format: v => (v == 1) ? buttonOnColor : buttonOffColor,
                unknown: buttonOffColor
                },
              */
              {
                objname: 'p1',
                type: 'pic',
                path: 'electrical.switches.acr.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
            ],
            buttons: {
              16: {
                objname: 'm0',
                type: 'hs',
                path: 'electrical.chargers.261.modeNumber',
                value: 3
              },
              17: {
                objname: 'm1',
                type: 'hs',
                path: 'electrical.chargers.261.modeNumber',
                value: 4
              },
              18: {
                objname: 'm2',
                type: 'hs',
                path: 'electrical.chargers.261.modeNumber',
                value: 1
              },
              20: {
                type: 'hs',
                objname: 'm3',
                path: 'electrical.switches.acr.state',
                value: utils.toggle
              },
            }
          },
          1: {
            values: [
              {
                objname: 'p0',
                type: 'pic',
                path: 'electrical.switches.anchorLight.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p1',
                type: 'pic',
                path: 'electrical.switches.bank.yd.runningLights.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p2',
                type: 'pic',
                path: 'electrical.switches.bank.yd.foredeckLight.state',
                format: buttonPic,
                unknown: buttonUnknownPic
              },
              {
                objname: 'p3',
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
              19: {
                objname: 'p0',
                path: 'electrical.switches.anchorLight.state',
                value: utils.toggle
              },
              18: {
                objname: 'b1',
                path: 'electrical.switches.bank.yd.runningLights.state',
                value: utils.toggle
              },
              21: {
                objname: 'b2',
                path: 'electrical.switches.bank.yd.fordeckLight.state',
                value: utils.toggle
              },
              20: {
                objname: 'b3',
                path: 'electrical.switches.bank.yd.steamingLight.state',
                value: utils.toggle
              },
              22: {
                objname: 'b4',
                path: 'electrical.switches.hue.groups.cabin.state',
                value: utils.toggle
              },
              23: {
                objname: 'b5',
                path: 'electrical.switches.hue.groups.vBirth.state',
                value: utils.toggle
              },
            }
          },
          2: {
            values: [
              {
                objname: 'z0',
                type: 'gauge',
                path: 'navigation.headingMagnetic',
                format: v => (degToGauge(radsToDeg(v)).toFixed(0))
              },
              {
                objname: 't0',
                type: 'txt',
                path: 'environment.wind.speedApparent',
                format: v => `${(v*1.94384).toFixed(0)}kts`,
                unknown: '---kts'
              },
              {
                objname: 't1',
                type: 'txt',
                path: 'environment.inside.temperature',
                format: v => `${KtoF(v).toFixed(0)}°`,
                unknown: '--°'
              },
              {
                objname: 't4',
                type: 'txt',
                path: 'environment.water.temperature',
                format: v => `${KtoF(v).toFixed(0)}°`,
                unknown: '--°'
              },
              {
                objname: 't6',
                type: 'txt',
                path: 'environment.inside.refrigerator.temperature',
                format: v => `${KtoF(v).toFixed(0)}°`,
                unknown: '--°'
              },
              {
                objname: 't8',
                type: 'txt',
                path: 'environment.inside.refrigerator.relativeHumidity',
                format: v => `${(v*100).toFixed(0)}%`,
                unknown: '---%'
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
            ]
          }
        }
      }
    ]
  }
  return config
}
