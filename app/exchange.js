import { nanoid } from "nanoid";

import { 
  init as stateInit, 
  getAccounts as getAccountsFromRedis, 
  getRates as getRatesFromRedis, 
  getLog as getLogFromRedis, 
  updateAccountBalance,
  updateRate,
  addLogEntry
} from "./state-redis.js";

//call to initialize the exchange service
export async function init() {
  await stateInit();
}

//returns all internal accounts
export async function getAccounts() {
  return await getAccountsFromRedis();
}

//sets balance for an account
export async function setAccountBalance(accountId, balance) {
  return await updateAccountBalance(accountId, balance);
}

//returns all current exchange rates
export async function getRates() {
  return await getRatesFromRedis();
}

//returns the whole transaction log
export async function getLog() {
  return await getLogFromRedis();
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export async function setRate(rateRequest) {
  const { baseCurrency, counterCurrency, rate } = rateRequest;
  await updateRate(baseCurrency, counterCurrency, rate);
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId: clientBaseAccountId,
    counterAccountId: clientCounterAccountId,
    baseAmount,
  } = exchangeRequest;

  //get the exchange rate
  const rates = await getRatesFromRedis();
  const exchangeRate = rates[baseCurrency][counterCurrency];
  //compute the requested (counter) amount
  const counterAmount = baseAmount * exchangeRate;
  //find our account on the provided (base) currency
  const accounts = await getAccountsFromRedis();
  const baseAccount = findAccountByCurrency(accounts, baseCurrency);
  //find our account on the counter currency
  const counterAccount = findAccountByCurrency(accounts, counterCurrency);

  //construct the result object with defaults
  const exchangeResult = {
    id: nanoid(),
    ts: new Date(),
    ok: false,
    request: exchangeRequest,
    exchangeRate: exchangeRate,
    counterAmount: 0.0,
    obs: null,
  };

  //check if we have funds on the counter currency account
  if (counterAccount.balance >= counterAmount) {
    //try to transfer from clients' base account
    if (await transfer(clientBaseAccountId, baseAccount.id, baseAmount)) {
      //try to transfer to clients' counter account
      if (
        await transfer(counterAccount.id, clientCounterAccountId, counterAmount)
      ) {
        //all good, update balances
        await updateAccountBalance(baseAccount.id, baseAccount.balance + baseAmount);
        await updateAccountBalance(counterAccount.id, counterAccount.balance - counterAmount);
        exchangeResult.ok = true;
        exchangeResult.counterAmount = counterAmount;
      } else {
        //could not transfer to clients' counter account, return base amount to client
        await transfer(baseAccount.id, clientBaseAccountId, baseAmount);
        exchangeResult.obs = "Could not transfer to clients' account";
      }
    } else {
      //could not withdraw from clients' account
      exchangeResult.obs = "Could not withdraw from clients' account";
    }
  } else {
    //not enough funds on internal counter account
    exchangeResult.obs = "Not enough funds on counter currency account";
  }

  //log the transaction and return it
  await addLogEntry(exchangeResult);

  return exchangeResult;
}

// internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}

function findAccountByCurrency(accounts, currency) {
  for (let account of accounts) {
    if (account.currency == currency) {
      return account;
    }
  }

  return null;
}

async function findAccountById(id) {
  const accounts = await getAccountsFromRedis();
  for (let account of accounts) {
    if (account.id == id) {
      return account;
    }
  }

  return null;
}
