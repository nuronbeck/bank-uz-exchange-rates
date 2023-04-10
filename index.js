require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');

const app = express();
const { PORT = 3000, EXCHANGE_SOURCE_URL } = process.env

app.use(cors({ origin: '*' }));

const puppeteerOptimizerMiddleware = (req) => {
  const resourceType = req.resourceType();
  const excludedResources = [ 'stylesheet', 'script', 'ping', 'font', 'image', 'media', 'xhr' ];

  if(excludedResources.includes(resourceType)){
    req.abort();
  }
  else {
    req.continue();
  }
}

app.get('/health', async (req, res) => {
  res.status(200).send({ status: 'ok' });
})

app.get('/fetch-rates', async (req, res) => {
  let browser = null;

  if(!EXCHANGE_SOURCE_URL) {
    console.log(`Environment value doesn't exist!\n.env\n EXCHANGE_SOURCE_URL=${EXCHANGE_SOURCE_URL}\n`);
    process.exit();
  }

  try {
    browser = await puppeteer.launch();

    const page = await browser.newPage();
    await page.setViewport({ width: 768, height: 1080 });

    // Optimizing page opening
    await page.setRequestInterception(true);
    page.on('request', puppeteerOptimizerMiddleware);

    await page.goto(EXCHANGE_SOURCE_URL);

    const response = await page.$eval('#best_USD .bank-contacts .feed-back .organization-contacts', content => {
      let result = [];

      const buyContent = content.querySelectorAll('.bc-inner-blocks-left .bc-inner-block-left .bc-inner-block-left-texts');
      const sellContent = content.querySelectorAll('.bc-inner-blocks-right .bc-inner-block-left-texts');

      buyContent.forEach(eachRow => {
        const name = eachRow.querySelector('.bc-inner-block-left-text')?.textContent?.trim();
        const buy = eachRow.querySelector('span.green-date')?.textContent?.trim()?.split(" so'm")[0] ?? 0;

        result.push({
          name,
          buy
        });
      });

      sellContent.forEach(eachRow => {
        const name = eachRow.querySelector('.bc-inner-block-left-text')?.textContent?.trim();
        const sell = eachRow.querySelector('span.green-date')?.textContent?.trim()?.split(" so'm")[0] ?? 0;

        result = result.map(el => {
          if(el.name === name){
            return { ...el, sell }
          }

          return el
        })
      })

      return result
    });

    res.status(200).send(response);
  }
  catch (error) {
    res.status(400).send({ error });
  }
  finally {
    if(browser){
      await browser.close();
    }
  }
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}. For local server http://localhost:${PORT}`);
})