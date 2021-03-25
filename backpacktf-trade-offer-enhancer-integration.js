// ==UserScript==
// @name        Backpack.tf Steam Trade Offer Enhancer
// @namespace   https://github.com/DefaultSimon
// @description An integration with my patched version of HusKy's Steam Trade Offer Enhancer. Automatically adds the required amount of currency on your side.
// @include     https://backpack.tf/classifieds*
// @include     https://backpack.tf/stats/*
// @version     1.0.0
// @author      DefaultSimon
// @downloadURL https://gist.github.com/DefaultSimon/571fe1a9839014cf8db6757c6a4bd19d
// ==/UserScript==

function refDecimalToRefRecScrap (value) {
    const flooredRef = Math.floor(value);
    let remaining = value - flooredRef;

    let ref = flooredRef;
    let rec = 0;
    let scrap = 0;

    // Process the decimal places
    while (remaining >= 0.11) {
        if (remaining >= 0.33) {
            remaining -= 0.33;
            rec += 1;
        } else if (remaining >= 0.11) {
            remaining -= 0.11;
            scrap += 1;
        }
    }

    return [ref, rec, scrap];
}

jQuery(function () {
    // Gather all classifields
    const classifields = jQuery(".listing");
    const descriptionCurrencyRegex = /(\d+(?:\.\d+)?)\s?(keys?|ref)/ig;

    // For each one, update the trade link to automatically add required currency
    classifields.each(function (index, element) {
        const JQElement = jQuery(element);

        let currencyString = JQElement.find(".tag.bottom-right span").text();
        let description = JQElement.find(".quote-box p").text();

        let currencyInfo = currencyString.split(" ");
        if (currencyInfo.length !== 2) {
            console.warn("currencyInfo has length " + currencyInfo.length + ": " + currencyString);
            return;
        }

        const currencyAmount = parseFloat(currencyInfo[0]);
        const currencyType = currencyInfo[1];

        let totalCurrencyMap = {
            "key": 0,
            "ref": 0,
            "rec": 0,
            "scrap": 0,
        }

        if (currencyType === "key" || currencyType === "keys") {
            const flooredKeys = Math.floor(currencyAmount);
            const remaining = currencyAmount - flooredKeys;

            if (remaining === 0) {
                // Purely keys, no need for further calculations
                totalCurrencyMap.key = flooredKeys;
            } else {
                // Process the decimal places

                // Try processing the description first
                const matchesArray = [...description.matchAll(descriptionCurrencyRegex)];
                if (matchesArray.length >= 1) {
                    for (let i = 0; i < matchesArray.length; i++) {
                        const match = matchesArray[i];
                        if (match.length !== 3) {
                            console.warn("Expected legnth 3, got " + match.length + ": " + match + " on \"" + description + "\".");
                            continue;
                        }

                        let currencyAmount = parseFloat(match[1]);
                        let currencyType = match[2];

                        if (currencyType === "keys" || currencyType === "key") {
                            totalCurrencyMap.key = currencyAmount;
                            // TODO handle cases where the description has decimal places in keys, e.g. "... 14.3 keys"
                        } else if (currencyType === "ref") {
                            const unpackedCurrency = refDecimalToRefRecScrap(currencyAmount);
                            totalCurrencyMap.ref = unpackedCurrency[0];
                            totalCurrencyMap.rec = unpackedCurrency[1];
                            totalCurrencyMap.scrap = unpackedCurrency[2];
                        }
                    }
                } else {
                    // Fall back to keys, the rest will be up to the user
                    // TODO should this just not do anything?
                    totalCurrencyMap.key = flooredKeys;
                }
            }
        } else if (currencyType === "ref") {
            const unpackedCurrency = refDecimalToRefRecScrap(currencyAmount);
            totalCurrencyMap.ref = unpackedCurrency[0];
            totalCurrencyMap.rec = unpackedCurrency[1];
            totalCurrencyMap.scrap = unpackedCurrency[2];
        }

        let encodedCurrencyArray = [];
        for (let element of Object.entries(totalCurrencyMap)) {
            let name = element[0];
            let amount = element[1];

            if (amount > 0) {
                encodedCurrencyArray.push(amount.toString() + name);
            }
        }

        let encodedCurrency = encodedCurrencyArray.join(",");

        console.log(totalCurrencyMap);
        console.log("[" + encodedCurrency + "] " + description);

        const tradeButton = JQElement.find(
          ".listing-buttons a[href^='https://steamcommunity.com/tradeoffer/']"
        );
        const previousHref = tradeButton.attr("href");
        // Update the link to automatically load the required currency when opened
        tradeButton.attr("href", previousHref + "&enhancerAddCurrency=" + encodedCurrency)
    });
})()
