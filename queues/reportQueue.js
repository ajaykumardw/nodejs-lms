const { Queue } = require('bullmq')
const connection = require('../util/redis')

const reportQueue = new Queue('reportQueue', {
  connection
})

module.exports = {
  reportQueue,
  connection
}
