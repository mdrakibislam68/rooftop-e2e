const { By, Builder, Browser, until } = require('selenium-webdriver');

(async function firstTest() {
  let driver;

  try {
    driver = await new Builder().forBrowser(Browser.CHROME).build();
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
     */
    async function clickFirstAvailableDate() {
      console.log(`Finding an available date...`);
      // Wait for the calendar to be visible
      await driver.wait(until.elementLocated(By.xpath("//div[contains(@class, 'fc-view-harness')]")), 20000);
      
      // Find all potential day cells that are not in the past and not disabled
      const dateXpath = "//td[contains(@class, 'fc-daygrid-day') and not(contains(@class, 'fc-day-past')) and not(contains(@class, 'fc-day-disabled'))]";
      const dates = await driver.findElements(By.xpath(dateXpath));
      
      for (const date of dates) {
        try {
          // Additional checks if necessary
          const classAttr = await date.getAttribute('class') || "";
          if (!classAttr.includes('fc-day-other')) { // Prefer dates in the current month view
             console.log(`Clicking available date...`);
             await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", date);
             try {
               await date.click();
             } catch (e) {
               await driver.executeScript("arguments[0].click();", date);
             }
             return;
          }
        } catch (err) {
          console.log("Skipping a date element due to error.");
        }
      }
      throw new Error("No available dates found!");
    }

    /**
     * Helper to find and click the first available time slot.
     */
    async function clickFirstAvailableTimeSlot() {
      console.log(`Finding an available time slot...`);
      // Add a small delay to allow the UI to transition after date click
      await driver.sleep(2000);

      // Wait for at least one time slot element to be located
      // Use normalize-space() for more robust matching of time patterns
      const slotXpath = "//span[contains(normalize-space(), ':') and contains(normalize-space(), '-')]";
      await driver.wait(until.elementLocated(By.xpath(slotXpath)), 20000);
      
      const slots = await driver.findElements(By.xpath(slotXpath));
      
      for (const slot of slots) {
        try {
          // Check if the slot or its parent is clearly disabled.
          // This depends on the UI, but common patterns are checking 'disabled' attribute or class.
          const isEnabled = await slot.isEnabled();
          const classAttr = await slot.getAttribute('class') || "";
          const parent = await driver.executeScript("return arguments[0].parentNode;", slot);
          const parentClass = await parent.getAttribute('class') || "";
          const parentDisabled = await parent.getAttribute('disabled');

          if (isEnabled && !classAttr.includes('disabled') && !parentClass.includes('disabled') && !parentDisabled) {
            const timeText = await slot.getText();
            console.log(`Clicking available slot: ${timeText}`);
            await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", slot);
            try {
              await slot.click();
            } catch (e) {
              await driver.executeScript("arguments[0].click();", slot);
            }
            return timeText;
          }
        } catch (err) {
          // Stale element or other minor error during iteration, just skip to next if possible
          console.log("Skipping an element due to error during check.");
        }
      }
      throw new Error("No available time slots found!");
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

      // // Steps 35-45: Multiple "Next Month" clicks
      // for (let i = 35; i <= 44; i++) {
      //   await clickElement("//span[contains(@class,'fc-icon fc-icon-chevron-right')]", `Next Month Arrow (Step ${i})`);
      // }

    // Step 46: Click on "31"
    // await clickElement("//td[contains(@class, 'fc-daygrid-day')]//span[text()='31']", 'Date 31');
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
    // await driver.quit();
  }
})();