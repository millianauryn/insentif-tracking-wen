const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'incentive-tracking-api' })
})

app.listen(port, () => {
  console.log(`Incentive API listening on http://localhost:${port}`)
})
