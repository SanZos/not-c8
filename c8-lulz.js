const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const url = require('url')
const colors = require('./colors').colors

const lancement = Date.now()
const argv = process.argv.slice(2)

// console.log(process.argv)
// console.log(process.argv.findIndex(element => element.includes('c8-lulz.js')))
// console.log(process.cwd())

let keepInternals = false
let fileIgnores = ['bootstrap']
let coverageDirectory = 'coverage'
let exist = false

// const reportDir = `./rapport/${lancement}`
// fs.mkdirSync(reportDir)
const reportDir = `./rapport`

const childp = require('child_process')
const tbc = Date.now()
const output = childp.spawn(process.execPath, argv, { env: { ...process.env, NODE_V8_COVERAGE: coverageDirectory } })
const v = setInterval(() => { process.stdout.write('.') }, 1000)

// output.stdout.pipe(process.stdout)
// output.stderr.pipe(process.stderr)

const to = setTimeout(() => { output.kill() }, 1 * 60 * 1000)
output.on('data', d => console.log(d))
output.on('close', () => {
  clearTimeout(to)
  clearInterval(v)
  const tac = Date.now()
  let index = [""]
  console.log(`\nExecution de ${argv[0]} en ${tac - tbc} ms`)
  fsp.readdir(coverageDirectory)
    .then(ad => {
      exist = false
      if (ad.length <= 0) return
      ad.forEach(d => {
        if (d.startsWith(`coverage-${output.pid}`)) exist = './' + coverageDirectory + '/' + d
      })
      if (exist) {
        return new Promise(purge)
      }
    })
    .then(() => {
      const cr = require('./' + coverageDirectory + '/result-' + output.pid + '.json')
      cr.forEach((r) => {
        const file = r.functions.shift()
        let size = 0
        let notCovered = 0
        let excluded = []
        if (file.isBlockCoverage)
          if (file.ranges.length === 1)
            size = file.ranges[0].endOffset
          else {
            size = file.ranges[0].endOffset

            let f = file.ranges.filter(isNotCovered)
            let sb
            while (sb = f.shift()) {
              if (excluded.length == 0 || !comprisDans(excluded, sb)) {
                excluded.push({ startOffset: sb.startOffset, endOffset: sb.endOffset })
                notCovered += sb.endOffset - sb.startOffset
              }
            }
          }
        let a
        while (a = r.functions.shift()) {
          let f = a.ranges.filter(isNotCovered)
          let sb
          while (sb = f.shift()) {
            if (excluded.length == 0 || !comprisDans(excluded, sb)) {
              excluded.push({ startOffset: sb.startOffset, endOffset: sb.endOffset })
              notCovered += sb.endOffset - sb.startOffset
            }
          }
        }
        let p = (100 - (notCovered / size * 100)).toFixed(2)
        console.log(`${path.basename(r.url)} => ${colorResult(p)}${p}%${colors.Reset}`)
        excluded.forEach(offset => console.log(`${offset.startOffset} - Code non couvert :\r\n${colors.self.RougeClair}- ${readWithOffsets(r.url, offset)}${colors.Reset}`))
        index.push({ file: createHTMLReport(r.url, excluded, size), covered: p })
      })
      createHTMLIndex(index)
      fsp.unlink('./' + coverageDirectory + '/result-' + output.pid + '.json')
    })
})
function purge(resolve, reject) {
  const c = require(exist).result
  let i = 0
  let n = true
  fsp.writeFile('./' + coverageDirectory + '/result-' + output.pid + '.json', '[').then(itterate)
  function itterate() {
    if ((c[i].url.search(/node_modules/g) === -1 && c[i].url.search('file://') !== -1) || keepInternals) {
      fsp.appendFile('./' + coverageDirectory + '/result-' + output.pid + '.json', (n ? '' : ',') + JSON.stringify(c[i])).then(doNext)
      n = false
    } else doNext()
  }
  function doNext() {
    i++
    if (c[i] !== void 0) itterate()
    else {
      fsp.appendFile('./' + coverageDirectory + '/result-' + output.pid + '.json', ']').then(() => fsp.unlink(exist)).then(resolve).catch(reject)
    }
  }
}
function isCovered(m) {
  return m.count > 0
}
function isNotCovered(m) {
  return !isCovered(m)
}
function comprisDans(isIn, match) {
  return isIn.find(v => {
    if (v.startOffset < match.startOffset && match.startOffset < v.endOffset)
      return true
    return (v.startOffset < match.endOffset && match.endOffset < v.endOffset)
  }) !== void 0
}
function readWithOffsets(file, offsets) {
  file = path.resolve(url.fileURLToPath(file))
  const length = offsets.endOffset - offsets.startOffset + 1
  let fd = fs.openSync(file, 'r')
  let buffer = Buffer.alloc(length)
  fs.readSync(fd, buffer, 0, length, offsets.startOffset)
  return buffer.toString()
}
function colorResult(taux) {
  if (taux < 30)
    return colors.self.RougeClair
  else if (taux < 80)
    return colors.fg.Yellow
  else
    return colors.self.VertClair
}
function createHTMLReport(url_file, excluded, size) {
  const name = `${reportDir}/result-${path.basename(url_file)}.html`
  const file = url.fileURLToPath(url_file)
  fs.writeFileSync(name, `<!DOCTYPE html>
  <head><link rel="stylesheet" type="text/css" href="main.css"></head>
  
  <body><div class="main">
    <a href='./index.html'>retour</a>
      <pre>`)
  if (Array.isArray(excluded) && excluded.length == 0) {
    fs.appendFileSync(name, "<div class=covered>")
    fs.appendFileSync(name, fs.readFileSync(file))
  } else {
    let offsets = createMissingOffset(excluded, size)
    offsets.forEach(offset => fs.appendFileSync(name, `<div class=${offset.covered ? 'covered' : 'notCovered'}>${readWithOffsets(url_file, offset)}</div>`))
  }
  fs.appendFileSync(name, `</div></pre><div></body>`)
  return 'result-' + path.basename(url_file) + '.html'
}
function createMissingOffset(excluded, size) {
  let offsets = []
  if (excluded[0].startOffset !== 0) {
    offsets.push({ startOffset: 0, endOffset: excluded[0].startOffset - 1, covered: true })
  }
  while (excluded.length > 0) {
    offsets.push(Object.assign({ covered: false }, excluded.shift()))
    if (excluded.length > 0 && offsets[offsets.length - 1].endOffset != excluded[0].startOffset) {
      offsets.push({ startOffset: offsets[offsets.length - 1].endOffset + 1, endOffset: excluded[0].startOffset - 1, covered: true })
    } else if (excluded.length == 0) {
      offsets.push({ startOffset: offsets[offsets.length - 1].endOffset + 1, endOffset: size, covered: true })
    }
  }
  return offsets
}
function createHTMLIndex(index) {
  fs.copyFileSync(`./static/main.css`, `${reportDir}/main.css`)

  fs.writeFileSync(`${reportDir}/index.html`, `<!DOCTYPE html>
  <head><link rel="stylesheet" type="text/css" href="main.css"></head>
  <body>`)
  fs.appendFileSync(`${reportDir}/index.html`, `
  <table>
  <tr>
    <th>Fichier</th>
    <th>Taux de couverture</th>
  </tr>
  ${index.reduce((previous, current) => previous + `
  <tr>
    <td><a href="./${current.file}">${current.file}</a></td>
    <td class="${current.covered > 79 ? 'isOk' : current.covered < 30 ? 'isNotOk' : 'isMeh'}">${current.covered} %</td>
    </tr>`)}
  </table></body>`)
}