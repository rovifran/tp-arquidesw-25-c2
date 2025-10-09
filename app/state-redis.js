import { createClient } from 'redis';

let redisClient = null;

// Inicializar conexión a Redis
export async function init() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
    
    await redisClient.connect();
    
    // Inicializar datos por defecto si no existen
    await initializeDefaultData();
    
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
}

// Inicializar datos por defecto
async function initializeDefaultData() {
  // Verificar si ya existen datos
  const accountsExist = await redisClient.exists('accounts');
  const ratesExist = await redisClient.exists('rates');
  
  if (!accountsExist) {
    const defaultAccounts = [
      { id: 1, currency: "ARS", balance: 120000000 },
      { id: 2, currency: "USD", balance: 60000 },
      { id: 3, currency: "EUR", balance: 40000 },
      { id: 4, currency: "BRL", balance: 60000 }
    ];
    await setAccounts(defaultAccounts);
  }
  
  if (!ratesExist) {
    const defaultRates = {
      "ARS": {
        "BRL": 0.00360,
        "EUR": 0.00057,
        "USD": 0.00068
      },
      "BRL": {
        "ARS": 277.3
      },
      "EUR": {
        "ARS": 1741
      },
      "USD": {
        "ARS": 1469
      }
    };
    await setRates(defaultRates);
  }
  
  // Inicializar log vacío si no existe
  const logExists = await redisClient.exists('log');
  if (!logExists) {
    await redisClient.set('log', JSON.stringify([]));
  }
}

// === ACCOUNTS ===

export async function getAccounts() {
  try {
    const accountsJson = await redisClient.get('accounts');
    return accountsJson ? JSON.parse(accountsJson) : [];
  } catch (error) {
    console.error('Error getting accounts:', error);
    return [];
  }
}

export async function setAccounts(accounts) {
  try {
    await redisClient.set('accounts', JSON.stringify(accounts));
  } catch (error) {
    console.error('Error setting accounts:', error);
    throw error;
  }
}

export async function updateAccountBalance(accountId, balance) {
  try {
    const accounts = await getAccounts();
    const accountIndex = accounts.findIndex(acc => acc.id == accountId);
    
    if (accountIndex !== -1) {
      accounts[accountIndex].balance = balance;
      await setAccounts(accounts);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating account balance:', error);
    throw error;
  }
}

// === RATES ===

export async function getRates() {
  try {
    const ratesJson = await redisClient.get('rates');
    return ratesJson ? JSON.parse(ratesJson) : {};
  } catch (error) {
    console.error('Error getting rates:', error);
    return {};
  }
}

export async function setRates(rates) {
  try {
    await redisClient.set('rates', JSON.stringify(rates));
  } catch (error) {
    console.error('Error setting rates:', error);
    throw error;
  }
}

export async function updateRate(baseCurrency, counterCurrency, rate) {
  try {
    const rates = await getRates();
    
    if (!rates[baseCurrency]) {
      rates[baseCurrency] = {};
    }
    if (!rates[counterCurrency]) {
      rates[counterCurrency] = {};
    }
    
    rates[baseCurrency][counterCurrency] = rate;
    rates[counterCurrency][baseCurrency] = Number((1 / rate).toFixed(5));
    
    await setRates(rates);
  } catch (error) {
    console.error('Error updating rate:', error);
    throw error;
  }
}

// === LOG ===

export async function getLog() {
  try {
    const logJson = await redisClient.get('log');
    return logJson ? JSON.parse(logJson) : [];
  } catch (error) {
    console.error('Error getting log:', error);
    return [];
  }
}

export async function addLogEntry(logEntry) {
  try {
    const log = await getLog();
    log.push(logEntry);
    await redisClient.set('log', JSON.stringify(log));
  } catch (error) {
    console.error('Error adding log entry:', error);
    throw error;
  }
}

// === UTILITY FUNCTIONS ===

export async function closeConnection() {
  if (redisClient) {
    await redisClient.quit();
  }
}

// Función para migrar datos desde archivos JSON
export async function migrateFromJson(accountsData, ratesData, logData) {
  try {
    await setAccounts(accountsData);
    await setRates(ratesData);
    await redisClient.set('log', JSON.stringify(logData));
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}
