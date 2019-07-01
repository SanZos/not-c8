time = Date.now()
argv = process.argv.slice(2)
//console.log(process.cwd())
keepInternals = false
fileIgnores = ['bootstrap']
childp = require('child_process')
coverageDirectory = 'coverage'
tbc = Date.now()
output = childp.spawn(process.execPath, argv, { env: { ...process.env, NODE_V8_COVERAGE: coverageDirectory } })
v = setInterval(() => { process.stdout.write('.') }, 1000)
output.stdout.pipe(process.stdout)
output.stderr.pipe(process.stderr)
setTimeout(() => { output.kill() }, 1 * 60 * 1000)
output.on('data', d => console.log(d))
output.on('close', () => {
  clearInterval(v)
  tac = Date.now()

  if (output.status !== 0) {  }
  console.log(`Execution de ${argv[0]} en ${tac - tbc} ms`)
  fsp = require('fs').promises
  fsp.readdir(coverageDirectory)
    .then(ad => {
      exist = false
      if (ad.length <= 0) return
      ad.forEach(d => {
        if (d.startsWith('coverage-' + output.pid)) exist = './' + coverageDirectory + '/' + d
      })
      if (exist) {
        return new Promise(purge)
      }
    })
    .then(() => {
      cr = require('./' + coverageDirectory + '/result-' + output.pid + '.json')
      cr.forEach((r) => {
        file = r.functions.shift()
        size = 0
        notCovered = 0
        excluded = []
        if (file.isBlockCoverage)
          if (file.ranges.length === 1)
            size = file.ranges[0].endOffset
          else {
            size = file.ranges[0].endOffset
            // notCovered += file.ranges.filter(isNotCovered).reduce(substractNotCovered, 0, [], 0)
            f = file.ranges.filter(isNotCovered)
            while (sb = f.shift()) {
              if (excluded.length == 0 || !comprisDans(excluded, sb)) {
                excluded.push({ startOffset: sb.startOffset, endOffset: sb.endOffset })
                notCovered += sb.endOffset - sb.startOffset
              }
            }
          }

        while (a = r.functions.shift()) {
          f = a.ranges.filter(isNotCovered)
          while (sb = f.shift()) {
            if (excluded.length == 0 || !comprisDans(excluded, sb)) {
              excluded.push({ startOffset: sb.startOffset, endOffset: sb.endOffset })
              notCovered += sb.endOffset - sb.startOffset
            }
          }
        }
        path = require('path')
        p = (100 - (notCovered / size * 100)).toFixed(2)
        console.log(`${path.basename(r.url)} => ${p}%`)
      })
      fsp.unlink('./' + coverageDirectory + '/result-' + output.pid + '.json')
    })
})
function purge(resolve, reject) {
  c = require(exist).result
  i = 0
  n = true
  fsp.writeFile('./' + coverageDirectory + '/result-' + output.pid + '.json', '[').then(itterate)
  function itterate() {
    if (c[i].url.search('file://') || keepInternals) {
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
function substractNotCovered(a, c) {
  return a + (c.endOffset - c.startOffset)
}
function comprisDans(isin, match) {
  return isin.find(v => {
    if (v.startOffset < match.startOffset && match.startOffset < v.endOffset)
      return true
    if (v.startOffset < match.endOffset && match.endOffset < v.endOffset)
      return true
    else
      return false
  }) !== void 0
}
