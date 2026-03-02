const { By, Builder, Browser, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

let options = new chrome.Options();
options.addArguments('--headless=new');
options.addArguments('--no-sandbox');
options.addArguments('--disable-setuid-sandbox');
options.addArguments('--disable-dev-shm-usage');
options.addArguments('--disable-gpu');
options.addArguments('--disable-extensions');
options.addArguments('--window-size=1920,1080');

// In Docker, use the system-installed chromium-browser binary (set via Dockerfile ENV)
const chromiumBin = process.env.CHROME_BIN;
if (chromiumBin) {
  options.setChromeBinaryPath(chromiumBin);
}

// Use the system chromedriver if available (avoids version mismatch SIGTRAP in Docker)
const chromedriverBin = process.env.CHROMEDRIVER_BIN || null;
const serviceBuilder = chromedriverBin
  ? new chrome.ServiceBuilder(chromedriverBin)
  : null;

(async function firstTest() {
  let driver;

  try {
    const builder = new Builder().forBrowser(Browser.CHROME).setChromeOptions(options);
    if (serviceBuilder) {
      builder.setChromeService(serviceBuilder);
    }
    driver = await builder.build();
    await driver.get('https://dev-rooftop.boomdevs.net/');

    /**
     * Helper to wait for, scroll to, and click an element.
     */
    async function clickElement(xpath, name, retries = 3) {
      console.log(`Clicking ${name}...`);
      for (let i = 0; i < retries; i++) {
        try {
          const element = await driver.wait(until.elementLocated(By.xpath(xpath)), 20000);
          await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", element);
          await driver.wait(until.elementIsVisible(element), 10000);
          try {
            await element.click();
          } catch (e) {
            await driver.executeScript("arguments[0].click();", element);
          }
          return; // Success
        } catch (error) {
          if (error.name === 'StaleElementReferenceError' && i < retries - 1) {
            console.log(`Stale element encountered for ${name}, retrying... (${i + 1}/${retries})`);
            continue;
          }
          throw error;
        }
      }
    }

    /**
     * Helper to wait for, scroll to, and type text.
     */
    async function typeText(xpath, text, name) {
      console.log(`Typing "${text}" into ${name}...`);
      const element = await driver.wait(until.elementLocated(By.xpath(xpath)), 20000);
      await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", element);
      await driver.wait(until.elementIsVisible(element), 10000);
      await element.clear();
      await element.sendKeys(text);
    }

    /**
     * Helper to find and click the first available date in the calendar.
     * The site requires clicking the <span> day number inside the <a> link
     * within each non-past, non-disabled calendar cell.
     */
    async function clickFirstAvailableDate() {
      console.log("Searching for available date...");

      // Wait for calendar to render
      await driver.wait(until.elementLocated(By.xpath("//td[contains(@class,'fc-daygrid-day')]")), 20000);

      // Exclude: past days, disabled days, other-month days, AND today (site won't show slots for today)
      const spanXpath = "//td[contains(@class,'fc-daygrid-day') and not(contains(@class,'fc-day-past')) and not(contains(@class,'fc-day-disabled')) and not(contains(@class,'fc-day-other')) and not(contains(@class,'fc-day-today'))]//a//span[normalize-space(.) != '']";

      const spans = await driver.findElements(By.xpath(spanXpath));
      console.log(`[DEBUG] Found ${spans.length} candidate date span(s)`);

      if (spans.length === 0) throw new Error("No available date spans found in calendar!");

      const firstDate = spans[0];
      const dayText = await firstDate.getText();
      console.log(`Clicking available date: ${dayText}`);
      await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant',block:'center'});", firstDate);
      try {
        await firstDate.click();
      } catch (e) {
        await driver.executeScript("arguments[0].click();", firstDate);
      }

      // Debug: capture state right after date click
      await driver.sleep(2000);
      const urlAfterClick = await driver.getCurrentUrl();
      console.log(`[DEBUG] URL after date click: ${urlAfterClick}`);
      const screenshot = await driver.takeScreenshot();
      require('fs').writeFileSync('/tmp/after_date_click.png', screenshot, 'base64');
      console.log("[DEBUG] Screenshot saved to /tmp/after_date_click.png");
    }


    /**
     * Helper to find and click the first available time slot.
     */
    async function clickFirstAvailableTimeSlot() {
      console.log(`Finding an available time slot...`);
      // Wait for UI to update after date click
      await driver.sleep(3000);

      // Try multiple XPath patterns to find time slot elements
      const slotXpaths = [
        "//span[contains(normalize-space(), ':') and contains(normalize-space(), '-')]",     // e.g. "07:30 - 08:00"
        "//button[contains(normalize-space(), ':') and contains(normalize-space(), '-')]",   // button-based slots
        "//*[contains(@class,'time') or contains(@class,'slot') or contains(@class,'Time') or contains(@class,'Slot')]", // class-based
      ];

      let slots = [];
      for (const xpath of slotXpaths) {
        try {
          await driver.wait(until.elementLocated(By.xpath(xpath)), 8000);
          slots = await driver.findElements(By.xpath(xpath));
          if (slots.length > 0) {
            console.log(`Found ${slots.length} slot(s) using XPath: ${xpath}`);
            break;
          }
        } catch (e) {
          // try next XPath
        }
      }

      if (slots.length === 0) throw new Error("No available time slots found!");

      for (const slot of slots) {
        try {
          const isEnabled = await slot.isEnabled();
          const classAttr = await slot.getAttribute('class') || "";
          const parent = await driver.executeScript("return arguments[0].parentNode;", slot);
          const parentClass = await parent.getAttribute('class') || "";
          const parentDisabled = await parent.getAttribute('disabled');

          if (isEnabled && !classAttr.includes('disabled') && !parentClass.includes('disabled') && !parentDisabled) {
            const timeText = await slot.getText();
            console.log(`Clicking available slot: ${timeText}`);
            await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant',block:'center'});", slot);
            try {
              await slot.click();
            } catch (e) {
              await driver.executeScript("arguments[0].click();", slot);
            }
            return timeText;
          }
        } catch (err) {
          console.log("Skipping an element due to error during check.");
        }
      }
      throw new Error("No enabled time slots found!");
    }

    // Step 2: Click on "Book a session"
    await clickElement("//div[@class='wp-block-group is-content-justification-right is-nowrap is-layout-flex wp-container-core-group-is-layout-c4f7172d wp-block-group-is-layout-flex']//a[@class='wp-block-button__link wp-element-button'][normalize-space()='Book a session']", 'Book a session');

    // Step 4: Click on "Express Sauna (30 mins)"
    await clickElement("//div[@class='wp-block-uagb-container uagb-block-d7fd10bc alignfull uagb-is-root-container']//div[@class='wp-block-button has-custom-width wp-block-button__width-100 is-style-fill']", 'Express Sauna (30 mins)');

    // Step 5: Click on "Continue"
    await clickElement("//span[normalize-space()='Continue']", 'Continue (Step 5)');

    // Step 18: Click on "Express Sauna (30 mins)"
    await clickElement("//div[@class='wp-block-uagb-container uagb-block-d7fd10bc alignfull uagb-is-root-container']//div[@class='wp-block-button has-custom-width wp-block-button__width-100 is-style-fill']", 'Express Sauna (Step 18)');

    // Step 19: Click on "Continue"
    await clickElement("//button[descendant::span[text()='Continue']]", 'Continue (Step 19)');

    // Step 46: Click on available date
    await clickFirstAvailableDate();

    // Step 47: Select first available time slot
    await clickFirstAvailableTimeSlot();

    // Step 48: Click on "Continue"
    await clickElement("//span[normalize-space()='Continue']", 'Continue (Step 48)');

    // Step 49: Click on "Continue"
    await clickElement("//span[normalize-space()='Continue']", 'Continue (Step 49)');

    // Step 50: Click on "Continue"
    await clickElement("//button[descendant::span[text()='Continue']]", 'Continue (Step 50)');

    // Step: Click on "Sign in"
    await clickElement("//h5[normalize-space()='Sign in']", 'Sign in');

    // Step: Enter email
    await typeText("//input[contains(@placeholder,'example@gmail.com')]", 'rakibislam@boomdevs.com', 'Email field');

    // Step: Enter password
    await typeText("//input[@placeholder='Enter your password']", 'testuser', 'Password field');

    // Step: Click on "Sign In"
    await clickElement("//button[@type='submit']", 'Sign In button');

    // Step: Click on "Continue"
    await clickElement("//button[descendant::span[text()='Continue']]", 'Continue (Step 51)');

    // Step 58: Click on "Pay now"
    await driver.sleep(3000);
    await clickElement("//button[descendant::span[text()='Pay now']] | //span[normalize-space()='Pay now']", 'Pay now');

    console.log("Full 64-step test flow completed successfully!");

  } catch (e) {
    console.log("Error during test execution:");
    console.log(e);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
})();