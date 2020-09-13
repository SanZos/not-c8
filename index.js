const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const url = require('url')
const colors = require('./colors').colors

const argv = process.argv.slice(2)

const keepInternals = false
const fileIgnores = ['bootstrap', '.test.js', '/tests/']
const coverageDirectory = `${process.cwd()}/coverage`
let exist = false

const reportDir = `${process.cwd()}/rapport`
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir)

const childp = require('child_process')
const tbc = Date.now()
const output = childp.spawn(process.execPath, argv, { env: { ...process.env, NODE_V8_COVERAGE: coverageDirectory } })
const v = setInterval(() => { process.stdout.write('.') }, 1000)

const to = setTimeout(() => { output.kill() }, 1 * 60 * 1000)
output.on('data', d => console.log(d))
output.on('close', () => {
  clearTimeout(to)
  clearInterval(v)
  const tac = Date.now()
  const index = ['']
  console.log(`\nExecution de ${argv[0]} en ${tac - tbc} ms`)
  fsp.readdir(coverageDirectory)
    .then(ad => {
      exist = false
      if (ad.length <= 0) return
      ad.forEach(d => {
        if (d.startsWith(`coverage-${output.pid}`)) exist = coverageDirectory + '/' + d
      })
      if (exist) {
        return new Promise(purge)
      }
    })
    .then(() => {
      const cr = require(coverageDirectory + '/result-' + output.pid + '.json')
      cr.forEach((r) => {
        const file = r.functions.shift()
        let size = 0
        let notCovered = 0
        const excluded = []
        if (file.isBlockCoverage) {
          if (file.ranges.length === 1) {
            size = file.ranges[0].endOffset
          } else {
            size = file.ranges[0].endOffset

            const f = file.ranges.filter(isNotCovered)
            let sb = f.shift()
            while (sb) {
              if (excluded.length === 0 || !comprisDans(excluded, sb)) {
                excluded.push({ startOffset: sb.startOffset, endOffset: sb.endOffset })
                notCovered += sb.endOffset - sb.startOffset
              }
              sb = f.shift()
            }
          }
        }
        let a = r.functions.shift()
        while (a) {
          const f = a.ranges.filter(isNotCovered)
          let sb = f.shift()
          while (sb) {
            if (excluded.length === 0 || !comprisDans(excluded, sb)) {
              excluded.push({ startOffset: sb.startOffset, endOffset: sb.endOffset })
              notCovered += sb.endOffset - sb.startOffset
            }
            sb = f.shift()
          }
          a = r.functions.shift()
        }
        const p = (100 - (notCovered / size * 100)).toFixed(2)
        console.log(`${path.basename(r.url)} => ${colorResult(p)}${p}%${colors.Reset}`)
        const fd = fs.openSync(file, 'r')
        const fileContent = fs.readFileSync(fd).toString()
        excluded.forEach(offset => console.log(`${offset.startOffset} - Code non couvert :\r\n${colors.self.RougeClair}- ${fileContent.substring(offset.startOffset, offset.endOffset)}${colors.Reset}`))
        index.push({ file: createHTMLReport(r.url, excluded, size), covered: p })
      })
      createHTMLIndex(index)
      fsp.unlink(coverageDirectory + '/result-' + output.pid + '.json')
    })
})
function purge (resolve, reject) {
  console.log(process.cwd(), __dirname, exist)
  const c = require(exist).result
  let i = 0
  let n = true
  fsp.writeFile(coverageDirectory + '/result-' + output.pid + '.json', '[').then(itterate)
  function itterate () {
    if ((c[i].url.search(/node_modules/g) === -1 && c[i].url.search('file://') !== -1) || keepInternals) {
      if (fileIgnores.find(f => c[i].url.search(f) !== -1) || c[i].url.search(process.cwd()) === -1) doNext()
      else {
        fsp.appendFile(coverageDirectory + '/result-' + output.pid + '.json', (n ? '' : ',') + JSON.stringify(c[i])).then(doNext)
        n = false
      }
    } else doNext()
  }
  function doNext () {
    i++
    if (c[i] !== undefined) itterate()
    else {
      fsp.appendFile(coverageDirectory + '/result-' + output.pid + '.json', ']').then(() => fsp.unlink(exist)).then(resolve).catch(reject)
    }
  }
}
function isCovered (m) {
  return m.count > 0
}
function isNotCovered (m) {
  return !isCovered(m)
}
function comprisDans (isIn, match) {
  return isIn.find(v => {
    if (v.startOffset < match.startOffset && match.startOffset < v.endOffset) return true
    return (v.startOffset < match.endOffset && match.endOffset < v.endOffset)
  }) !== undefined
}
function colorResult (taux) {
  if (taux < 30) return colors.self.RougeClair
  else if (taux < 80) return colors.fg.Yellow
  else return colors.self.VertClair
}
function createHTMLReport (urlFile, excluded, size) {
  const name = `${reportDir}/${path.basename(urlFile)}.html`
  const file = url.fileURLToPath(urlFile)
  fs.writeFileSync(name, `<!DOCTYPE html>
  <head><link rel="stylesheet" type="text/css" href="main.css"></head>
  
  <body><div class="main">
    <a href='./index.html'>retour</a>
      <pre>`)
  if (Array.isArray(excluded) && excluded.length === 0) {
    fs.appendFileSync(name, '<div class=covered>')
    fs.appendFileSync(name, fs.readFileSync(file))
  } else {
    const offsets = createMissingOffset(excluded, size)
    const fd = fs.openSync(file, 'r')
    const fileContent = fs.readFileSync(fd).toString()
    offsets.forEach(offset => fs.appendFileSync(name, `<div class=${offset.covered ? 'covered' : 'notCovered'}>${fileContent.substring(offset.startOffset, offset.endOffset)}</div>`))
  }
  fs.appendFileSync(name, '</div></pre><div></body>')
  return path.basename(urlFile) + '.html'
}
function createMissingOffset (excluded, size) {
  const offsets = []
  if (excluded[0].startOffset !== 0) {
    offsets.push({ startOffset: 0, endOffset: excluded[0].startOffset - 1, covered: true })
  }
  while (excluded.length > 0) {
    offsets.push(Object.assign({ covered: false }, excluded.shift()))
    if (excluded.length > 0 && offsets[offsets.length - 1].endOffset !== excluded[0].startOffset) {
      offsets.push({ startOffset: offsets[offsets.length - 1].endOffset + 1, endOffset: excluded[0].startOffset - 1, covered: true })
    } else if (excluded.length === 0 && offsets[offsets.length - 1].endOffset + 1 < size) {
      offsets.push({ startOffset: offsets[offsets.length - 1].endOffset + 1, endOffset: size, covered: true })
    }
  }
  return offsets
}
function createHTMLIndex (index) {
  fs.copyFileSync(`${__dirname}/static/main.css`, `${reportDir}/main.css`)

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
