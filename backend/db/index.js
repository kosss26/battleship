import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// Создаём пул подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Проверка подключения
pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

/**
 * Выполняет SQL запрос
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise} - Результат запроса
 */
export const query = async (text, params) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount })
    }
    return res
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

/**
 * Получает клиент из пула для транзакций
 */
export const getClient = async () => {
  const client = await pool.connect()
  const originalQuery = client.query.bind(client)
  const release = client.release.bind(client)

  // Устанавливаем таймаут для освобождения клиента
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!')
  }, 5000)

  client.release = () => {
    clearTimeout(timeout)
    client.query = originalQuery
    release()
  }

  return client
}

export default { query, getClient, pool }
