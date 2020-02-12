process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const h = require("./launcher")
const a = async () => {
  await h.test('localhost')
  await h.test('ipinfo.sio')
}
a()
