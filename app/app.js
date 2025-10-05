import express from "express";
import { StatsD } from "hot-shots";

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";

await exchangeInit();

const app = express();
const port = 3000;

const statsd = new StatsD({
  host: "graphite",
  port: 8125,
  prefix: "exchange.",
  errorHandler: (error) => {
    console.error("StatsD error:", error);
  },
});

app.use(express.json());

// ACCOUNT endpoints

app.get("/accounts", (req, res) => {
  res.json(getAccounts());
});

app.put("/accounts/:id/balance", (req, res) => {
  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || !balance) {
    return res.status(400).json({ error: "Malformed request" });
  } else {
    setAccountBalance(accountId, balance);

    res.json(getAccounts());
  }
});

// RATE endpoints

app.get("/rates", (req, res) => {
  res.json(getRates());
});

app.put("/rates", (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || !rate) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const newRateRequest = { ...req.body };
  setRate(newRateRequest);

  res.json(getRates());
});

// LOG endpoint

app.get("/log", (req, res) => {
  res.json(getLog());
});

// EXCHANGE endpoint

app.post("/exchange", async (req, res) => {
  const startNs = process.hrtime.bigint();
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  const statusCode = exchangeResult.ok ? 200 : 500;
  // send response first
  res.status(statusCode).json(exchangeResult);

  // record metrics after sending
  const durationMs = Number((process.hrtime.bigint() - startNs) / 1000000n);
  statsd.timing("request.exchange", durationMs);
  statsd.increment("requests.total");
  if (statusCode >= 200 && statusCode < 300) {
    statsd.increment("requests.ok");
  } else {
    statsd.increment("requests.error");
  }
  statsd.increment(`requests.code.${statusCode}`);
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
