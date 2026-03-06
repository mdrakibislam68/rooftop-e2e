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

    // Helper to wait for, scroll to, and click an element.
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

    // Helper to wait for, scroll to, and type text.
    async function typeText(xpath, text, name) {
      console.log(`Typing "${text}" into ${name}...`);
      const element = await driver.wait(until.elementLocated(By.xpath(xpath)), 20000);
      await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", element);
      await driver.wait(until.elementIsVisible(element), 10000);
      await element.clear();
      await element.sendKeys(text);
    }

    // Helper to find and click the first available date in the calendar.
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
    }


    // Helper to find and click the first available time slot.
async function clickFirstAvailableTimeSlot() {
  console.log("Finding first available time slot...");

  const slotXpath =
    "//span[contains(normalize-space(), ':') and contains(normalize-space(), '-')]";

  await driver.wait(until.elementsLocated(By.xpath(slotXpath)), 15000);
  const slots = await driver.findElements(By.xpath(slotXpath));

  if (slots.length === 0) {
    throw new Error("❌ No time slot elements found!");
  }

  for (const slot of slots) {
    try {
      const timeText = await slot.getText();

      // Get clickable container (parent div)
      const clickableParent = await driver.executeScript(
        "return arguments[0].closest('div');",
        slot
      );

      // 🔥 Detect using CSS
      const cursorStyle = await clickableParent.getCssValue("cursor");

      console.log(`Slot: ${timeText} | Cursor: ${cursorStyle}`);

      if (cursorStyle === "not-allowed") {
        console.log(`Skipping disabled slot: ${timeText}`);
        continue;
      }

      console.log(`Clicking enabled slot: ${timeText}`);

      await driver.executeScript(
        "arguments[0].scrollIntoView({block:'center'});",
        clickableParent
      );

      await driver.executeScript("arguments[0].click();", clickableParent);

      return timeText;

    } catch (err) {
      console.log("Skipping element due to error.");
    }
  }

  throw new Error("❌ No enabled time slots available!");
}

    // Step 2: Click on "Book a session"
    await clickElement("//div[@class='wp-block-group is-content-justification-right is-nowrap is-layout-flex wp-container-core-group-is-layout-c4f7172d wp-block-group-is-layout-flex']//a[@class='wp-block-button__link wp-element-button'][normalize-space()='Book a session']", 'Book a session');

    // Step 3: Click on "Sauna Experience (60mins)" / "Express Sauna (60 mins)"
    await clickElement("//*[contains(@class,'wp-block-button__link') and (contains(normalize-space(),'60 mins') or contains(normalize-space(),'60mins'))]", 'Sauna Experience (60 mins)');

    // Wait after last test step
    
    // Step 4: Click on "Continue"
    await clickElement("//span[normalize-space()='Continue']", 'Continue (Step 4)');
    
    // Step 5: Click on "Express Sauna (60 mins)"
    await clickElement("//div[@class='wp-block-uagb-container uagb-block-d7fd10bc alignfull uagb-is-root-container']//div[@class='wp-block-button has-custom-width wp-block-button__width-100 is-style-fill']", 'Express Sauna (Step 5)');
    await driver.sleep(3000);

    // Step 6: Click on "Continue"
    await clickElement("//button[descendant::span[text()='Continue']]", 'Continue (Step 6)');

    // Step 7: Click on available date
    await clickFirstAvailableDate();

    // Step 8: Select first available time slot
    await clickFirstAvailableTimeSlot();

    // Step 9: Click on "Continue"
    await clickElement("//span[normalize-space()='Continue']", 'Continue (Step 9)');

    // Step 10: Click on "Continue"
    await clickElement("//span[normalize-space()='Continue']", 'Continue (Step 10)');

    // Step 11: Click on "Continue"
    await clickElement("//button[descendant::span[text()='Continue']]", 'Continue (Step 11)');

    // Step 12: Click on "Sign in"
    await clickElement("//h5[normalize-space()='Sign in']", 'Sign in');

    // Step 13: Enter email
    await typeText("//input[contains(@placeholder,'example@gmail.com')]", 'rakibislam@boomdevs.com', 'Email field');

    // Step 14: Enter password
    await typeText("//input[@placeholder='Enter your password']", 'testuser', 'Password field');

    // Step 15: Click on "Sign In"
    await clickElement("//button[@type='submit']", 'Sign In button');

    // Step 16: Click on "Continue"
    await clickElement("//button[descendant::span[text()='Continue']]", 'Continue (Step 16)');

    // Step 17: Click on "Pay now"
    await driver.sleep(5000); // Wait for Pay now button to be fully ready
    await clickElement("//button[descendant::span[text()='Pay now']] | //span[normalize-space()='Pay now']", 'Pay now');

    // Wait for and verify the "Booking created successfully" popup
    console.log("Waiting for booking success notification...");
    try {
      const popup = await driver.wait(
        until.elementLocated(By.xpath(
          "//*[contains(@class,'success') or contains(@class,'notification') or contains(@class,'toast') or contains(@class,'alert') or contains(normalize-space(),'Booking created successfully') or contains(normalize-space(),'already been booked') or contains(normalize-space(),'Error')]"
        )),
        10000
      );
      const popupText = await popup.getText();

      // Screenshot capturing the popup
      const screenshot = await driver.takeScreenshot();
      require('fs').writeFileSync('/tmp/booking_success_60min.png', screenshot, 'base64');
      console.log("📸 Screenshot saved to /tmp/booking_success_60min.png");

      // Fail the test if it's an error notification
      const lowerText = popupText.toLowerCase();
      if (lowerText.includes('error') || lowerText.includes('Time slot has already been booked by someone else') || lowerText.includes('failed')) {
        throw new Error(`❌ Booking failed with notification: ${popupText}`);
      }

      console.log("✅ Booking successful! Notification");
    } catch (popupErr) {
      if (popupErr.message && popupErr.message.startsWith('❌')) {
        throw popupErr; // Re-throw booking errors
      }
      console.log("⚠️ No popup detected within timeout. Taking screenshot for inspection...");
      const screenshot = await driver.takeScreenshot();
      require('fs').writeFileSync('/tmp/booking_success_60min.png', screenshot, 'base64');
      console.log("📸 Screenshot saved to /tmp/booking_success_60min.png");
    }

    console.log("Full 17-step test flow completed successfully!");

  } catch (e) {
    console.log("Error during test execution:");
    console.log(e);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
})();